import { addVenturePower, SITE_NAMES } from "./expansion.ts";
import {
  BAD_RISK,
  CAPITAL_WIN,
  CONTROLLED_RISK,
  CHIPS_PER_MW,
  DIFFUSION_LAG,
  DIFFUSION_POWER,
  FLEET_DECAY,
  FLEET_RETIRE,
  LAST,
  TECH,
  THRESHOLD_CAP,
  TIMELINE,
  WIRE,
  REAL_HISTORY_ENDS,
  PEOPLE,
  idx,
} from "./data.ts";
import {
  algoMult,
  alignScore,
  capOf,
  cashInsolvent,
  cumEffOf,
  chipGen,
  chipPrice,
  creditAvail,
  demandIndex,
  derive,
  emergencyDraw,
  fabricMult,
  fabricPrice,
  flagActive,
  fleetMult,
  founderPaper,
  hazardMod,
  hasTech,
  interestOf,
  marketPrice,
  maxActions,
  netWorthOf,
  opexOf,
  playerAlloc,
  powerPrice,
  revenueOf,
  rivalAlgo,
  roundCash,
  shocksAt,
  supplyAt,
  talentMult,
  TRAIN_SCALE,
  trainYield,
  valuationOf,
  ventureIncome,
} from "./economy.ts";
import { clone, clamp, money, mw, num } from "./format.ts";
import { initAlloc, initMarket } from "./init.ts";
import { pushEvent } from "./log.ts";
import { chance, nextRand } from "./rng.ts";
import { maybeQueueEvent } from "./events.ts";
import type { CrossingRecord, EmergencyOffer, EndingId, GameState, Resolution } from "./types.ts";

export type ResolveOpts = { stochastic?: boolean };

function rivalLive(r: GameState["rivals"][number]) {
  const powerCap = r.mwSecured * CHIPS_PER_MW;
  const fabCap = r.fabric;
  return Math.max(0, Math.min(r.chips, powerCap, fabCap));
}

/**
 * Rivals bid into the same contested pool you draw from, most aggressive first.
 * What you bought this quarter is already gone from s.market; what you left is theirs.
 */
