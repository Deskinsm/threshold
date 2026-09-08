import assert from "node:assert/strict";
import { test } from "node:test";
import { initState } from "./init.ts";
import { previewQuarter } from "./preview.ts";
import { deserialize, serialize } from "./save.ts";
import type { GameState } from "./types.ts";

function loadMutated(mutate: (state: GameState) => void) {
  const raw = JSON.parse(serialize(initState({ seed: 1 })));
  mutate(raw.state);
  return deserialize(JSON.stringify(raw));
}

test("a well-formed save with construction still loads and the quarter preview does not throw", () => {
  const s = initState({ seed: 7 });
  s.construction = [{ id: "reactor", ventureId: "smr", arrive: s.t + 12, label: "Reactor" }];
  const loaded = deserialize(serialize(s));
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.equal(loaded.state.construction[0]?.arrive, s.t + 12);
  assert.doesNotThrow(() => previewQuarter(loaded.state));
});

test("null construction records are rejected instead of crashing the quarter preview", () => {
  const r = loadMutated((s) => {
    s.construction = [null as unknown as GameState["construction"][number]];
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.reason, /Construction/);
});

test("incomplete construction records are rejected", () => {
  const r = loadMutated((s) => {
    s.construction = [{ id: "reactor" } as GameState["construction"][number]];
  });
  assert.equal(r.ok, false);
});

test("null wire, history, paper, release, and order records are rejected", () => {
  const holes: Array<(s: GameState) => void> = [
    (s) => {
      s.events = [null as unknown as GameState["events"][number]];
    },
    (s) => {
      s.history = [null as unknown as GameState["history"][number]];
    },
    (s) => {
      s.papers = [null as unknown as GameState["papers"][number]];
    },
    (s) => {
      s.releases = [null as unknown as GameState["releases"][number]];
    },
    (s) => {
      s.orders = [null as unknown as GameState["orders"][number]];
    },
  ];
  for (const mutate of holes) {
    assert.equal(loadMutated(mutate).ok, false);
  }
});

test("sparse order and history records are rejected", () => {
  const order = loadMutated((s) => {
    s.orders = [{ kind: "chips", qty: 10, arrive: 2 } as GameState["orders"][number]];
  });
  assert.equal(order.ok, false);
  const history = loadMutated((s) => {
    s.history = [{ t: 0, cap: 1 } as GameState["history"][number]];
  });
  assert.equal(history.ok, false);
});
