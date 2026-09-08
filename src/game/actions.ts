import { applyExpansion, campaignActive, addVenturePower, SITE_NAMES } from "./expansion.ts";
import {
  ILLIQUIDITY,
  LAST,
  RAISE_COOLDOWN,
  SECONDARY_POINTS,
  POACH_COOLDOWN,
  SITES,
  TECH,
  VENTURES,
  arriveLabel,
  idx,
  techById,
  ventureById,
} from "./data.ts";
import { chance } from "./rng.ts";
import {
  chipDisc,
  chipGen,
  chipPrice,
  derive,
  emergencyDraw,
  fabricPrice,
  hireCost,
  hireCount,
  maxActions,
  netWorthOf,
  powerLead,
  powerLeadAt,
  powerPrice,
  powerPriceAt,
  personById,
  poachChance,
  signingCost,
  siteById,
  techAvailableAt,
  roster,
  raiseSize,
  canRaise,
  techCost,
  valuationOf,
  capOf,
} from "./economy.ts";
import { clone, finite, money, mw, num } from "./format.ts";
import { pushEvent } from "./log.ts";
import type { Action, ActionResult, GameState } from "./types.ts";
import { applyEventChoice, eventChoiceCost } from "./events.ts";

function fail(s: GameState, reason: string): ActionResult {
  return { ok: false, reason, state: s };
}

function needAction(s: GameState): string | null {
  if (s.over) return "The run is over.";
  if (s.pendingEvent) return "Resolve the current event first.";
  if (s.pendingEmergency) return "Resolve emergency financing first.";
  if (s.actions < 1) return "No actions left this quarter.";
  return null;
}

function spendAction(s: GameState) {
  s.actions -= 1;
}