function tickRivals(s: GameState, frontier: number, stochastic: boolean) {
  const t = s.t;
  const retire = FLEET_RETIRE;
  const algo = rivalAlgo(s, t);
  // Pro-rata rationing: every rival's chip appetite is scaled by the same factor when the pool is short.
  const appetites = s.rivals.map((r) => Math.min((r.cash * 0.42 * r.aggr) / chipPrice(t), supplyAt(t, "chips") * 0.072 * r.aggr));
  const totalAppetite = appetites.reduce((a, b) => a + b, 0);
  const ration = totalAppetite > 0 ? Math.min(1, s.market.chips / totalAppetite) : 0;
  const order = [...s.rivals].sort((a, b) => b.aggr - a.aggr);
  for (const r of order) {
    const live = rivalLive(r);
    const rEff = live * r.fleet * 0.9;
    const trainShare = 1 - r.serveBias;
    r.cumEff += rEff * trainShare * algo * (TRAIN_SCALE * 0.18);
    const cap = capOf(r.cumEff);

    if (r.id === "helios") {
      if (t < r.freezeUntil) {
        // exclusive-end regulatory pause after a rushed deployment
      } else if (cap > r.deployedCap + 0.8) {
        r.deployedCap = cap;
        r.lastReleaseAt = t;
        const pInc = 0.025 + Math.max(0, cap - 55) * 0.0035;
        if (stochastic && chance(s, pInc)) {
          r.freezeUntil = t + 3; // exclusive-end: pause the next two quarters
          r.deployedCap = Math.max(0, r.deployedCap - 1.5);
          r.cumEff *= 0.97;
          pushEvent(s, "rival", `HELIOS shipped a ${cap.toFixed(1)} model without evaluating it and something broke in public. Deployment rolled back, two quarters of regulatory pause, and every lab's hearing calendar just filled up.`, { actor: "helios" });
          s.reg += 3;
        }
      }
    } else if (r.id === "aegis") {
      if (cap > r.deployedCap + 2 && t - r.lastReleaseAt >= 2) {
        r.deployedCap = cap - 0.4;
        r.lastReleaseAt = t;
      }
    } else if (r.id === "meridian") {
      if (cap > r.deployedCap + 1.5) {
        r.deployedCap = cap * 0.96;
        r.lastReleaseAt = t;
      }
    } else if (r.id === "commons") {
      // Immutable release ledger: a later limited drop cannot postpone an already-public broad model.
      const due = s.releases.filter((rel) => rel.mode === "broad" && t - rel.at >= 2);
      const distillTarget = due.length ? Math.max(...due.map((rel) => rel.cap)) - 2.5 : 0;
      const scheduled = t > 20 && t % 7 === 3;
      const chasing = distillTarget > r.openTier + 3 && t - r.lastReleaseAt >= 2;
      if (scheduled || chasing) {
        const tier = Math.max(cap, chasing ? distillTarget : 0);
        const jump = Math.max(0, tier - r.openTier);
        r.deployedCap = Math.max(r.deployedCap, tier);
        r.openTier = tier;
        s.commonsOpenTier = Math.max(s.commonsOpenTier, tier);
        r.lastReleaseAt = t;
        if (chasing && tier > cap + 0.5) r.cumEff = Math.max(r.cumEff, cumEffOf(tier));
        pushEvent(
          s,
          "rival",
          chasing
            ? `THE COMMONS has released open weights at ${tier.toFixed(1)} — a distillation of the model you shipped broadly. The tier below you is now free, and the programme abroad just got a checkpoint.`
            : "THE COMMONS has released open weights. Everything at or below that tier is now free.",
          { actor: "commons" },
        );
        s.chinaBoost += 0.35 + Math.min(1.2, jump * 0.12);
      } else if (cap > r.deployedCap + 2) {
        r.deployedCap = cap * 0.9;
      }
    }

    const serveEff = live * r.serveBias * r.fleet;
    const distro = r.id === "meridian" ? 1.45 : 1;
    r.revenue = serveEff * marketPrice(t) * demandIndex(frontier, t) * 0.75 * distro;
    r.cash += r.revenue - live * 520;

    const appetite = appetites[s.rivals.indexOf(r)]!;
    const buy = Math.min(appetite * ration, s.market.chips);
    if (buy > 1) {
      const total = r.chips + buy;
      r.fleet = total > 0 ? (r.chips * r.fleet + buy * chipGen(t)) / total : chipGen(t);
      r.chips = total;
      r.cash -= buy * chipPrice(t);
      s.market.chips -= buy;
    }
    if (r.chips > r.mwSecured * CHIPS_PER_MW) {
      const need = (r.chips - r.mwSecured * CHIPS_PER_MW) / CHIPS_PER_MW;
      const buyMw = Math.min(need * 0.22 * r.aggr, supplyAt(t, "power") * 0.05 * r.aggr, r.cash / powerPrice(), s.market.power);
      if (buyMw > 0.05) {
        r.mwSecured += buyMw;
        r.cash -= buyMw * powerPrice();
        s.market.power -= buyMw;
      }
    }
    if (r.chips > r.fabric) {
      const need = r.chips - r.fabric;
      const buyF = Math.min(need * 0.45 * r.aggr, supplyAt(t, "fabric") * 0.14 * r.aggr, r.cash / fabricPrice(t), s.market.fabric);
      if (buyF > 1) {
        r.fabric += buyF;
        r.cash -= buyF * fabricPrice(t);
        s.market.fabric -= buyF;
      }
    }

    r.chips *= 1 - retire;
    r.fleet *= FLEET_DECAY;
    const lead = frontier - cap;
    if (lead > 9) r.cumEff *= 1.04;
    void stochastic;
  }
}

