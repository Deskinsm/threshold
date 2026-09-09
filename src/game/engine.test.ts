import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAction } from "./actions.ts";
import {
  capOf,
  cashInsolvent,
  chipPrice,
  chipDisc,
  derive,
  flagActive,
  playerAlloc,
  powerLead,
  roundCash,
} from "./economy.ts";
import { THRESHOLD_CAP } from "./data.ts";
import { clone } from "./format.ts";
import { initState } from "./init.ts";
import { previewQuarter } from "./preview.ts";
import { resolveQuarter } from "./resolve.ts";
import { deserialize, migrate, serialize } from "./save.ts";
import { maybeQueueEvent } from "./events.ts";
import type { Action, GameState } from "./types.ts";

function act(s: GameState, a: Action) {
  const r = applyAction(s, a);
  assert.equal(r.ok, true, r.ok ? "" : r.reason);
  return r.state;
}

function actMay(s: GameState, a: Action) {
  return applyAction(s, a);
}

describe("P0-1 solvency", () => {
  it("passive baseline cannot silently overdraft to 2030", () => {
    let s = initState({ seed: 1, background: "research" });
    for (let i = 0; i < 80 && !s.over; i++) {
      s = resolveQuarter(s, { stochastic: false });
      if (s.pendingEmergency) {
        const r = applyAction(s, { type: "emergency", choice: "default" });
        assert.equal(r.ok, true);
        s = r.state;
      }
    }
    assert.equal(s.over, "insolvent");
    assert.ok(s.t < 20, `insolvent too late at t=${s.t}`);
  });

  it("forecast identifies cash exhaustion", () => {
    const s = initState({ seed: 1 });
    const f = previewQuarter(s);
    assert.ok(f.net < 0);
    assert.ok(f.runwayQuarters !== null && f.runwayQuarters < 12);
  });
});

describe("P0-2 finite supply", () => {
  it("two purchases cannot exceed allocation; rejects change nothing", () => {
    let s = initState({ seed: 2 });
    s.cash = 1e12;
    const alloc = s.alloc.chips;
    const unit = chipPrice(s.t) * chipDisc(s);
    const r1 = applyAction(s, { type: "orderChips", qty: Math.floor(alloc) });
    assert.equal(r1.ok, true);
    s = r1.state;
    const cashAfter = s.cash;
    const actionsAfter = s.actions;
    const r2 = applyAction(s, { type: "orderChips", qty: Math.floor(alloc) });
    assert.equal(r2.ok, false);
    assert.equal(r2.state.cash, cashAfter);
    assert.equal(r2.state.actions, actionsAfter);
    assert.equal(s.orders.length, 1);
    assert.ok(s.alloc.chips < 1);
  });
});

describe("P0-3 calendar", () => {
  it("a two-quarter order arrives at the advertised quarter", () => {
    let s = initState({ seed: 3 });
    s.cash = 1e9;
    const qty = Math.max(1, Math.floor(s.alloc.chips * 0.2));
    s = act(s, { type: "orderChips", qty });
    assert.equal(s.orders[0]?.arrive, 2);
    const chips0 = s.chips;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.t, 1);
    assert.ok(s.chips <= chips0 + 1e-6);
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.t, 2);
    assert.ok(s.chips > chips0, `expected delivery at t=2, chips ${s.chips} vs ${chips0}`);
  });

  it("Q4 2030 can operate — 73 resolved quarters", () => {
    let s = initState({ seed: 4, background: "infra" });
    s.cash = 5e8;
    s.ownership = 0.002;
    s.chinaCap = 1;
    for (const r of s.rivals) {
      r.chips = 1;
      r.cash = 0;
      r.aggr = 0;
      r.cumEff = 1;
      r.deployedCap = 1;
    }
    let resolved = 0;
    while (!s.over && resolved < 80) {
      s.chinaCap = Math.min(s.chinaCap, 20);
      for (const r of s.rivals) r.deployedCap = Math.min(r.deployedCap, 20);
      if (s.pendingEmergency) s = act(s, { type: "emergency", choice: "credit" });
      if (s.pendingEvent) s = act(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id });
      const t0 = s.t;
      s = resolveQuarter(s, { stochastic: false });
      if (s.t > t0) resolved += 1;
      else break;
    }
    assert.ok(resolved >= 73, `only resolved ${resolved} over=${s.over}`);
    assert.equal(s.over, "timeout");
  });

  it("power lead is 4 then 8", () => {
    assert.equal(powerLead(0), 4);
    assert.equal(powerLead(40), 8);
  });
});