export function applyAction(state: GameState, action: Action): ActionResult {
  const original = state;
  const s = clone(state);

  if (action.type === "setTrainShare") {
    if (s.over) return fail(original, "The run is over.");
    const share = Math.max(0, Math.min(1, action.share));
    if (!finite(share)) return fail(original, "Invalid allocation.");
    s.trainShare = share;
    return { ok: true, state: s };
  }

  if (action.type === "dismissChecklist") {
    s.seenChecklist = true;
    return { ok: true, state: s };
  }

  if (action.type === "setSite") {
    if (s.over) return fail(original, "The run is over.");
    const site = SITES.find((x) => x.id === action.site);
    if (!site) return fail(original, "Unknown site.");
    if (s.t < idx(site.at)) return fail(original, `${site.name} is not available until ${site.at.replace("Q", " Q")}.`);
    s.site = site.id;
    return { ok: true, state: s }; // free: inspecting a campus is not an action
  }

  if (action.type === "chooseEvent") {
    if (s.over) return fail(original, "The run is over.");
    if (!s.pendingEvent) return fail(original, "No event is pending.");
    const choice = s.pendingEvent.choices.find((c) => c.id === action.choice);
    if (!choice) return fail(original, "Unknown choice.");
    const cost = eventChoiceCost(s, s.pendingEvent.id, action.choice);
    if (cost > 0 && s.cash < cost) {
      return fail(original, `That choice costs ${money(cost)}. You have ${money(s.cash)}.`);
    }
    applyEventChoice(s, s.pendingEvent.id, action.choice);
    s.pendingEvent = null;
    return { ok: true, state: s };
  }

  if (action.type === "emergency") {
    if (s.over) return fail(original, "The run is over.");
    if (!s.pendingEmergency) return fail(original, "No financing crisis is pending.");
    const d = derive(s);
    const em = s.pendingEmergency;
    if (action.choice === "default") {
      s.over = "insolvent";
      s.overActor = "player";
      s.pendingEmergency = null;
      pushEvent(s, "ending", "You declined rescue. The quarter cannot be funded. The run is over.");
      return { ok: true, state: s };
    }
    if (action.choice === "credit") {
      const rate = Math.max(s.debt.rate, em.loanRate);
      const draw = em.draw > 0 ? em.draw : emergencyDraw(em.gap, s.debt.principal, s.debt.rate, rate);
      if (em.creditAvail < draw - 1) return fail(original, "The credit line cannot cover this quarter including interest.");
      s.debt.principal += draw;
      s.debt.rate = rate;
      s.cash += draw;
      s.pendingEmergency = null;
      pushEvent(s, "finance", `Drew ${money(draw)} on the emergency line at ${(em.loanRate * 400).toFixed(0)}% APR, covering the ${money(em.gap)} shortfall plus same-quarter interest. Principal is now ${money(s.debt.principal)}.`, {
        delta: { cash: draw, debt: draw },
      });
      return { ok: true, state: s };
    }
    if (action.choice === "distressed") {
      if (!em.canDistressed) return fail(original, "No distressed round is available.");
      if (s.emergencyRaises >= 2) return fail(original, "You have already been rescued twice. There is no third time.");
      const amount = em.distressedAmount;
      const pre = valuationOf(s, d);
      const newOwn = s.ownership * (pre / Math.max(1, pre + amount * 1.6));
      s.ownership = newOwn;
      s.cash += amount;
      s.raises += 1;
      s.emergencyRaises += 1;
      s.dryPowder = Math.max(0, s.dryPowder - amount);
      s.raiseCooldown = RAISE_COOLDOWN + 2;
      s.pendingEmergency = null;
      pushEvent(
        s,
        "finance",
        `DISTRESSED RAISE ${money(amount)} at a punitive valuation. Ownership ${((original.ownership) * 100).toFixed(1)}% → ${(newOwn * 100).toFixed(1)}%. This cannot be repeated indefinitely.`,
        { delta: { cash: amount, ownership: newOwn - original.ownership } },
      );
      return { ok: true, state: s };
    }
    return fail(original, "Unknown emergency choice.");
  }

  if (action.type === "fileCampusPower") {
    if (!SITES.some((x) => x.id === action.site)) return fail(original, "Unknown campus.");
    s.site = action.site;
    const result = applyAction(s, { type: "orderPower", qty: action.qty });
    return result.ok ? result : fail(original, result.reason);
  }
  if (action.type === "specializeVenture" || action.type === "upgradeCampus" || action.type === "connectCampuses" || action.type === "runPR") {
    const q = applyExpansion(s, action);
    if (q.reason) return fail(original, q.reason);
    const where = action.type === "upgradeCampus" ? ` at ${SITE_NAMES[action.site]}` : action.type === "connectCampuses" ? ` (${SITE_NAMES[action.from]} ↔ ${SITE_NAMES[action.to]})` : "";
    pushEvent(s, "decision", `${q.name}${where} funded for ${money(q.cost)}.${q.lead ? ` Due ${arriveLabel(s.t + q.lead)}.` : ""}`);
    return { ok: true, state: s };
  }
  const blocked = needAction(s);
  if (blocked) return fail(original, blocked);

  switch (action.type) {
    case "orderChips": {
      const qty = Math.floor(action.qty);
      if (!finite(qty) || qty <= 0) return fail(original, "Order at least one accelerator.");
      if (qty > s.alloc.chips + 1e-6) return fail(original, "That exceeds this quarter's remaining chip allocation.");
      const unit = chipPrice(s.t) * chipDisc(s);
      const cost = qty * unit;
      if (s.cash < cost) return fail(original, `Need ${money(cost)}. You have ${money(s.cash)}.`);
      const lead = 2;
      const arrive = s.t + lead;
      if (arrive > LAST) {
        /* still legal, but labelled after campaign */
      }
      s.cash -= cost;
      s.alloc.chips -= qty;
      s.market.chips = Math.max(0, s.market.chips - qty);
      spendAction(s);
      s.orders.push({
        kind: "chips",
        qty,
        arrive,
        label: `${num(qty)} accelerators`,
        gen: chipGen(s.t),
        unitCost: unit,
      });
      pushEvent(
        s,
        "decision",
        `Ordered ${num(qty)} accelerators for ${money(cost)}. Arrives ${arriveLabel(arrive)}${arrive > LAST ? ". They will not operate during this campaign." : ""}. Remaining allocation ${num(s.alloc.chips)}.`,
        { delta: { cash: -cost, chipsOnOrder: qty } },
      );
      return { ok: true, state: s };
    }
    case "orderPower": {
      const qty = action.qty;
      if (!finite(qty) || qty <= 0) return fail(original, "File for a positive load.");
      if (qty > s.alloc.power + 1e-6) return fail(original, "That exceeds this quarter's remaining interconnection allocation.");
      const site = siteById(s.site);
      if (s.t < idx(site.at)) return fail(original, `${site.name} is not available yet.`);
      const unit = powerPriceAt(site.id);
      const cost = qty * unit;
      if (s.cash < cost) return fail(original, `Need ${money(cost)}.`);
      let lead = powerLeadAt(s.t, site.id);
      const stuck = chance(s, site.permitRisk * (campaignActive(s, "community") ? 0.5 : 1));
      if (stuck) lead += 2;
      const arrive = s.t + lead;
      s.cash -= cost;
      s.alloc.power -= qty;
      s.market.power = Math.max(0, s.market.power - qty);
      spendAction(s);
      if (site.id === "onsite") {
        s.reg += 2;
        s.trust = Math.max(0, s.trust - 1);
      }
      if (site.id === "abroad") s.chinaBoost += 0.08;
      s.orders.push({ kind: "power", qty, arrive, label: `${mw(qty)} · ${site.name}`, unitCost: unit, site: site.id });
      pushEvent(
        s,
        "decision",
        `Filed for ${mw(qty)} at ${site.name} for ${money(cost)}. Energized ${arriveLabel(arrive)}${arrive > LAST ? " — after the campaign ends." : ""}.${stuck ? " Permitting objection: two quarters added." : ""}${site.id === "onsite" ? " Emissions filing noted; regulation +2, trust −1." : ""}`,
        { delta: { cash: -cost } },
      );
      return { ok: true, state: s };
    }
    case "hirePerson": {
      const p = personById(action.id);
      if (!p) return fail(original, "Unknown person.");
      const where = s.people[p.id]?.where ?? "free";
      if (where === "you") return fail(original, `${p.name} is already on your roster.`);
      if (where !== "free") return fail(original, `${p.name} is at a rival. Poach instead.`);
      if (s.t < idx(p.at)) return fail(original, `${p.name} is not on the market until ${p.at.replace("Q", " Q")}.`);
      const cost = signingCost(s, p.id);
      if (s.cash < cost) return fail(original, `Signing ${p.name} costs ${money(cost)}.`);
      s.cash -= cost;
      s.people[p.id] = { where: "you", since: s.t };
      spendAction(s);
      pushEvent(s, "decision", `SIGNED ${p.name} (${p.br}) for ${money(cost)}. ${p.blurb}`, { delta: { cash: -cost } });
      return { ok: true, state: s };
    }
    case "poach": {
      const p = personById(action.id);
      if (!p) return fail(original, "Unknown person.");
      const where = s.people[p.id]?.where ?? "free";
      if (where === "you") return fail(original, `${p.name} is already on your roster.`);
      if (where === "free") return fail(original, `${p.name} is on the market. Sign instead.`);
      if (s.t < idx(p.at)) return fail(original, `${p.name} is not known to you yet.`);
      const cost = signingCost(s, p.id);
      if (s.cash < cost) return fail(original, `Poaching ${p.name} costs ${money(cost)}.`);
      const coolKey = `poach_${p.id}`;
      if ((s.flags[coolKey] ?? -1) > s.t) return fail(original, `${p.name} said no ${s.t - (s.flags[coolKey]! - POACH_COOLDOWN)} quarter(s) ago. Try again ${arriveLabel(s.flags[coolKey]!)}.`);
      const d = derive(s);
      const pc = poachChance(s, d);
      const rival = s.rivals.find((r) => r.id === where);
      spendAction(s);
      if (chance(s, pc)) {
        s.cash -= cost;
        s.people[p.id] = { where: "you", since: s.t };
        if (rival) rival.cumEff *= 0.985;
        pushEvent(s, "decision", `POACHED ${p.name} from ${rival?.name ?? where} for ${money(cost)} (${(pc * 100).toFixed(0)}% odds). ${rival?.name ?? "They"} lost a step.`, { delta: { cash: -cost } });
      } else {
        const wasted = cost * 0.35;
        s.cash -= wasted;
        s.flags[coolKey] = s.t + POACH_COOLDOWN;
        pushEvent(s, "decision", `${p.name} took the meeting, took ${rival?.name ?? where}'s counter-offer, and told everyone. ${money(wasted)} in recruiter fees, no hire (${(pc * 100).toFixed(0)}% odds).`, { delta: { cash: -wasted } });
      }
      return { ok: true, state: s };
    }
    case "orderFabric": {
      const qty = Math.floor(action.qty);
      if (!finite(qty) || qty <= 0) return fail(original, "Order a positive quantity.");
      if (qty > s.alloc.fabric + 1e-6) return fail(original, "That exceeds this quarter's remaining fabric allocation.");
      const unit = fabricPrice(s.t);
      const cost = qty * unit;
      if (s.cash < cost) return fail(original, `Need ${money(cost)}.`);
      const arrive = s.t + 3;
      s.cash -= cost;
      s.alloc.fabric -= qty;
      s.market.fabric = Math.max(0, s.market.fabric - qty);
      spendAction(s);
      s.orders.push({ kind: "fabric", qty, arrive, label: `${num(qty)} fabric`, unitCost: unit });
      pushEvent(s, "decision", `Ordered fabric for ${num(qty)} accelerators, ${money(cost)}. Arrives ${arriveLabel(arrive)}.`, {
        delta: { cash: -cost },
      });
      return { ok: true, state: s };
    }
    case "hire": {
      const n = hireCount(s);
      const cost = hireCost(s);
      if (s.cash < cost) return fail(original, `Signing costs ${money(cost)}.`);
      s.cash -= cost;
      s.researchers += n;
      spendAction(s);
      pushEvent(s, "decision", `Hired ${n} researchers for ${money(cost)} in signing costs.`, { delta: { cash: -cost, researchers: n } });
      return { ok: true, state: s };
    }
    case "buyTech": {
      const node = techById(action.id);
      if (!node) return fail(original, "Unknown research.");
      if (s.tech.includes(node.id)) return fail(original, "Already funded.");
      if (s.t < techAvailableAt(s, node)) return fail(original, `${node.name} is not available until ${arriveLabel(techAvailableAt(s, node))}.`);
      const cost = techCost(s, node);
      if (s.cash < cost) return fail(original, `Need ${money(cost)}.`);
      s.cash -= cost;
      s.tech.push(node.id);
      spendAction(s);
      if (node.action) s.actions = Math.min(s.actions + node.action, maxActions(s));
      const publishes = node.algo && node.algo > 1 && (node.br === "ARCH" || node.br === "DATA");
      if (publishes) s.papers.push({ id: node.id, at: s.t, algo: node.algo!, diffused: false });
      pushEvent(
        s,
        "research",
        `RESEARCH — ${node.name} funded, ${money(cost)}.${publishes ? " The result will be public property within five quarters." : ""}`,
        { delta: { cash: -cost } },
      );
      return { ok: true, state: s };
    }
    case "buyVenture": {
      const v = ventureById(action.id);
      if (!v) return fail(original, "Unknown venture.");
      if (s.ventures.includes(v.id) || s.construction.some((c) => c.ventureId === v.id)) {
        return fail(original, "Already acquired.");
      }
      if (s.t < idx(v.at)) return fail(original, `${v.name} is not available until ${v.at.replace("Q", " Q")}.`);
      if (s.cash < v.cost) return fail(original, `Need ${money(v.cost)}.`);
      s.cash -= v.cost;
      spendAction(s);
      const delay = v.commissionQ ?? 0;
      if (delay > 0) {
        const arrive = s.t + delay;
        s.construction.push({ id: `v-${v.id}-${s.t}`, ventureId: v.id, arrive, label: v.name });
        pushEvent(
          s,
          "decision",
          `ACQUIRED — ${v.name} for ${money(v.cost)}. Construction; commissions ${arriveLabel(arrive)}. No power or income until then.`,
          { delta: { cash: -v.cost } },
        );
      } else {
        s.ventures.push(v.id);
        if (v.powerAdd) addVenturePower(s, v.id, v.powerAdd);
        pushEvent(s, "decision", `ACQUIRED — ${v.name} for ${money(v.cost)}.`, { delta: { cash: -v.cost } });
      }
      return { ok: true, state: s };
    }
    case "raise": {
      const d = derive(s);
      const gate = canRaise(s);
      if (!gate.ok) return fail(original, gate.reason);
      const amount = raiseSize(s, d);
      if (amount < 6e6) return fail(original, "The round is too small to clear.");
      const pre = valuationOf(s, d);
      const newOwn = s.ownership * (pre / (pre + amount));
      const lostPts = (s.ownership - newOwn) * 100;
      s.cash += amount;
      s.ownership = newOwn;
      s.raises += 1;
      s.dryPowder = Math.max(0, s.dryPowder - amount * 0.65);
      s.raiseCooldown = RAISE_COOLDOWN;
      spendAction(s);
      pushEvent(
        s,
        "finance",
        `RAISED ${money(amount)} at a ${money(pre)} pre-money. You gave up ${lostPts.toFixed(2)} percentage points of the company (ownership now ${(newOwn * 100).toFixed(2)}%).`,
        { delta: { cash: amount, ownership: newOwn - original.ownership } },
      );
      return { ok: true, state: s };
    }
    case "secondary": {
      if (s.ownership <= SECONDARY_POINTS + 0.02) return fail(original, "You would drop below a 2% floor.");
      const d = derive(s);
      const proceeds = valuationOf(s, d) * SECONDARY_POINTS * ILLIQUIDITY;
      s.ownership -= SECONDARY_POINTS;
      s.personalCash += proceeds;
      spendAction(s);
      pushEvent(
        s,
        "finance",
        `Sold 2 percentage points of company equity in a secondary for ${money(proceeds)} of personal cash (18% illiquidity discount). Company cash unchanged. Stake now ${(s.ownership * 100).toFixed(2)}%.`,
        { delta: { personalCash: proceeds, ownership: -SECONDARY_POINTS } },
      );
      return { ok: true, state: s };
    }
    case "lobbyExport": {
      if (s.lobbyCooldown > 0) return fail(original, `Political capital spent (${s.lobbyCooldown}q).`);
      if (s.exportControls) return fail(original, "Export controls are already in force.");
      s.exportControls = true;
      s.exportHaircut = 0.22;
      s.lobbyCooldown = 8;
      s.reg += 4;
      s.alloc.chips *= 0.85;
      spendAction(s);
      pushEvent(
        s,
        "decision",
        "Washington. Export controls tighten: the lag abroad widens, your chip allocation this quarter and every later quarter is cut 15%, and international serving revenue takes a permanent 22% haircut.",
      );
      return { ok: true, state: s };
    }
    case "lobbyDereg": {
      if (s.lobbyCooldown > 0) return fail(original, `Political capital spent (${s.lobbyCooldown}q).`);
      s.reg = Math.max(0, s.reg - 16);
      s.trust = Math.max(0, s.trust - 5);
      s.lobbyCooldown = 6;
      spendAction(s);
      pushEvent(s, "decision", "Regulatory pressure eased by 16. It cost five points of public trust and everyone knows who paid for it.");
      return { ok: true, state: s };
    }
    case "safetyPush": {
      const cost = Math.max(4e6, s.revenue * 0.35);
      if (s.cash < cost) return fail(original, `Need ${money(cost)}.`);
      s.cash -= cost;
      s.risk = Math.max(0, s.risk - 9);
      s.preparedness += 4;
      s.trust = Math.min(100, s.trust + 6);
      spendAction(s);
      pushEvent(s, "safety", `Red-teaming and deployment review, ${money(cost)}. Hazard −9, preparedness +4, trust +6, capability unchanged.`, {
        delta: { cash: -cost, risk: -9 },
      });
      return { ok: true, state: s };
    }
    case "prepareCandidate": {
      const cap = capOf(s.cumEff);
      if (cap < 6) return fail(original, "The result is not yet a product.");
      if (s.candidate && s.candidate.cap >= cap - 0.4) return fail(original, "The sitting candidate is still current.");
      const sysLead = roster(s).find((p) => p.br === "SYS");
      s.candidate = {
        cap,
        createdAt: s.t,
        evaluated: Boolean(sysLead),
        evalNotes: sysLead
          ? `${sysLead.name}'s pipeline evaluates as it trains. The candidate arrives with its dangerous-capability profile attached.`
          : "Unevaluated. You know the loss curve, not the dangerous-capability profile.",
      };
      spendAction(s);
      pushEvent(s, "model", `Candidate cut at research capability ${cap.toFixed(1)}${sysLead ? ", pre-evaluated" : ""}. It is not deployed. Revenue and the threshold still track what you have shipped.`);
      return { ok: true, state: s };
    }
    case "evaluateCandidate": {
      if (!s.candidate) return fail(original, "No candidate to evaluate.");
      if (s.candidate.evaluated) return fail(original, "Already evaluated.");
      s.candidate.evaluated = true;
      const hazard = s.risk;
      const ready = s.tech.includes("evals") || s.tech.includes("oversight");
      s.candidate.evalNotes = ready
        ? `Evals complete. Hazard index at test time ${hazard.toFixed(0)}. Alignment pillars ${s.tech.filter((id) => TECH.find((n) => n.id === id)?.align).length}.`
        : `Shallow eval (you have not funded Dangerous Capability Evals). Hazard index ${hazard.toFixed(0)} — this is not a readiness certificate.`;
      s.preparedness += ready ? 3 : 1;
      spendAction(s);
      pushEvent(s, "model", `Evaluated the ${s.candidate.cap.toFixed(1)} candidate. ${s.candidate.evalNotes}`);
      return { ok: true, state: s };
    }
    case "deploy": {
      if (!s.candidate) return fail(original, "Cut a candidate first.");
      const cap = s.candidate.cap;
      s.deployedCap = cap;
      s.deployMode = action.mode;
      s.lastReleaseAt = s.t;
      s.releases.push({ cap, mode: action.mode, at: s.t });
      const uneval = !s.candidate.evaluated;
      if (uneval) {
        s.risk = Math.min(100, s.risk + 6);
        s.trust = Math.max(0, s.trust - 4);
      }
      if (action.mode === "broad") {
        s.flags.leakBias = (s.flags.leakBias || 0) + 1;
        s.lastBroadCap = Math.max(s.lastBroadCap, cap);
        s.lastBroadAt = s.t;
      }
      const c = s.candidate;
      s.candidate = null;
      spendAction(s);
      pushEvent(
        s,
        "model",
        action.mode === "limited"
          ? `LIMITED DEPLOYMENT of a ${cap.toFixed(1)} model${c.evaluated ? "" : " without a full evaluation"}. Serving revenue is partial; leakage and follower catch-up are slower. A limited release does not reset the clock on anything you already published broadly.`
          : `BROAD DEPLOYMENT of a ${cap.toFixed(1)} model${c.evaluated ? "" : " without a full evaluation"}. Full serving economics, and the signal to everyone else is loud.`,
      );
      return { ok: true, state: s };
    }
    default:
      return fail(original, "Unknown action.");
  }
}

void VENTURES;
void netWorthOf;
