import { money } from "./format.ts";
import { pushEvent } from "./log.ts";
import type { GameState, PendingEvent } from "./types.ts";
import { chipPrice, chipDisc, chipGen } from "./economy.ts";
import { chance } from "./rng.ts";

export function packagingPrepayCost(s: GameState) {
  const unit = chipPrice(s.t) * chipDisc(s);
  const qty = Math.max(1, s.alloc.chips);
  return qty * unit * 1.6;
}

export function containCost(s: GameState) {
  return Math.max(8e6, s.revenue * 0.2);
}

export function eventChoiceCost(s: GameState, eventId: string, choiceId: string): number {
  if (eventId === "packaging" && choiceId === "prepay") return packagingPrepayCost(s);
  if (eventId === "leak" && choiceId === "contain") return containCost(s);
  return 0;
}

export function maybeQueueEvent(s: GameState) {
  if (s.pendingEvent || s.over) return;

  if (!s.flags.evtHyper && s.t >= 27 && s.t <= 36) {
    s.flags.evtHyper = 1;
    s.pendingEvent = {
      id: "hyperscaler",
      title: "A hyperscaler wants the exclusive",
      body: "They will drop compute credits on the table — real accelerators, one-quarter lead — in exchange for being the only cloud that serves your models for two years. Independence is more expensive and slower. HELIOS will take the deal if you do not.",
      choices: [
        {
          id: "accept",
          label: "Take the credits",
          detail: "Large chip delivery next quarter. Serving revenue −15% for 8 quarters. You do not sell through anyone else.",
        },
        {
          id: "refuse",
          label: "Keep independence",
          detail: "No credits. +2 trust. HELIOS signs instead and jumps a generation.",
        },
      ],
    };
    return;
  }

  if (!s.flags.evtPack && s.t >= 45 && s.t <= 54) {
    s.flags.evtPack = 1;
    const prepay = packagingPrepayCost(s);
    s.pendingEvent = {
      id: "packaging",
      title: "The packaging house is taking names",
      body: "CoWoS and HBM are allocated 18 months forward. You can prepay a bloated contract, take the ration, or step out of this cycle. Working capital versus future live chips. There is no clean answer.",
      choices: [
        {
          id: "prepay",
          label: "Prepay the fat contract",
          detail: `Pay ${money(prepay)} now (1.6× this quarter's chip budget). Next four quarters your chip allocation is +60%.`,
          cost: prepay,
        },
        {
          id: "ration",
          label: "Take the ration",
          detail: "Chip allocation −30% for two quarters. Cash untouched.",
        },
        {
          id: "delay",
          label: "Step out",
          detail: "No chip orders this quarter or next. Pending chip deliveries slip one quarter. You keep the cash.",
        },
      ],
    };
    return;
  }

  if (!s.flags.evtLeak && s.deployedCap >= 38 && s.deployMode === "broad") {
    s.flags.evtLeak = 1;
    const cost = containCost(s);
    s.pendingEvent = {
      id: "leak",
      title: "Weights on a dead drop",
      body: "A staffer, a partner, or a channel you do not control. A checkpoint at your current deployed tier is about to leave the building. Security investment changes how much this costs — not whether it was possible.",
      choices: [
        {
          id: "contain",
          label: "Contain and investigate",
          detail: `Downtime: live compute −40% this quarter only. ${money(cost)} for the incident response. Trust holds. Ownership is unchanged. Follower catch-up is small.`,
          cost,
        },
        {
          id: "continue",
          label: "Keep shipping",
          detail: "No downtime. 70% chance the weights land abroad and at THE COMMONS this quarter.",
        },
        {
          id: "release",
          label: "Publish them yourself",
          detail: "Open-weight the current tier. Serving margins at or below it collapse. Trust with researchers up; AEGIS and enterprise customers down. The State Programme moves closer.",
        },
      ],
    };
  }
}