describe("P0-4 endings", () => {
  it("a domestic rival crossing ends the game", () => {
    let s = initState({ seed: 5 });
    s.cash = 1e9;
    s.rivals[0]!.deployedCap = THRESHOLD_CAP;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "rival");
    assert.equal(s.overActor, "helios");
  });

  it("china crossing wins simultaneous player+china", () => {
    let s = initState({ seed: 6 });
    s.cash = 1e9;
    s.deployedCap = THRESHOLD_CAP;
    s.deployMode = "broad";
    s.chinaCap = THRESHOLD_CAP;
    s.tech = ["oversight", "control", "interp", "evals"];
    s.risk = 10;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "china");
  });

  it("controlled crossing requires oversight and control", () => {
    let s = initState({ seed: 7 });
    s.cash = 1e9;
    s.deployedCap = THRESHOLD_CAP;
    s.deployMode = "broad";
    s.tech = ["interp", "evals"];
    s.risk = 10;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "asi_ambiguous");
  });

  it("controlled crossing with required techs", () => {
    let s = initState({ seed: 8 });
    s.cash = 1e9;
    s.deployedCap = THRESHOLD_CAP;
    s.deployMode = "broad";
    s.tech = ["interp", "evals", "oversight", "control"];
    s.risk = 20;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "asi_controlled");
  });

  it("incident in crossing quarter cannot produce a better ending", () => {
    let s = initState({ seed: 9 });
    s.cash = 1e9;
    s.deployedCap = THRESHOLD_CAP;
    s.deployMode = "broad";
    s.tech = ["interp", "evals", "oversight", "control"];
    s.risk = 80;
    s = resolveQuarter(s, { stochastic: true });
    assert.ok(s.over === "asi_bad" || s.over === "asi_controlled" || s.over === "asi_ambiguous");
    if (s.incidents > 0) {
      assert.notEqual(s.over, "asi_controlled");
    }
  });

  it("player crossing while insolvent is insolvency", () => {
    let s = initState({ seed: 10 });
    s.cash = -1e6;
    s.deployedCap = THRESHOLD_CAP;
    s.deployMode = "broad";
    s.tech = ["oversight", "control", "interp", "evals"];
    s.risk = 10;
    s.emergencyRaises = 2;
    s.dryPowder = 0;
    s.debt.principal = 1e12;
    s = resolveQuarter(s, { stochastic: false });
    assert.ok(s.over === "insolvent" || s.pendingEmergency);
  });
});

describe("P0-5 engine", () => {
  it("same seed and actions reproduce", () => {
    const run = () => {
      let s = initState({ seed: 99, background: "infra" });
      s = act(s, { type: "setTrainShare", share: 0.55 });
      s = act(s, { type: "hire" });
      s = resolveQuarter(s, { stochastic: true });
      if (s.pendingEvent) s = act(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id });
      return { t: s.t, cash: s.cash, rng: s.rng, cap: derive(s).researchCap, events: s.events.length };
    };
    assert.deepEqual(run(), run());
  });

  it("locked tech is rejected by the engine", () => {
    const s = initState({ seed: 11 });
    const r = actMay(s, { type: "buyTech", id: "xform" });
    assert.equal(r.ok, false);
    assert.equal(r.state.tech.length, 0);
    assert.equal(r.state.actions, s.actions);
  });

  it("rapid repeated buy cannot overspend", () => {
    let s = initState({ seed: 12 });
    s.cash = 1.2e6;
    const first = applyAction(s, { type: "buyTech", id: "conv" });
    assert.equal(first.ok, true);
    const second = applyAction(first.state, { type: "buyTech", id: "conv" });
    assert.equal(second.ok, false);
  });

  it("trust stays in bounds", () => {
    let s = initState({ seed: 13 });
    s.trust = 2;
    s.risk = 90;
    s.deployMode = "broad";
    s.deployedCap = 40;
    for (let i = 0; i < 8; i++) s = resolveQuarter(s, { stochastic: true });
    assert.ok(s.trust >= 0 && s.trust <= 100);
    assert.ok(s.risk >= 0 && s.risk <= 100);
  });

  it("actions after completion are rejected", () => {
    let s = initState({ seed: 14 });
    s.over = "timeout";
    const r = applyAction(s, { type: "hire" });
    assert.equal(r.ok, false);
  });
});