function tickChina(s: GameState, frontier: number, dDeployed: number, stochastic: boolean) {
  const t = s.t;
  const independent = 0.09 + 0.0045 * t + (t > 52 ? 0.12 : 0) + (s.exportControls ? 0.06 : 0);
  s.chinaCap += independent;

  const releasedSignal = Math.max(0, dDeployed - 8);
  const baseLag = 12.5 - clamp(frontier / 10, 0, 6) - s.chinaBoost;
  const lag = clamp(baseLag + (s.exportControls ? 4.2 : 0), 0.4, 16);
  const followTarget = Math.max(s.chinaCap, frontier - lag);
  if (followTarget > s.chinaCap) {
    s.chinaCap += (followTarget - s.chinaCap) * 0.22;
  }

  const canLeak =
    s.deployMode !== "none" &&
    s.deployedCap >= frontier - 3 &&
    s.deployedCap >= 20 &&
    t > 16;
  const p = 0.05 + (s.exportControls ? 0.03 : 0) + (s.deployMode === "broad" ? 0.03 : 0) + (s.flags.leakBias || 0) * 0.02;
  if (stochastic && canLeak && chance(s, p)) {
    s.chinaBoost += 0.55;
    s.espionageEvents += 1;
    pushEvent(
      s,
      "rival",
      "A frontier result you actually shipped has appeared abroad within the quarter. Distillation, departure, or theft — the lag closes.",
      { actor: "china" },
    );
  } else if (!stochastic) {
    void releasedSignal;
  }
}

/** Compute overhang: a result you funded becomes everyone's result after DIFFUSION_LAG quarters. */
function tickDiffusion(s: GameState, notes: string[]) {
  for (const p of s.papers) {
    if (p.diffused || s.t - p.at < DIFFUSION_LAG) continue;
    p.diffused = true;
    const gain = Math.pow(p.algo, DIFFUSION_POWER);
    s.diffusedAlgo *= gain;
    s.chinaBoost += 0.25;
    const name = TECH.find((n) => n.id === p.id)?.name ?? p.id;
    const msg = `${name} has been reproduced by every lab that matters. Their installed base just got ${((gain - 1) * 100).toFixed(0)}% more useful; so did the one abroad.`;
    notes.push(msg);
    pushEvent(s, "research", msg, { actor: "field" });
  }
}

/** Researchers move toward whoever is winning. */
function tickTalent(s: GameState, d: ReturnType<typeof derive>, notes: string[]) {
  const bestShipped = Math.max(...s.rivals.map((r) => r.deployedCap));
  const leader = s.rivals.reduce((a, b) => (b.deployedCap > a.deployedCap ? b : a));
  let flow = 0;
  if (bestShipped > d.researchCap + 6 && s.researchers >= 20 && s.t % 2 === 0) {
    const lost = Math.max(1, Math.round(s.researchers * 0.02));
    s.researchers -= lost;
    flow -= lost;
    leader.cumEff *= 1.006;
    if (s.t % 4 === 0) notes.push(`${lost} researchers left for ${leader.name}. Its shipped model leads your research by ${(bestShipped - d.researchCap).toFixed(1)} points, and people go where the frontier is.`);
  } else if (d.researchCap >= d.frontier - 0.5 && s.researchers >= 6) {
    const gained = Math.max(1, Math.round(s.researchers * 0.012));
    s.researchers += gained;
    flow += gained;
  }
  s.talentFlow += flow;

  // Named people move too. A rival that leads you by 5+ tries for one of yours; nobody sits on the market forever.
  const yours = PEOPLE.filter((p) => s.people[p.id]?.where === "you" && s.t - (s.people[p.id]?.since ?? 0) >= 4);
  if (yours.length > 0 && bestShipped > d.researchCap + 5 && s.t % 3 === 0) {
    const pTake = clamp(0.12 + (bestShipped - d.researchCap) * 0.02, 0.1, 0.4);
    if (chance(s, pTake)) {
      const p = yours[Math.floor(nextRand(s) * yours.length)]!;
      s.people[p.id] = { where: leader.id, since: s.t };
      leader.cumEff *= 1.02;
      notes.push(`${p.name} left for ${leader.name}. Their ${p.br} work goes with them, and so does that branch's research discount.`);
    }
  }
  const free = PEOPLE.filter((p) => s.people[p.id]?.where === "free" && s.t >= idx(p.at) + 3);
  if (free.length > 0 && s.t % 2 === 1 && chance(s, 0.18)) {
    const p = free[0]!;
    const r = s.rivals[Math.floor(nextRand(s) * s.rivals.length)]!;
    s.people[p.id] = { where: r.id, since: s.t };
    notes.push(`${r.name} signed ${p.name}. They were on the market for ${s.t - idx(p.at)} quarters and you did not call.`);
  }
}

