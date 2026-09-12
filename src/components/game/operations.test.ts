import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initState } from "../../game/init.ts";
import { simulateQuarter } from "../../game/resolve.ts";
import { derive } from "../../game/economy.ts";
import { capacityTimeline, fleetSegments } from "./operations-model.ts";

test("capacity preview preserves save and matches real commissioning and retirement", () => {
  const state = initState({ seed: 42 });
  state.cash = 1e12;
  // Omit gen so the preview must use chipGen(tFrom), matching the engine fallback.
  state.orders.push({ kind: "chips", qty: 100, arrive: 2, unitCost: 3000, label: "100 chips" });
  state.orders.push({ kind: "fabric", qty: 300, arrive: 3, unitCost: 260, label: "300 fabric" });
  const before = JSON.stringify(state);
  const timeline = capacityTimeline(state, 4);
  assert.equal(JSON.stringify(state), before);
  let actual = state;
  for (let i = 1; i <= 4; i++) {
    actual = simulateQuarter(actual, { stochastic: false });
    const expected = derive(actual);
    for (const key of ["live", "physicalLive", "effChips", "powerCap", "fabCap"] as const) {
      assert.ok(Math.abs(timeline[i]!.d[key] - expected[key]) < 1e-8, `${key} at ${i}`);
    }
  }
});

test("projection includes reactor commissioning and stops at last playable quarter", () => {
  const s = initState({ seed: 42 });
  s.t = 70;
  s.construction = [{ id: "reactor", ventureId: "smr", arrive: 71, label: "Reactor" }];
  const points = capacityTimeline(s);
  assert.equal(points.length, 3);
  assert.equal(points[1]!.mw, s.mwSecured + 3200);
  assert.equal(points[2]!.mw, points[1]!.mw);
});

test("fleet allocation conserves chips, including containment and zero capacity", () => {
  for (const share of [0, 0.3, 1]) {
    const parts = fleetSegments(100, 36, 60, share);
    assert.ok(Math.abs(parts.reduce((sum, p) => sum + p.value, 0) - 100) < 1e-8);
    assert.equal(parts[2]!.value, 24);
    assert.equal(parts[3]!.value, 40);
  }
  assert.ok(fleetSegments(0, 0, 0, 0.7).every((p) => p.value === 0));
});

test("the capacity chart does not pull a charting library into the bundle", async () => {
  const src = await readFile(new URL("./OperationsView.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(src, /from "recharts"/);
});