describe("P1 forecast and save", () => {
  it("one-quarter forecast matches deterministic resolve", () => {
    let s = initState({ seed: 21, background: "infra" });
    s.cash = 5e7;
    const f = previewQuarter(s);
    s = resolveQuarter(s, { stochastic: false });
    assert.ok(Math.abs(s.cash - f.cashAfter) < 1, `cash ${s.cash} vs ${f.cashAfter}`);
    assert.ok(Math.abs(derive(s).researchCap - f.capAfter) < 1e-9);
  });

  it("save round-trip preserves rng and next stochastic result", () => {
    let s = initState({ seed: 22 });
    s.cash = 8e6;
    s = resolveQuarter(s, { stochastic: true });
    const json = serialize(s);
    const loaded = deserialize(json);
    assert.equal(loaded.ok, true);
    if (!loaded.ok) return;
    const a = resolveQuarter(clone(s), { stochastic: true });
    const b = resolveQuarter(loaded.state, { stochastic: true });
    assert.equal(a.rng, b.rng);
    assert.equal(a.cash, b.cash);
    assert.equal(a.t, b.t);
  });

  it("malformed save does not throw", () => {
    const r = deserialize("{not json");
    assert.equal(r.ok, false);
    const r2 = deserialize(JSON.stringify({ version: 1, state: { t: 0 } }));
    assert.equal(r2.ok, false);
  });
});

describe("export and SMR", () => {
  it("export controls cut allocation and haircut revenue", () => {
    let s = initState({ seed: 30 });
    s.cash = 1e8;
    s.t = 40;
    const before = playerAlloc(s.t, "chips", false);
    s.alloc = { chips: before, power: 10, fabric: 10 };
    s = act(s, { type: "lobbyExport" });
    assert.equal(s.exportControls, true);
    assert.equal(s.exportHaircut, 0.22);
    assert.ok(s.alloc.chips < before);
  });

  it("SMR does not add power until commission", () => {
    let s = initState({ seed: 31, background: "infra" });
    s.cash = 5e10;
    s.t = 58;
    s.alloc.power = 100;
    const mw0 = s.mwSecured;
    const r = applyAction(s, { type: "buyVenture", id: "smr" });
    if (!r.ok) {
      s.t = 58;
      const r2 = applyAction(s, { type: "buyVenture", id: "smr" });
      assert.equal(r2.ok, true, r2.ok ? "" : r2.reason);
      s = r2.state;
    } else s = r.state;
    assert.equal(s.mwSecured, mw0);
    assert.ok(s.construction.length === 1);
    assert.ok(!s.ventures.includes("smr"));
  });
});

describe("model releases", () => {
  it("research cap does not count as crossing until deployed", () => {
    let s = initState({ seed: 40 });
    s.cash = 1e9;
    s.cumEff = 1e12;
    assert.ok(capOf(s.cumEff) >= 90);
    s.deployedCap = 40;
    s.deployMode = "limited";
    s = resolveQuarter(s, { stochastic: false });
    assert.notEqual(s.over, "asi_controlled");
    assert.notEqual(s.over, "asi_ambiguous");
    assert.notEqual(s.over, "asi_bad");
  });
});