function endingFromSafety(s: GameState, hazardAtDeploy: number): EndingId {
  const controlled =
    hasTech(s, "oversight") &&
    hasTech(s, "control") &&
    alignScore(s) >= 4 &&
    hazardAtDeploy < CONTROLLED_RISK;
  if (controlled) return "asi_controlled";
  if (hazardAtDeploy > BAD_RISK) return "asi_bad";
  return "asi_ambiguous";
}

/**
 * One adjudicator. Order:
 * 1. State programme if it crossed (documented same-quarter precedence).
 * 2. Highest-capability remaining contender. An insolvent player is ineligible.
 * 3. Player insolvency.
 * 4. Capital (solvent, debt below 70% of valuation).
 * 5. Calendar, only after Q4 2030 has been operated (t > LAST).
 *
 * Hazard used for a player threshold ending is the snapshot from BEFORE incident recovery.
 */
function applyEndings(s: GameState, hazardAtOps: number, crossedThisQuarter: { id: string; cap: number }[]) {
  if (s.over) return;

  const record: CrossingRecord = {
    t: s.t,
    contenders: crossedThisQuarter.slice(),
    winner: null,
    winnerCap: 0,
    reason: "none",
    hazardAtOps,
  };

  const china = crossedThisQuarter.find((c) => c.id === "china");
  const rest = crossedThisQuarter
    .filter((c) => c.id !== "china")
    .sort((a, b) => b.cap - a.cap || a.id.localeCompare(b.id));
  const solvent = !cashInsolvent(s.cash);
  const eligible = rest.filter((c) => c.id !== "player" || solvent);

  if (china) {
    s.over = "china";
    s.overActor = "china";
    record.winner = "china";
    record.winnerCap = china.cap;
    record.reason = "state-programme-precedence";
    s.crossing = record;
    return;
  }

  if (eligible[0]) {
    const w = eligible[0];
    record.winner = w.id;
    record.winnerCap = w.cap;
    if (w.id === "player") {
      record.reason = rest[0] && rest[0].id !== "player" ? "player-highest-among-eligible" : "player-threshold";
      s.over = endingFromSafety(s, hazardAtOps);
      s.overActor = "player";
    } else {
      record.reason = rest.some((c) => c.id === "player") && !solvent
        ? "player-insolvent-rival-takes"
        : "highest-capability";
      s.over = "rival";
      s.overActor = w.id;
    }
    s.crossing = record;
    return;
  }

  if (cashInsolvent(s.cash)) {
    s.over = "insolvent";
    s.overActor = "player";
    record.reason = rest.some((c) => c.id === "player") ? "player-crossed-insolvent" : "insolvent";
    if (record.reason === "player-crossed-insolvent") {
      pushEvent(s, "ending", "You crossed the research threshold and the payroll in the same quarter. An insolvent lab does not get to deploy.");
    }
    s.crossing = record;
    return;
  }

  const d = derive(s);
  const paper = founderPaper(s, d);
  if (paper >= CAPITAL_WIN && s.cash >= 0 && s.debt.principal < valuationOf(s, d) * 0.7) {
    s.over = "capital";
    s.overActor = "player";
    record.reason = "capital";
    s.crossing = record;
    return;
  }

  if (s.t > LAST) {
    s.over = "timeout";
    s.overActor = null;
    record.reason = "timeout";
    s.crossing = record;
  }
}

function makeEmergency(s: GameState, gap: number): EmergencyOffer {
  const d = derive(s);
  const credit = creditAvail(s, d);
  const distressedOk = s.emergencyRaises < 2 && s.raises < 10 && s.dryPowder > 6e6;
  const distressedAmount = Math.max(gap * 1.15, 8e6);
  const loanRate = 0.09;
  const rate = Math.max(s.debt.rate, loanRate);
  const draw = emergencyDraw(gap, s.debt.principal, s.debt.rate, rate);
  return {
    gap,
    draw,
    creditAvail: credit,
    canDistressed: distressedOk,
    distressedAmount,
    loanRate,
  };
}

