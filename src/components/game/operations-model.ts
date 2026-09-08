import { addVenturePower } from "../../game/expansion.ts";
import { FLEET_DECAY, FLEET_RETIRE, LAST, VENTURES } from "../../game/data.ts";
import { chipGen, derive } from "../../game/economy.ts";
import type { GameState } from "../../game/types.ts";

/** Capacity-only preview. Never runs the economy, draws randomness, or writes to the save. */
export function capacityTimeline(state: GameState, horizon = 8) {
  const s = structuredClone(state);
  const points = [{ t: s.t, chips: s.chips, mw: s.mwSecured, d: derive(s) }];
  for (let i = 0; i < horizon && s.t < LAST; i++) {
    s.chips *= 1 - FLEET_RETIRE;
    s.fleet *= FLEET_DECAY;
    const tFrom = s.t;
    s.t++;
    for (const order of s.orders.filter((o) => o.arrive <= s.t)) {
      if (order.kind === "chips") {
        const total = s.chips + order.qty;
        const gen = order.gen ?? chipGen(tFrom);
        s.fleet = total > 0 ? (s.chips * s.fleet + order.qty * gen) / total : (order.gen ?? 1);
        s.chips = total;
      } else if (order.kind === "power") {
        s.mwSecured += order.qty;
        const site = order.site ?? "east";
        s.mwBySite[site] = (s.mwBySite[site] ?? 0) + order.qty;
      } else s.fabric += order.qty;
    }
    s.orders = s.orders.filter((o) => o.arrive > s.t);
    for (const project of s.construction.filter((c) => c.arrive <= s.t)) {
      if (!s.ventures.includes(project.ventureId)) s.ventures.push(project.ventureId);
      const add = VENTURES.find((v) => v.id === project.ventureId)?.powerAdd ?? 0;
      if (add) addVenturePower(s, project.ventureId, add);
    }
    s.construction = s.construction.filter((c) => c.arrive > s.t);
    // Cooling and links commission by date; derive() reads arrive <= t.
    points.push({ t: s.t, chips: s.chips, mw: s.mwSecured, d: derive(s) });
  }
  return points;
}

export function fleetSegments(chips: number, live: number, physicalLive: number, trainShare: number) {
  const total = Math.max(0, chips);
  const active = Math.min(total, Math.max(0, live));
  const share = Math.max(0, Math.min(1, trainShare));
  const paused = Math.max(0, Math.min(total, physicalLive) - active);
  return [
    { id: "train" as const, label: "Training", value: active * share },
    { id: "serve" as const, label: "Serving allocation", value: active * (1 - share) },
    { id: "paused" as const, label: "Containment", value: paused },
    { id: "idle" as const, label: "Unpowered / unnetworked", value: Math.max(0, total - active - paused) },
  ];
}