describe("P1-2 baseline policies", () => {
  it("passive fails insolvent", async () => {
    const { runPolicy } = await import("./policies.ts");
    const s = runPolicy("passive", 42);
    assert.equal(s.over, "insolvent");
  });

  it("infra seed 42 is a legal capital win", async () => {
    const { runPolicy } = await import("./policies.ts");
    const s = runPolicy("infra", 42);
    assert.equal(s.over, "capital");
    assert.equal(s.overActor, "player");
    assert.ok(s.cash >= 0);
  });

  it("the frontier policy crosses first on a majority of seeds 1–8", async () => {
    const { runPolicy } = await import("./policies.ts");
    let wins = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const s = runPolicy("frontier", seed);
      if (s.overActor === "player" && (s.over ?? "").startsWith("asi")) wins++;
    }
    assert.ok(wins >= 4, `player threshold crossings: ${wins}/8`);
  });

  it("across seeds, every contender can win from legal play", async () => {
    const { runPolicy } = await import("./policies.ts");
    const seen = new Set<string>();
    for (let seed = 1; seed <= 8; seed++) {
      seen.add(runPolicy("frontier", seed).over ?? "none");
      seen.add(runPolicy("sprint", seed).over ?? "none");
    }
    assert.ok(seen.has("rival"), "a named lab should be able to cross first");
    assert.ok([...seen].some((x) => x.startsWith("asi")), "the player should be able to cross first");
  });
});

describe("v2: endogenous rivals, diffusion, talent", () => {
  it("player orders drain the shared market the rivals bid into", () => {
    const s0 = initState({ seed: 3 });
    s0.cash = 1e12;
    const before = s0.market.chips;
    const r = applyAction(s0, { type: "orderChips", qty: Math.floor(s0.alloc.chips) });
    assert.ok(r.ok);
    assert.ok(r.state.market.chips < before - 1);
  });

  it("HELIOS ends smaller when the player buys the whole allocation every quarter", () => {
    const run = (buy: boolean) => {
      let s = initState({ seed: 5 });
      for (let i = 0; i < 70; i++) {
        s.cash = 1e13;
        if (buy) s = applyAction(s, { type: "orderChips", qty: Math.floor(s.alloc.chips) }).state;
        s = resolveQuarter(s, { stochastic: false });
        if (s.pendingEvent) s = applyAction(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id }).state;
      }
      return s.rivals.find((r) => r.id === "helios")!.chips;
    };
    const starved = run(true);
    const fed = run(false);
    // Log-scale capability means starvation is modest in points, but the fleet difference must be real and in the right direction.
    assert.ok(starved < fed * 0.93, `starved ${starved} vs fed ${fed}`);
  });

  it("a funded architecture result diffuses to the field after the lag", () => {
    let s = initState({ seed: 1 });
    s.cash = 1e12;
    s = applyAction(s, { type: "buyTech", id: "conv" }).state;
    assert.equal(s.papers.length, 1);
    const algo0 = s.diffusedAlgo;
    for (let i = 0; i < 6; i++) {
      s = resolveQuarter(s, { stochastic: false });
      if (s.pendingEvent) s = applyAction(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id }).state;
    }
    assert.ok(s.papers[0]!.diffused);
    assert.ok(s.diffusedAlgo > algo0);
  });

  it("a broad release is distilled by THE COMMONS within a few quarters", () => {
    let s = initState({ seed: 9 });
    s.cash = 1e12;
    s.t = 30;
    s.cumEff = 1e8;
    s = applyAction(s, { type: "prepareCandidate" }).state;
    s = applyAction(s, { type: "deploy", mode: "broad" }).state;
    const tier0 = s.commonsOpenTier;
    for (let i = 0; i < 4; i++) {
      s = resolveQuarter(s, { stochastic: false });
      if (s.pendingEvent) s = applyAction(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id }).state;
    }
    assert.ok(s.commonsOpenTier > tier0, `open tier ${s.commonsOpenTier} did not rise from ${tier0}`);
  });

  it("world outcome is scored and bounded", async () => {
    const { worldOutcome } = await import("./endings.ts");
    const { runPolicy } = await import("./policies.ts");
    const w = worldOutcome(runPolicy("cautious", 2));
    assert.ok(w.score >= 0 && w.score <= 100);
    assert.ok(w.lines.length >= 2);
  });

  it("v1 saves migrate to v2 with the new fields", async () => {
    const { migrate } = await import("./save.ts");
    const s = initState({ seed: 1 }) as unknown as Record<string, unknown>;
    delete s.market; delete s.papers; delete s.diffusedAlgo; delete s.lastBroadCap; delete s.talentFlow;
    const out = migrate({ version: 1, savedAt: "x", state: s as never }).state;
    assert.ok(out.market.chips > 0);
    assert.deepEqual(out.papers, []);
    assert.equal(out.diffusedAlgo, 1);
    assert.ok(Array.isArray(out.releases));
    assert.equal(out.crossing, null);
  });
});