export function simulateQuarter(state: GameState, opts: ResolveOpts = {}): GameState {
  const s = clone(state);
  runOps(s, { stochastic: opts.stochastic === true, commitEndings: false });
  return s;
}

export function resolveQuarter(state: GameState, opts: ResolveOpts = {}): GameState {
  const stochastic = opts.stochastic !== false;
  if (state.over) return state;
  if (state.pendingEvent) return state;
  if (state.pendingEmergency) return state;

  const preview = simulateQuarter(state, { stochastic: false });
  if (cashInsolvent(preview.cash)) {
    const gap = Math.max(0, -preview.cash);
    const em = makeEmergency(state, gap);
    const s = clone(state);
    if (em.creditAvail + 1 < em.draw && !em.canDistressed) {
      const doomed = clone(state);
      runOps(doomed, { stochastic, commitEndings: true });
      if (!doomed.over) {
        doomed.over = "insolvent";
        doomed.overActor = "player";
      }
      doomed.pendingEmergency = null;
      if (doomed.over === "insolvent") {
        pushEvent(doomed, "ending", "Cash is gone and no one will fund the gap. The run ends.");
      }
      return doomed;
    }
    s.pendingEmergency = em;
    pushEvent(
      s,
      "finance",
      `This quarter would end ${money(preview.cash)} in the red. A draw of ${money(em.draw)} covers the shortfall plus same-quarter interest. Emergency financing is required before it can be committed.`,
    );
    return s;
  }

  const s = clone(state);
  runOps(s, { stochastic, commitEndings: true });
  return s;
}