export function applyEventChoice(s: GameState, id: string, choice: string) {
  if (id === "hyperscaler") {
    if (choice === "accept") {
      s.hyperscaler = "accepted";
      s.flags.hyperUntil = s.t + 8;
      const qty = Math.max(80, s.alloc.chips * 0.9);
      s.orders.push({
        kind: "chips",
        qty,
        arrive: s.t + 1,
        label: `${Math.round(qty)} partner accelerators`,
        gen: chipGen(s.t),
        unitCost: 0,
      });
      pushEvent(s, "decision", `Hyperscaler partnership accepted. ${Math.round(qty)} accelerators arrive next quarter as credits. Exclusivity: serving revenue −15% for eight quarters.`);
    } else {
      s.hyperscaler = "refused";
      s.trust = Math.min(100, s.trust + 2);
      const h = s.rivals.find((r) => r.id === "helios");
      if (h) {
        h.chips += 400;
        h.cash += 6e8;
        h.deployedCap = Math.max(h.deployedCap, h.deployedCap + 1.2);
      }
      pushEvent(s, "decision", "You kept the channel. HELIOS took the exclusive and just became harder to out-serve.");
    }
    return;
  }

  if (id === "packaging") {
    if (choice === "prepay") {
      const cost = packagingPrepayCost(s);
      s.cash -= cost;
      s.flags.packBoostUntil = s.t + 4;
      s.alloc.chips *= 1.6;
      pushEvent(s, "decision", `Prepaid packaging ${money(cost)}. Chip allocation +60% through four quarters, starting now.`);
    } else if (choice === "ration") {
      s.flags.packCutUntil = s.t + 2;
      s.alloc.chips *= 0.7;
      pushEvent(s, "decision", "Took the ration. Chip allocation −30% this quarter and next. Cash preserved.");
    } else {
      s.flags.noChipsUntil = s.t + 2;
      s.alloc.chips = 0;
      for (const o of s.orders) if (o.kind === "chips") o.arrive += 1;
      pushEvent(s, "decision", "Stepped out of this packaging cycle. No chip purchases this quarter or next; in-flight chip orders slip one quarter.");
    }
    return;
  }

  if (id === "leak") {
    const secured = s.tech.includes("interp") || s.tech.includes("evals") ? 0.4 : 1;
    if (choice === "contain") {
      const cost = containCost(s);
      s.cash -= cost;
      // Exclusive end: this quarter only. Ownership is unchanged; derive() applies a 0.6 live multiplier.
      s.flags.downtimeUntil = s.t + 1;
      s.chinaBoost += 0.15 * secured;
      pushEvent(s, "decision", `Containment. ${money(cost)} and a 40% live-compute haircut this quarter. The fleet is still yours. The leak is mostly stopped.`);
    } else if (choice === "continue") {
      if (chance(s, 0.7)) {
        s.chinaBoost += 0.7 * secured;
        s.commonsOpenTier = Math.max(s.commonsOpenTier, s.deployedCap - 4);
        s.espionageEvents += 1;
        pushEvent(s, "decision", "You kept the lights on. A checkpoint at your deployed tier is now a problem for everyone else to have.");
      } else {
        pushEvent(s, "decision", "You kept the lights on. The weights did not land this quarter. The chance was real; this time it missed.");
      }
    } else {
      s.commonsOpenTier = Math.max(s.commonsOpenTier, s.deployedCap);
      s.chinaBoost += 1.1;
      s.trust = Math.min(100, s.trust + 5);
      s.reg += 8;
      const aegis = s.rivals.find((r) => r.id === "aegis");
      if (aegis) aegis.cumEff *= 1.04;
      pushEvent(s, "decision", `You published the ${s.deployedCap.toFixed(1)} weights. The tier is now free. Researchers are loyal; enterprise procurement is not; the programme abroad just saved a year.`);
    }
  }
}

export function eventCard(s: GameState): PendingEvent {
  return s.pendingEvent;
}