describe("v2.1 correctness", () => {
  it("one affordable credit rescue advances the quarter nonnegative", () => {
    let s = initState({ seed: 42, background: "research" });
    while (!s.pendingEmergency && !s.over && s.t < 12) {
      s = resolveQuarter(s, { stochastic: false });
    }
    assert.ok(s.pendingEmergency, "expected a financing crisis");
    const t0 = s.t;
    const em = s.pendingEmergency!;
    assert.ok(em.draw >= em.gap);
    assert.ok(em.creditAvail + 1 >= em.draw, "fixture must be rescuable");
    s = act(s, { type: "emergency", choice: "credit" });
    assert.equal(s.pendingEmergency, null);
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.t, t0 + 1);
    assert.ok(s.cash >= 0, `cash ${s.cash}`);
    assert.notEqual(s.over, "insolvent");
    assert.ok(s.debt.principal <= em.creditAvail + 1);
  });

  it("containment does not destroy owned chips", () => {
    const run = (contain: boolean) => {
      let s = initState({ seed: 7, background: "infra" });
      s.chips = 1000;
      s.mwSecured = 20;
      s.fabric = 8000;
      s.cash = 1e9;
      s.fleet = 1;
      if (contain) s.flags.downtimeUntil = s.t + 1;
      const live0 = derive(s).live;
      if (contain) assert.ok(Math.abs(live0 - derive({ ...s, flags: {} }).live * 0.6) < 1e-6);
      for (let i = 0; i < 3; i++) s = resolveQuarter(s, { stochastic: false });
      return s.chips;
    };
    const intact = run(false);
    const contained = run(true);
    assert.ok(Math.abs(contained - intact) < 1e-6, `contained ${contained} vs ${intact}`);
  });

  it("containment live-compute recovers after the stated quarter", () => {
    let s = initState({ seed: 8, background: "infra" });
    s.chips = 1000;
    s.mwSecured = 20;
    s.fabric = 8000;
    s.cash = 1e9;
    s.flags.downtimeUntil = s.t + 1;
    assert.equal(derive(s).downtimeMul, 0.6);
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(derive(s).downtimeMul, 1);
    assert.ok(derive(s).live > 0);
  });

  it("incomplete saves are rejected and do not throw", () => {
    const r = deserialize(JSON.stringify({ version: 2, state: { t: 0, cash: 1, rng: 1, rivals: [], events: [], tech: [] } }));
    assert.equal(r.ok, false);
    const r2 = deserialize(JSON.stringify({ version: 2, state: initState({ seed: 1 }) }));
    assert.equal(r2.ok, true);
  });

  it("a later limited release does not postpone an already-public broad model", () => {
    const openAfter = (extraLimited: boolean) => {
      let s = initState({ seed: 9 });
      s.cash = 1e12;
      s.t = 28;
      s.alloc = { chips: 100, power: 10, fabric: 10 };
      s.actions = 4;
      s.cumEff = 1e8;
      s = act(s, { type: "prepareCandidate" });
      s = act(s, { type: "deploy", mode: "broad" });
      s = resolveQuarter(s, { stochastic: false });
      s = resolveQuarter(s, { stochastic: false });
      if (extraLimited) {
        s.actions = 3;
        s.cumEff = 1e9;
        s = act(s, { type: "prepareCandidate" });
        s = act(s, { type: "deploy", mode: "limited" });
      }
      s = resolveQuarter(s, { stochastic: false });
      return s.rivals.find((r) => r.id === "commons")!.openTier;
    };
    const a = openAfter(false);
    const b = openAfter(true);
    assert.ok(a > 0, `broad-only open tier ${a}`);
    assert.ok(b > 0, `limited-after open tier ${b}`);
  });

  it("a stronger domestic rival beats a solvent player at 90", () => {
    let s = initState({ seed: 11 });
    s.cash = 1e9;
    s.deployedCap = 90;
    s.deployMode = "broad";
    s.rivals[0]!.deployedCap = 95;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "rival");
    assert.equal(s.overActor, "helios");
    assert.equal(s.crossing?.reason, "highest-capability");
  });

  it("unaffordable event choices are rejected without changing cash", () => {
    let s = initState({ seed: 12 });
    s.t = 45;
    s.cash = 1;
    s.flags = {};
    maybeQueueEvent(s);
    assert.equal(s.pendingEvent?.id, "packaging");
    const r = actMay(s, { type: "chooseEvent", choice: "prepay" });
    assert.equal(r.ok, false);
    assert.equal(r.state.cash, 1);
    assert.ok(s.pendingEvent);
  });

  it("packaging boost lasts four quarters, not five", () => {
    let s = initState({ seed: 13, background: "infra" });
    s.cash = 1e9;
    s.t = 45;
    s.flags.packBoostUntil = s.t + 4;
    let n = 0;
    for (let i = 0; i < 8; i++) {
      if (s.pendingEmergency) s = act(s, { type: "emergency", choice: "credit" });
      if (flagActive(s, "packBoostUntil")) n += 1;
      const t0 = s.t;
      s = resolveQuarter(s, { stochastic: false });
      if (s.t === t0 && !s.pendingEmergency) break;
    }
    assert.equal(n, 4);
  });

  it("new games preserve an explicit seed and differ across seeds", () => {
    const a = initState({ seed: 0x11111111, background: "research" });
    const b = initState({ seed: 0x22222222, background: "research" });
    assert.equal(a.seed, 0x11111111);
    assert.notEqual(a.seed, b.seed);
    assert.notEqual(a.rng, b.rng);
  });

  it("ARCH results on a v1 save reconstruct as already-diffused papers", () => {
    const s = initState({ seed: 1 }) as unknown as Record<string, unknown>;
    (s as { tech: string[] }).tech = ["conv"];
    delete s.market;
    delete s.papers;
    delete s.diffusedAlgo;
    delete s.lastBroadCap;
    delete s.talentFlow;
    const out = migrate({ version: 1, savedAt: "x", state: s as never }).state;
    assert.equal(out.papers.length, 1);
    assert.equal(out.papers[0]!.id, "conv");
    assert.equal(out.papers[0]!.diffused, true);
    assert.ok(out.diffusedAlgo > 1);
  });

  it("a weaker domestic rival does not beat a solvent player at 90", () => {
    let s = initState({ seed: 15 });
    s.cash = 1e9;
    s.deployedCap = 90;
    s.deployMode = "broad";
    s.tech = ["oversight", "control", "interp", "evals"];
    s.risk = 10;
    s.rivals[0]!.deployedCap = 88;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "asi_controlled");
    assert.equal(s.overActor, "player");
  });

  it("an insolvent player at 90 loses to a domestic rival at 95", () => {
    let s = initState({ seed: 16 });
    s.cash = -2e6;
    s.deployedCap = 90;
    s.deployMode = "broad";
    s.tech = ["oversight", "control", "interp", "evals"];
    s.risk = 10;
    s.emergencyRaises = 2;
    s.dryPowder = 0;
    s.debt.principal = 1e12;
    s.rivals[0]!.deployedCap = 95;
    s = resolveQuarter(s, { stochastic: false });
    assert.equal(s.over, "rival");
    assert.equal(s.overActor, "helios");
    assert.ok(s.crossing?.reason === "player-insolvent-rival-takes" || s.crossing?.reason === "highest-capability");
  });

  it("hyperscaler exclusivity lasts eight operating quarters", () => {
    let s = initState({ seed: 17, background: "infra" });
    s.cash = 1e9;
    s.deployedCap = 20;
    s.deployMode = "broad";
    s.hyperscaler = "accepted";
    s.flags.hyperUntil = s.t + 8;
    let n = 0;
    for (let i = 0; i < 12; i++) {
      if (s.pendingEmergency) s = act(s, { type: "emergency", choice: "credit" });
      if (s.hyperscaler === "accepted" && flagActive(s, "hyperUntil")) n += 1;
      const t0 = s.t;
      s = resolveQuarter(s, { stochastic: false });
      if (s.t === t0 && !s.pendingEmergency) break;
    }
    assert.equal(n, 8);
  });

  it("sub-dollar negative cash is rounded, not insolvency", () => {
    assert.equal(roundCash(-0.4), 0);
    assert.equal(roundCash(-0.999), 0);
    assert.equal(cashInsolvent(-0.4), false);
    assert.equal(cashInsolvent(-1.1), true);
    assert.equal(roundCash(12.5), 12.5);
    assert.equal(roundCash(-4), -4);
  });
});

