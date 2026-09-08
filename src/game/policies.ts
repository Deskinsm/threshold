import { applyAction } from "./actions.ts";
import { PEOPLE, SITES, TECH, VENTURES, idx } from "./data.ts";
import { canRaise, chipDisc, chipPrice, derive, fabricPrice, hireCost, netWorthOf, powerPrice, powerPriceAt, signingCost, techAvailableAt } from "./economy.ts";
import { initState } from "./init.ts";
import { resolveQuarter } from "./resolve.ts";
import type { Action, BackgroundId, GameState } from "./types.ts";

function go(s: GameState, a: Action) {
  const r = applyAction(s, a);
  return r.ok ? r.state : s;
}

function drainEvent(s: GameState, pick: "first" | "last" | "mid", rescue = true) {
  let hops = 0;
  while (s.pendingEvent && hops++ < 8) {
    const choices = s.pendingEvent.choices;
    const prefer = pick === "first" ? 0 : pick === "last" ? choices.length - 1 : Math.min(1, choices.length - 1);
    const order = [choices[prefer]!, ...choices.filter((_, i) => i !== prefer)];
    let advanced = false;
    for (const c of order) {
      const next = go(s, { type: "chooseEvent", choice: c.id });
      if (next !== s && !next.pendingEvent) {
        s = next;
        advanced = true;
        break;
      }
    }
    if (!advanced) break;
  }
  if (s.pendingEmergency) {
    if (!rescue) s = go(s, { type: "emergency", choice: "default" });
    else if (s.pendingEmergency.canDistressed) s = go(s, { type: "emergency", choice: "distressed" });
    else if (s.pendingEmergency.creditAvail >= (s.pendingEmergency.draw ?? s.pendingEmergency.gap) - 1) s = go(s, { type: "emergency", choice: "credit" });
    else s = go(s, { type: "emergency", choice: "default" });
  }
  return s;
}

function maybeRaise(s: GameState) {
  const gate = canRaise(s);
  if (!gate.ok || s.actions < 1) return s;
  if (s.cash < 1.2e7 || (s.deployMode !== "none" && s.cash < 5e7 && s.raiseCooldown === 0)) {
    return go(s, { type: "raise" });
  }
  return s;
}

function buyOpenTech(s: GameState, preferAlign: boolean) {
  const nodes = [...TECH].sort((a, b) => {
    if (preferAlign) {
      const da = a.br === "ALIGN" ? 0 : 1;
      const db = b.br === "ALIGN" ? 0 : 1;
      if (da !== db) return da - db;
    }
    return a.cost - b.cost;
  });
  for (const n of nodes) {
    if (s.actions < 1) break;
    if (s.tech.includes(n.id)) continue;
    if (s.t < techAvailableAt(s, n)) continue;
    if (s.cash < n.cost) continue;
    s = go(s, { type: "buyTech", id: n.id });
  }
  return s;
}

function buyVentures(s: GameState) {
  for (const v of VENTURES) {
    if (s.actions < 1) break;
    if (s.ventures.includes(v.id) || s.construction.some((c) => c.ventureId === v.id)) continue;
    if (s.t < idx(v.at)) continue;
    if (s.cash < v.cost) continue;
    s = go(s, { type: "buyVenture", id: v.id });
  }
  return s;
}

/** Buy whatever is binding, at the engine's actual prices (the previous version hard-coded 2012 prices and silently failed after ~2020). */
function buyConstraint(s: GameState) {
  const d = derive(s);
  if (s.actions < 1) return s;
  const budget = s.cash * 0.45;
  if (d.bottleneck === "power" && s.alloc.power > 0.05) {
    const qty = Math.min(s.alloc.power * 0.85, budget / powerPriceAt(s.site));
    if (qty > 0.05) return go(s, { type: "orderPower", qty });
  }
  if (d.bottleneck === "fabric" && s.alloc.fabric > 1) {
    const qty = Math.min(Math.floor(s.alloc.fabric * 0.6), Math.floor(budget / fabricPrice(s.t)));
    if (qty > 0) return go(s, { type: "orderFabric", qty });
  }
  if (s.alloc.chips > 1) {
    const unit = chipPrice(s.t) * chipDisc(s);
    const qty = Math.min(Math.floor(s.alloc.chips * 0.85), Math.floor(budget / unit));
    if (qty > 0) return go(s, { type: "orderChips", qty });
  }
  return s;
}

