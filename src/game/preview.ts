import { LAST, TIMELINE, arriveLabel } from "./data.ts";
import {
  derive,
  exhaustQuarter,
  interestOf,
  opexOf,
  revenueOf,
  trainYield,
  capOf,
  ventureIncome,
} from "./economy.ts";
import { clone } from "./format.ts";
import { simulateQuarter } from "./resolve.ts";
import type { Forecast, GameState } from "./types.ts";

export function previewQuarter(state: GameState): Forecast {
  const before = derive(state);
  const sim = simulateQuarter(clone(state), { stochastic: false });
  const after = derive(sim);
  const net = sim.lastResolution?.net ?? 0;
  const deliveriesNext = state.orders.filter((o) => o.arrive === state.t + 1);
  const commissionsNext = state.construction.filter((c) => c.arrive === state.t + 1);
  const assumptions = [
    "No incidents, leakage, or choice events.",
    "Rivals bid into the remaining contested pool after your orders this quarter.",
    "Rivals receive power and fabric without your order lead times — a scenario advantage.",
    "Training uses currently live compute — pending deliveries install at the start of next quarter.",
  ];
  if (state.candidate) assumptions.push("A sitting candidate is not deployed unless you ship it.");
  return {
    cashBefore: state.cash,
    revenue: sim.lastResolution?.revenue ?? revenueOf(state, before),
    opex: sim.lastResolution?.opex ?? opexOf(state, before),
    ventureIncome: sim.lastResolution?.ventureIncome ?? ventureIncome(state, before),
    interest: sim.lastResolution?.interest ?? interestOf(state),
    net,
    cashAfter: sim.cash,
    capBefore: before.researchCap,
    capAfter: after.researchCap,
    capDelta: after.researchCap - before.researchCap,
    live: before.live,
    bottleneck: before.bottleneck,
    deliveriesNext,
    commissionsNext,
    runwayQuarters: net >= 0 ? null : state.cash <= 0 ? 0 : Math.max(0, Math.floor(state.cash / Math.max(1, -net))),
    exhaustQuarter: exhaustQuarter(state, before),
    wouldInsolvent: sim.over === "insolvent" || sim.pendingEmergency != null || sim.cash < 0,
    assumptions,
  };
}

export function previewTrainShare(state: GameState, share: number): Forecast {
  const s = clone(state);
  s.trainShare = share;
  return previewQuarter(s);
}

export function multiQuarterCap(state: GameState, quarters: number) {
  const d = derive(state);
  const y = trainYield(state, d);
  const pts: { t: number; cap: number; label: string }[] = [];
  let cum = state.cumEff;
  for (let i = 0; i <= quarters; i++) {
    const t = state.t + i;
    pts.push({
      t,
      cap: capOf(cum),
      label: t <= LAST ? TIMELINE[Math.min(t, LAST)].label : arriveLabel(t),
    });
    cum += y;
  }
  return {
    points: pts,
    assumption: "Holds today's live compute, allocation, and algorithmic multiplier constant. Pending deliveries and decay are ignored. Not a promise.",
  };
}

export function orderBenefit(state: GameState, kind: "chips" | "power" | "fabric", qty: number, arrive: number) {
  const now = derive(state);
  const future = clone(state);
  if (kind === "chips") {
    const total = future.chips + qty;
    future.fleet = total > 0 ? (future.chips * future.fleet + qty * (future.fleet || 1)) / total : future.fleet;
    future.chips = total;
  } else if (kind === "power") {
    future.mwSecured += qty;
    future.mwBySite[future.site] += qty;
  } else {
    future.fabric += qty;
  }
  const then = derive(future);
  const unused =
    then.bottleneck !== kind
      ? `At commissioning, ${then.bottleneck} will still bind — extra ${kind} sits idle until that moves.`
      : `At commissioning this relieves the current ${now.bottleneck} constraint, other things equal.`;
  return {
    liveNow: now.live,
    liveThen: then.live,
    bottleneckNow: now.bottleneck,
    bottleneckThen: then.bottleneck,
    arrive,
    arriveLabel: arriveLabel(arrive),
    note: unused,
  };
}