describe("v3: named researchers, siting, the record", () => {
  const settle = (s: GameState) => {
    while (s.pendingEvent) s = applyAction(s, { type: "chooseEvent", choice: s.pendingEvent.choices[0]!.id }).state;
    return s;
  };

  it("signing a free person costs cash and an action; a rival's person must be poached", () => {
    const s0 = initState({ seed: 1 });
    s0.cash = 1e9;
    const r = applyAction(s0, { type: "hirePerson", id: "okafor" });
    assert.ok(r.ok);
    assert.equal(r.state.people.okafor!.where, "you");
    assert.ok(r.state.cash < 1e9);
    assert.equal(r.state.actions, s0.actions - 1);
    const r2 = applyAction(r.state, { type: "hirePerson", id: "lindqvist" });
    assert.ok(!r2.ok && /Poach/.test(r2.reason));
  });

  it("an architecture specialist unlocks architecture research early", async () => {
    const { techAvailableAt } = await import("./economy.ts");
    const { TECH, idx } = await import("./data.ts");
    const xform = TECH.find((n) => n.id === "xform")!;
    let s = initState({ seed: 1 });
    assert.equal(techAvailableAt(s, xform), idx(xform.at));
    s.cash = 1e9;
    s = applyAction(s, { type: "hirePerson", id: "okafor" }).state;
    assert.equal(techAvailableAt(s, xform), idx(xform.at) - 4);
    const sys = TECH.find((n) => n.id === "par")!;
    assert.equal(techAvailableAt(s, sys), idx(sys.at), "only their own branch moves");
  });

  it("a systems lead delivers pre-evaluated candidates", () => {
    let s = initState({ seed: 2 });
    s.cash = 1e12;
    s.t = 40;
    s.cumEff = 1e6;
    s.people.diallo = { where: "free", since: 0 };
    s = applyAction(s, { type: "hirePerson", id: "diallo" }).state;
    s.actions = 2;
    s = applyAction(s, { type: "prepareCandidate" }).state;
    assert.equal(s.candidate?.evaluated, true);
  });

  it("an alignment lead counts as a pillar", async () => {
    const { alignScore } = await import("./economy.ts");
    let s = initState({ seed: 2 });
    s.cash = 1e12;
    s.t = 60;
    const before = alignScore(s);
    s = applyAction(s, { type: "hirePerson", id: "verhoeven" }).state;
    assert.equal(alignScore(s), before + 1);
  });

  it("a failed poach sets a cooldown that the engine enforces", () => {
    let s = initState({ seed: 4 });
    s.cash = 1e12;
    s.t = 10;
    s.actions = 9;
    let failed = false;
    for (let i = 0; i < 12 && !failed; i++) {
      const r = applyAction(s, { type: "poach", id: "lindqvist" });
      s = r.state;
      if (s.people.lindqvist!.where === "you") { s.people.lindqvist = { where: "meridian", since: 0 }; continue; }
      failed = true;
      const again = applyAction(s, { type: "poach", id: "lindqvist" });
      assert.ok(!again.ok && /said no/.test(again.reason));
    }
    assert.ok(failed, "expected at least one refusal in twelve attempts at ~45% odds");
  });

  it("sites change the price and lead time of a power filing, and deliveries land by site", async () => {
    const { powerPriceAt, powerLeadAt } = await import("./economy.ts");
    let s = initState({ seed: 3 });
    s.cash = 1e12;
    s.t = 10;
    assert.ok(powerPriceAt("south") < powerPriceAt("east"));
    assert.ok(powerLeadAt(10, "south") > powerLeadAt(10, "east"));
    s = applyAction(s, { type: "setSite", site: "south" }).state;
    assert.equal(s.actions, 2, "choosing a site is free");
    const r = applyAction(s, { type: "orderPower", qty: 5 });
    assert.ok(r.ok);
    const o = r.state.orders.find((x) => x.kind === "power")!;
    assert.equal(o.site, "south");
    let x = r.state;
    for (let i = 0; i < 12 && x.mwBySite.south < 4.9; i++) x = settle(resolveQuarter(x, { stochastic: false }));
    assert.ok(x.mwBySite.south >= 4.9);
    assert.ok(Math.abs(Object.values(x.mwBySite).reduce((a, b) => a + b, 0) - x.mwSecured) < 1e-6);
  });

  it("capacity abroad runs at 70% under export controls", async () => {
    const { sitePowerMult } = await import("./economy.ts");
    const s = initState({ seed: 3 });
    s.mwSecured = 100;
    s.mwBySite = { east: 0, south: 0, onsite: 0, abroad: 100 };
    assert.equal(sitePowerMult(s), 1);
    s.exportControls = true;
    assert.ok(Math.abs(sitePowerMult(s) - 0.7) < 1e-9);
  });

  it("sites unlock on schedule", () => {
    const s = initState({ seed: 3 });
    const r = applyAction(s, { type: "setSite", site: "onsite" });
    assert.ok(!r.ok);
  });

  it("the record is monotone and ends at Q2 2026", async () => {
    const { HISTORICAL_FRONTIER, idx } = await import("./data.ts");
    for (let i = 1; i < HISTORICAL_FRONTIER.length; i++) {
      assert.ok(idx(HISTORICAL_FRONTIER[i]!.at) > idx(HISTORICAL_FRONTIER[i - 1]!.at));
      assert.ok(HISTORICAL_FRONTIER[i]!.cap > HISTORICAL_FRONTIER[i - 1]!.cap);
    }
    assert.equal(HISTORICAL_FRONTIER[HISTORICAL_FRONTIER.length - 1]!.at, "2026Q2");
  });

  it("the programme abroad follows the shipped frontier, not unreleased research", () => {
    const run = (ship: boolean) => {
      let s = initState({ seed: 6 });
      s.t = 30;
      s.cumEff = 5e8;
      s.cash = 1e12;
      if (ship) {
        s = applyAction(s, { type: "prepareCandidate" }).state;
        s = applyAction(s, { type: "deploy", mode: "broad" }).state;
      }
      for (let i = 0; i < 6; i++) s = settle(resolveQuarter(s, { stochastic: false }));
      return s.chinaCap;
    };
    assert.ok(run(true) > run(false) + 0.5, "shipping should pull the follower forward; sitting on the result should not");
  });

  it("v3 saves migrate to v4 with people and sites", async () => {
    const { migrate } = await import("./save.ts");
    const s = initState({ seed: 1 }) as unknown as Record<string, unknown>;
    delete s.people; delete s.mwBySite; delete s.site;
    const out = migrate({ version: 3, savedAt: "x", state: s as never }).state;
    assert.ok(out.people.okafor);
    assert.equal(out.site, "east");
    assert.equal(out.mwBySite.east, out.mwSecured);
  });
});

describe("seed hygiene", () => {
  it("initState refuses a non-numeric seed instead of poisoning the state", () => {
    assert.throws(() => initState({ seed: {} as unknown as number }), /seed must be a finite number/);
    assert.throws(() => initState({ seed: Number.NaN }), /seed must be a finite number/);
  });
  it("a fresh state is structured-cloneable (the forecast depends on it)", () => {
    const s = initState({ seed: 11 });
    assert.doesNotThrow(() => structuredClone(s));
  });
  it("clone names a leaked function instead of surfacing structuredClone's message", () => {
    assert.throws(() => clone({ fn: () => {} }), /cannot be cloned/);
  });
});