function runOps(s: GameState, opts: { stochastic: boolean; commitEndings: boolean }) {
  const notes: string[] = [];
  const deliveries: string[] = [];
  const t = s.t;
  const cashBefore = s.cash;
  const d0 = derive(s);
  const capBefore = d0.researchCap;
  const deployedBefore = s.deployedCap;
  const hazardAtOps = s.risk;

  if (flagActive(s, "downtimeUntil")) {
    notes.push("Incident response: 40% of live compute is offline this quarter. Ownership is unchanged.");
  }
  if (s.flags.hyperUntil && s.t >= s.flags.hyperUntil) {
    s.hyperscaler = s.hyperscaler === "accepted" ? "refused" : s.hyperscaler;
    s.flags.hyperUntil = 0;
  }

  const d = derive(s);
  const yieldTrain = trainYield(s, d);
  s.cumEff += yieldTrain;

  s.lastRevenue = s.revenue;
  const d2 = derive(s);
  s.revenue = revenueOf(s, d2);
  s.opex = opexOf(s, d2);
  const vInc = ventureIncome(s, d2);
  const interest = interestOf(s);
  s.cash += s.revenue + vInc - s.opex - interest;
  if (s.debt.principal > 0) {
    const pay = Math.min(s.debt.principal * 0.04, Math.max(0, s.cash * 0.08));
    s.debt.principal = Math.max(0, s.debt.principal - pay);
    s.cash -= pay;
  }

  const cyc = Math.sin(t / 5.5) * 4 + Math.sin(t / 2.3) * 2;
  s.multiple = clamp(14 + cyc + (d2.researchCap >= d2.frontier - 0.5 ? 5 : 0) - s.reg / 12, 5, 34);

  tickRivals(s, d2.frontier, opts.stochastic);
  // The programme abroad follows what has been SHIPPED, not what sits in your lab. An unreleased run is not a signal.
  const shippedFrontier = Math.max(s.deployedCap, s.commonsOpenTier, ...s.rivals.map((r) => r.deployedCap));
  tickChina(s, shippedFrontier, s.deployedCap, opts.stochastic);
  tickDiffusion(s, notes);
  tickTalent(s, d2, notes);

  const capNow = capOf(s.cumEff);
  const capGrowth = capNow - capBefore;
  const deployedHazard = s.deployMode === "none" ? 0.35 : s.deployMode === "limited" ? 0.75 : 1;
  let riskDelta = capGrowth * 1.15 + s.trainShare * 0.9 + Math.max(0, s.deployedCap - 50) * 0.08 * deployedHazard - 1.1;
  s.risk = clamp(s.risk + riskDelta * hazardMod(s), 0, 100);

  let incident = false;
  const pInc = s.risk / 420;
  if (opts.stochastic && chance(s, pInc)) {
    incident = true;
    s.incidents += 1;
    const sev = 6 + nextRand(s) * 14;
    s.trust = clamp(s.trust - sev, 0, 100);
    s.reg += sev * 0.9;
    s.risk = clamp(s.risk * 0.55, 0, 100);
    const aegis = s.rivals.find((r) => r.id === "aegis");
    if (aegis) aegis.cumEff *= 1.03;
    if (s.researchers > 12) {
      const poached = Math.max(2, Math.round(s.researchers * 0.06));
      s.researchers -= poached;
      s.talentFlow -= poached;
      notes.push(`${poached} researchers resigned in the week after the incident. AEGIS hired most of them.`);
    }
    const alignOnStaff = PEOPLE.filter((p) => p.br === "ALIGN" && s.people[p.id]?.where === "you");
    if (alignOnStaff.length > 0 && chance(s, 0.5)) {
      const p = alignOnStaff[0]!;
      s.people[p.id] = { where: "aegis", since: s.t };
      notes.push(`${p.name} resigned publicly and joined AEGIS. The statement did not mention you by name. It did not need to.`);
    }
    notes.push(
      `INCIDENT. A deployed system of yours has caused real harm. Trust −${sev.toFixed(0)}, regulation up. Hazard is lower after the response — that does not rewrite the crossing you already made.`,
    );
    pushEvent(s, "incident", notes[notes.length - 1]!);
  } else {
    s.trust = clamp(s.trust + 1.1, 0, 100);
    s.reg = Math.max(0, s.reg - 0.8);
  }

  const crossed: { id: string; cap: number }[] = [];
  if (s.deployedCap >= THRESHOLD_CAP) {
    crossed.push({ id: "player", cap: s.deployedCap });
  }
  if (s.chinaCap >= THRESHOLD_CAP) crossed.push({ id: "china", cap: s.chinaCap });
  for (const r of s.rivals) {
    if (r.deployedCap >= THRESHOLD_CAP) crossed.push({ id: r.id, cap: r.deployedCap });
  }

  if (d.idleChips > 1) s.idleChipQuarters += 1;
  if (d.bottleneck === s.currentBottleneckRun.kind) {
    s.currentBottleneckRun.quarters += 1;
  } else {
    s.currentBottleneckRun = { kind: d.bottleneck, start: t, quarters: 1 };
  }
  if (s.currentBottleneckRun.quarters > s.longestBottleneck.quarters) {
    s.longestBottleneck = { ...s.currentBottleneckRun };
  }

  s.chips *= 1 - FLEET_RETIRE;
  s.fleet *= FLEET_DECAY;

  const tFrom = t;
  s.t = t + 1;

  const arrived = s.orders.filter((o) => o.arrive <= s.t);
  for (const o of arrived) {
    if (o.kind === "chips") {
      const total = s.chips + o.qty;
      s.fleet = total > 0 ? (s.chips * s.fleet + o.qty * (o.gen ?? chipGen(tFrom))) / total : (o.gen ?? 1);
      s.chips = total;
      const msg = `${num(o.qty)} accelerators energized (gen ${(o.gen ?? 1).toFixed(1)}x).`;
      deliveries.push(msg);
      pushEvent(s, "delivery", msg);
    } else if (o.kind === "power") {
      s.mwSecured += o.qty;
      const site = o.site ?? "east";
      s.mwBySite[site] = (s.mwBySite[site] ?? 0) + o.qty;
      const msg = `${mw(o.qty)} energized at ${site === "east" ? "the grid corridor" : site === "south" ? "the cheap-power campus" : site === "onsite" ? "your own turbines" : "the partner campus abroad"}.`;
      deliveries.push(msg);
      pushEvent(s, "delivery", msg);
    } else if (o.kind === "fabric") {
      s.fabric += o.qty;
      const msg = `${num(o.qty)} units of fabric installed.`;
      deliveries.push(msg);
      pushEvent(s, "delivery", msg);
    }
  }
  s.orders = s.orders.filter((o) => o.arrive > s.t);

  const doneBuild = s.construction.filter((c) => c.arrive <= s.t);
  for (const c of doneBuild) {
    if (!s.ventures.includes(c.ventureId)) s.ventures.push(c.ventureId);
    const v = { smr: { power: 3200, note: "Modular reactors came online — 3.2 GW that does not compete with anyone else's queue." } } as Record<string, { power: number; note: string }>;
    if (c.ventureId === "smr") {
      addVenturePower(s, "smr", 3200);
      deliveries.push(v.smr.note);
      pushEvent(s, "delivery", v.smr.note);
    }
  }
  s.construction = s.construction.filter((c) => c.arrive > s.t);

  for (const p of s.expansion.cooling.filter((x) => x.arrive === s.t)) {
    const msg = `Cooling retrofit commissioned at ${SITE_NAMES[p.site]}.`;
    deliveries.push(msg); pushEvent(s, "delivery", msg);
  }
  for (const p of s.expansion.links.filter((x) => x.arrive === s.t)) {
    const msg = `Interconnect online: ${SITE_NAMES[p.from]} ↔ ${SITE_NAMES[p.to]}.`;
    deliveries.push(msg); pushEvent(s, "delivery", msg);
  }
  if (s.expansion.pr && s.expansion.pr.until === s.t) pushEvent(s, "world", "The public-relations campaign's temporary effects have ended.");
  s.actions = maxActions(s);
  if (s.lobbyCooldown > 0) s.lobbyCooldown -= 1;
  if (s.raiseCooldown > 0) s.raiseCooldown -= 1;
  s.dryPowder = Math.min(2.4e11, s.dryPowder + 1.1e9);

  if (s.t <= LAST) {
    s.market = initMarket(s.t);
    s.alloc = initAlloc(s.t, s.exportControls);
    if (flagActive(s, "packBoostUntil")) s.alloc.chips *= 1.6;
    if (flagActive(s, "packCutUntil")) s.alloc.chips *= 0.7;
    if (flagActive(s, "noChipsUntil")) s.alloc.chips = 0;
  } else {
    s.alloc = { chips: 0, power: 0, fabric: 0 };
    s.market = { chips: 0, power: 0, fabric: 0 };
  }

  if (s.t <= LAST) {
    const key = TIMELINE[s.t]?.key;
    if (key && WIRE[key]) {
      for (const w of WIRE[key]) {
        pushEvent(s, "world", w.text);
        notes.push(w.text);
      }
    }
    for (const sh of shocksAt(s.t)) {
      if (!s.seen.includes(sh.id)) {
        s.seen.push(sh.id);
        pushEvent(s, "shock", "SUPPLY — " + sh.note);
        notes.push("SUPPLY — " + sh.note);
      }
    }
  }

  if (opts.stochastic) maybeQueueEvent(s);

  s.cash = roundCash(s.cash);

  const dF = derive(s);
  const nw = netWorthOf(s, dF);
  s.peakNW = Math.max(s.peakNW, nw);
  s.history.push({
    t: Math.min(s.t, LAST),
    cap: dF.researchCap,
    deployed: s.deployedCap,
    nw,
    cash: s.cash,
    china: s.chinaCap,
    rivals: s.rivals.map((r) => capOf(r.cumEff)),
    bottleneck: dF.bottleneck,
  });

  const resolution: Resolution = {
    tFrom,
    tTo: s.t,
    revenue: s.revenue,
    opex: s.opex,
    ventureIncome: vInc,
    interest,
    net: s.revenue + vInc - s.opex - interest,
    capBefore,
    capAfter: dF.researchCap,
    deployedBefore,
    cashBefore,
    cashAfter: s.cash,
    deliveries,
    incident,
    notes,
  };
  s.lastResolution = resolution;

  if (opts.commitEndings) applyEndings(s, hazardAtOps, crossed);

  void REAL_HISTORY_ENDS;
  void talentMult;
  void algoMult;
  void fabricMult;
  void fleetMult;
}

export function tryAdvance(state: GameState, opts?: ResolveOpts): GameState {
  return resolveQuarter(state, opts);
}
