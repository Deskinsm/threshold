import assert from "node:assert/strict";
import { test } from "node:test";
import { isTransientShellError } from "./shell-error.ts";

test("a failed Operations lazy import is a transient shell error, not a poisoned save", () => {
  assert.equal(
    isTransientShellError({
      message:
        "Failed to fetch dynamically imported module: https://example.test/src/components/game/OperationsView.tsx",
    }),
    true,
  );
  assert.equal(isTransientShellError({ message: "Loading chunk 17 failed" }), true);
  assert.equal(isTransientShellError({ message: "Game state contains a value that cannot be cloned" }), false);
  assert.equal(isTransientShellError(null), false);
});