function ship(s: GameState, mode: "limited" | "broad") {
  const d = derive(s);
  if (s.actions < 1) return s;
  if (!s.candidate && d.researchCap >= 6 && d.researchCap >= s.deployedCap + 1.2) {
    s = go(s, { type: "prepareCandidate" });
  }
  if (s.candidate && !s.candidate.evaluated && s.actions > 0) s = go(s, { type: "evaluateCandidate" });
  if (s.candidate && s.actions > 0) s = go(s, { type: "deploy", mode });
  return s;
}

export type PolicyOpts = { site?: GameState["site"]; people?: boolean };

/** Sign any free named person you can afford, then try one poach if you lead the frontier. */
function recruit(s: GameState, tried: Set<string>) {
  for (const p of PEOPLE) {
    if (s.actions < 1) break;
    const st = s.people[p.id];
    if (!st || st.where === "you" || s.t < idx(p.at) || tried.has(p.id)) continue;
    const cost = signingCost(s, p.id);
    if (s.cash < cost * 3) continue;
    tried.add(p.id);
    if (st.where === "free") s = go(s, { type: "hirePerson", id: p.id });
    else if (derive(s).researchCap >= derive(s).frontier - 0.5) s = go(s, { type: "poach", id: p.id });
  }
  return s;
}

export function runPolicy(
  name: "frontier" | "infra" | "cautious" | "passive" | "sprint",
  seed: number,
  opts: PolicyOpts = {},
): GameState {
  const bg: BackgroundId =
    name === "infra" ? "infra" : name === "sprint" || name === "frontier" ? "research" : "enterprise";
  let s = initState({ seed, background: name === "passive" ? "research" : bg });
  if (name === "passive") {
    let guard = 0;
    while (!s.over && guard++ < 200) {
      s = drainEvent(s, "first", false);
      if (s.over) break;
      const t0 = s.t;
      s = resolveQuarter(s, { stochastic: true });
      if (s.t === t0 && !s.over) {
        s = drainEvent(s, "first", false);
        continue;
      }
    }
    return s;
  }
  let guard = 0;
  const tried = new Set<string>();
  while (!s.over && guard++ < 200) {
    s = drainEvent(s, name === "cautious" ? "first" : "mid");
    if (opts.people) s = recruit(s, tried); // one attempt per person, ever: eight actions across the campaign
    if (s.over) break;
    if (name === "frontier" || name === "sprint") s = go(s, { type: "setTrainShare", share: name === "sprint" ? 0.86 : 0.78 });
    else if (name === "infra") s = go(s, { type: "setTrainShare", share: 0.22 });
    else s = go(s, { type: "setTrainShare", share: 0.45 });

    s = maybeRaise(s);
    if (opts.site && s.t >= idx(SITES.find((x) => x.id === opts.site)!.at)) s = go(s, { type: "setSite", site: opts.site });
    if (name === "sprint") {
      const d0 = derive(s);
      if (d0.researchCap >= 88 && s.tech.includes("oversight") && s.tech.includes("control")) {
        s = ship(s, "limited");
      } else if (d0.researchCap < 88) {
        s = ship(s, "limited");
      }
      s = buyOpenTech(s, true);
      if (s.risk > 40 && s.actions > 0 && s.cash > Math.max(4e6, s.revenue * 0.35)) s = go(s, { type: "safetyPush" });
      if (s.cash > 6e6) s = buyConstraint(s);
      if (s.actions > 0 && s.cash > hireCost(s) * 2) s = go(s, { type: "hire" });
    } else {
      if (name === "frontier") s = ship(s, derive(s).researchCap >= 55 ? "broad" : "limited");
      else if (name === "infra") s = ship(s, "broad");
      else s = ship(s, "limited");
      if (name === "infra") s = buyVentures(s);
      s = buyOpenTech(s, name !== "infra");
      if (name === "cautious" && s.risk > 30 && s.actions > 0 && s.cash > Math.max(4e6, s.revenue * 0.35)) {
        s = go(s, { type: "safetyPush" });
      }
      if (s.cash > 8e6) s = buyConstraint(s);
      if (s.actions > 0 && s.cash > hireCost(s) * 2.5 && name !== "infra") s = go(s, { type: "hire" });
      if (name === "infra") s = buyVentures(s);
    }


    const t0 = s.t;
    s = resolveQuarter(s, { stochastic: true });
    if (s.t === t0 && !s.over) {
      s = drainEvent(s, name === "cautious" ? "first" : "mid");
      continue;
    }
  }
  return s;
}

export function summarize(s: GameState) {
  const d = derive(s);
  return {
    over: s.over,
    actor: s.overActor,
    t: s.t,
    cap: d.researchCap,
    deployed: s.deployedCap,
    china: s.chinaCap,
    nw: netWorthOf(s, d),
    cash: s.cash,
    own: s.ownership,
    raises: s.raises,
  };
}
