import assert from "node:assert/strict";
import { test } from "node:test";
import { applyAction } from "./actions.ts";
import { CHIPS_PER_MW, LAST, idx } from "./data.ts";
import { chipDisc, derive, opexOf, serveMult, ventureIncome } from "./economy.ts";
import { campaignActive, campusCapacity, expansionQuote, linkCapacity } from "./expansion.ts";
import { initState } from "./init.ts";
import { simulateQuarter } from "./resolve.ts";
import { deserialize, serialize } from "./save.ts";
import type { Action, GameState } from "./types.ts";
import { capacityTimeline } from "../components/game/operations-model.ts";
function fixture() {
  const s = initState({ seed: 42 });
  s.cash = 1e12;
  s.actions = 20;
  s.mwBySite = { east: 10, south: 5, onsite: 0, abroad: 0 };
  s.mwSecured = 15;
  return s;
}
function act(s: GameState, a: Action) {
  const result = applyAction(s, a);
  assert.equal(result.ok, true, result.ok ? "" : result.reason);
  return result.state;
}
function reject(s: GameState, a: Action) {
  const before = JSON.stringify(s);
  const result = applyAction(s, a);
  assert.equal(result.ok, false);
  assert.equal(result.state, s);
  assert.equal(JSON.stringify(s), before);
}
test("venture branches require ownership, charge once and lock out both repeats and alternatives", () => {
  let s = fixture();
  reject(s, { type: "specializeVenture", id: "colo-leases" });
  s.ventures.push("colo");
  const income = ventureIncome(s, derive(s)),
    cash = s.cash,
    actions = s.actions;
  s = act(s, { type: "specializeVenture", id: "colo-leases" });
  assert.equal(s.cash, cash - 20e6);
  assert.equal(s.actions, actions - 1);
  assert.equal(ventureIncome(s, derive(s)), income + 2e6);
  reject(s, { type: "specializeVenture", id: "colo-leases" });
  reject(s, { type: "specializeVenture", id: "colo-cooling" });
});
test("specializations modify serving, opex, fleet and actual chip purchase prices", () => {
  let s = fixture();
  s.ventures.push("cloud", "silicon");
  const serve = serveMult(s),
    expense = opexOf(s, derive(s));
  s = act(s, { type: "specializeVenture", id: "cloud-managed" });
  assert.ok(Math.abs(serveMult(s) / serve - 1.12) < 1e-10);
  assert.equal(opexOf(s, derive(s)) - expense, 1e6);
  const chip = chipDisc(s);
  s = act(s, { type: "specializeVenture", id: "silicon-packaging" });
  assert.ok(Math.abs(chipDisc(s) / chip - 0.9) < 1e-10);
  const before = s.cash;
  s = act(s, { type: "orderChips", qty: 1 });
  assert.ok(Math.abs(before - s.cash - 2600 * 0.72 * 0.9) < 0.001);
  let efficient = fixture();
  efficient.ventures.push("silicon");
  const compute = derive(efficient).effChips;
  efficient = act(efficient, { type: "specializeVenture", id: "silicon-efficient" });
  assert.ok(Math.abs(derive(efficient).effChips / compute - 1.1) < 1e-10);
});
test("cooling and links only take effect on commissioning; duplicate reverse links are rejected", () => {
  let s = fixture();
  const base = derive(s);
  s = act(s, { type: "upgradeCampus", site: "east" });
  s = act(s, { type: "connectCampuses", from: "east", to: "south" });
  reject(s, { type: "connectCampuses", from: "south", to: "east" });
  reject(s, { type: "upgradeCampus", site: "east" });
  assert.equal(derive(s).powerCap, base.powerCap);
  assert.equal(linkCapacity(s), 0);
  s.t = 2;
  assert.equal(campusCapacity(s, "east"), 10 * CHIPS_PER_MW * 1.15);
  assert.equal(linkCapacity(s), 0);
  s.t = 3;
  assert.equal(linkCapacity(s), 5 * CHIPS_PER_MW * 0.15);
  assert.equal(derive(s).fabCap, base.fabCap + 5 * CHIPS_PER_MW * 0.15);
  const before = opexOf(s, derive(s));
  s.expansion.links = [];
  assert.ok(Math.abs(before - opexOf(s, derive(s)) - 150000) < 1e-6);
});
test("cooling engineering, private backbone and export restrictions compose", () => {
  let s = fixture();
  s.ventures.push("colo", "fiber");
  s.mwBySite.abroad = 5;
  s.mwSecured += 5;
  s = act(s, { type: "specializeVenture", id: "colo-cooling" });
  s = act(s, { type: "specializeVenture", id: "fiber-backbone" });
  s = act(s, { type: "upgradeCampus", site: "abroad" });
  s = act(s, { type: "connectCampuses", from: "east", to: "abroad" });
  s.t = 3;
  assert.equal(campusCapacity(s, "abroad"), 5 * CHIPS_PER_MW * 1.25);
  const before = linkCapacity(s);
  s.exportControls = true;
  assert.ok(Math.abs(linkCapacity(s) / before - 0.7) < 1e-10);
  assert.equal(linkCapacity(s), campusCapacity(s, "abroad") * 0.3);
});
test("all expansion actions reject crisis, game-over, no actions, and insufficient cash without mutation", () => {
  const actions: Action[] = [
    { type: "specializeVenture", id: "colo-leases" },
    { type: "upgradeCampus", site: "east" },
    { type: "connectCampuses", from: "east", to: "south" },
    { type: "runPR", kind: "transparency" },
    { type: "fileCampusPower", site: "south", qty: 1 },
  ];
  for (const a of actions)
    for (const guard of ["cash", "actions", "event", "over", "emergency"]) {
      const s = fixture();
      s.ventures.push("colo");
      if (guard === "cash") s.cash = 0;
      if (guard === "actions") s.actions = 0;
      if (guard === "over") s.over = "timeout";
      if (guard === "event")
        s.pendingEvent = { id: "test", title: "Decision", body: "", choices: [] };
      if (guard === "emergency")
        s.pendingEmergency = {
          gap: 1,
          draw: 1,
          creditAvail: 1,
          canDistressed: true,
          distressedAmount: 1,
          loanRate: 0.1,
        };
      reject(s, a);
    }
});
test("campus actions enforce valid IDs, energized endpoints, unlocks and finite allocation", () => {
  const s = fixture();
  reject(s, { type: "connectCampuses", from: "east", to: "east" });
  reject(s, { type: "connectCampuses", from: "east", to: "onsite" });
  reject(s, { type: "upgradeCampus", site: "onsite" });
  reject(s, { type: "upgradeCampus", site: "bad" } as unknown as Action);
  reject(s, { type: "fileCampusPower", site: "abroad", qty: 1 });
  reject(s, { type: "fileCampusPower", site: "south", qty: NaN });
  reject(s, { type: "fileCampusPower", site: "south", qty: s.alloc.power + 1 });
  const funded = act(s, { type: "fileCampusPower", site: "south", qty: 1 });
  assert.equal(funded.orders.at(-1)?.site, "south");
  assert.equal(funded.alloc.power, s.alloc.power - 1);
  assert.equal(funded.actions, s.actions - 1);
  s.t = LAST - 1;
  reject(s, { type: "upgradeCampus", site: "east" });
  reject(s, { type: "connectCampuses", from: "east", to: "south" });
});
test("PR charges the larger fee, preserves hazard for accountability, and enforces exact cooldown", () => {
  let s = fixture();
  s.revenue = 100e6;
  const risk = s.risk,
    trust = s.trust,
    preparedness = s.preparedness;
  assert.equal(expansionQuote(s, { type: "runPR", kind: "transparency" }).cost, 5e6);
  s = act(s, { type: "runPR", kind: "transparency" });
  assert.equal(s.risk, risk);
  assert.equal(s.trust, trust + 6);
  assert.equal(s.preparedness, preparedness + 2);
  s.t = 5;
  reject(s, { type: "runPR", kind: "community" });
  s.t = 6;
  s = act(s, { type: "runPR", kind: "community" });
  assert.equal(campaignActive(s, "community"), true);
  s.t = 9;
  assert.equal(campaignActive(s, "community"), true);
  s.t = 10;
  assert.equal(campaignActive(s, "community"), false);
});
test("roadshow requires a product and expires after exactly three operating quarters", () => {
  let s = fixture();
  reject(s, { type: "runPR", kind: "launch" });
  s.deployMode = "broad";
  s.deployedCap = 25;
  const serve = serveMult(s);
  s = act(s, { type: "runPR", kind: "launch" });
  for (const t of [0, 1, 2]) {
    s.t = t;
    assert.ok(Math.abs(serveMult(s) / serve - 1.12) < 1e-10);
  }
  s.t = 3;
  assert.equal(serveMult(s), serve);
});
test("community permitting only changes future filings, with identical RNG consumption", () => {
  let improved = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const s = fixture();
    s.rng = seed * 99991;
    const original = act(s, { type: "fileCampusPower", site: "south", qty: 1 });
    const campaign = act(s, { type: "runPR", kind: "community" });
    const after = act(campaign, { type: "fileCampusPower", site: "south", qty: 1 });
    assert.equal(after.rng, original.rng);
    assert.ok(after.orders[0].arrive <= original.orders[0].arrive);
    if (after.orders[0].arrive < original.orders[0].arrive) improved++;
    const existing = act(original, { type: "runPR", kind: "community" });
    assert.equal(existing.orders[0].arrive, original.orders[0].arrive);
  }
  assert.ok(improved > 0);
});
test("capacity preview matches real overseas deliveries, retrofit and link commissioning", () => {
  let s = fixture();
  s.exportControls = true;
  s.mwBySite.abroad = 5;
  s.mwSecured += 5;
  s.orders.push({
    kind: "power",
    site: "abroad",
    qty: 3,
    arrive: 1,
    unitCost: 1,
    label: "Partner power",
  });
  s = act(s, { type: "upgradeCampus", site: "abroad" });
  s = act(s, { type: "connectCampuses", from: "east", to: "abroad" });
  const before = JSON.stringify(s),
    timeline = capacityTimeline(s, 4);
  assert.equal(JSON.stringify(s), before);
  for (let i = 1; i <= 4; i++) {
    s = simulateQuarter(s, { stochastic: false });
    for (const key of ["powerCap", "fabCap", "physicalLive"] as const)
      assert.ok(Math.abs(timeline[i].d[key] - derive(s)[key]) < 1e-8, `${key} quarter ${i}`);
  }
  assert.equal(s.events.filter((x) => x.text.includes("Cooling retrofit commissioned")).length, 1);
  assert.equal(s.events.filter((x) => x.text.includes("Interconnect online")).length, 1);
});
test("v4 migration attributes missing venture power without changing totals and preserves RNG", () => {
  const s = fixture();
  s.ventures.push("turbine", "smr", "colo");
  s.mwSecured += 4112;
  const raw = JSON.parse(serialize(s));
  raw.version = 4;
  raw.state.version = 4;
  delete raw.state.expansion;
  const loaded = deserialize(JSON.stringify(raw));
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.state.version, 5);
  assert.equal(loaded.state.mwBySite.onsite, 4100);
  assert.equal(loaded.state.mwBySite.east, 22);
  assert.equal(loaded.state.mwSecured, s.mwSecured);
  assert.equal(loaded.state.rng, s.rng);
  assert.deepEqual(loaded.state.expansion.specializations, []);
});
test("v5 saves round trip every expansion and reject corrupt or duplicate records", () => {
  let s = fixture();
  s.ventures.push("colo");
  s = act(s, { type: "specializeVenture", id: "colo-cooling" });
  s = act(s, { type: "upgradeCampus", site: "east" });
  s = act(s, { type: "connectCampuses", from: "east", to: "south" });
  s = act(s, { type: "runPR", kind: "community" });
  const restored = deserialize(serialize(s));
  assert.equal(restored.ok, true);
  if (restored.ok) assert.deepEqual(restored.state, JSON.parse(JSON.stringify(s)));
  for (const mutate of [
    (r: any) => {
      r.state.expansion.links.push({ ...r.state.expansion.links[0], from: "south", to: "east" });
    },
    (r: any) => {
      r.state.expansion.cooling[0].site = "unknown";
    },
    (r: any) => {
      r.state.expansion.specializations.push("colo-leases");
    },
    (r: any) => {
      r.state.expansion.pr.until = "tomorrow";
    },
    (r: any) => {
      r.state.expansion.links[0].cost = -1;
    },
    (r: any) => {
      r.state.mwBySite.east += 10;
    },
    (r: any) => {
      r.state.people = {};
    },
    (r: any) => {
      delete r.state.expansion;
    },
  ]) {
    const raw = JSON.parse(serialize(s));
    mutate(raw);
    assert.equal(deserialize(JSON.stringify(raw)).ok, false);
  }
});
test("power ventures assign capacity to the right campus, including reactors on commissioning", () => {
  let s = fixture();
  s.t = idx("2024Q3");
  const total = s.mwSecured;
  s = act(s, { type: "buyVenture", id: "colo" });
  assert.equal(s.mwBySite.east, 22);
  s = act(s, { type: "buyVenture", id: "turbine" });
  assert.equal(s.mwBySite.onsite, 900);
  s.construction.push({ id: "test-reactor", ventureId: "smr", arrive: s.t + 1, label: "SMR" });
  s = simulateQuarter(s, { stochastic: false });
  assert.equal(s.mwBySite.onsite, 4100);
  assert.equal(s.mwSecured, total + 4112);
  assert.equal(
    Object.values(s.mwBySite).reduce((n, x) => n + x, 0),
    s.mwSecured,
  );
});
test("choosing a campus is free even with no actions", () => {
  const s = initState({ seed: 42 });
  s.actions = 0;
  const r = applyAction(s, { type: "setSite", site: "south" });
  assert.equal(r.ok, true);
  assert.equal(r.state.site, "south");
  assert.equal(r.state.actions, 0);
  s.over = "timeout";
  reject(s, { type: "setSite", site: "east" });
});
