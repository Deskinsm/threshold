import assert from "node:assert/strict";
import { test } from "node:test";
import { SANDBOX_LOAD_ERROR, SandboxLoader, type SandboxFetch } from "./sandbox-load.ts";

class MockFetch {
  calls: {
    url: string;
    signal?: AbortSignal;
    resolve: (value: { ok: boolean; text: () => Promise<string> }) => void;
    reject: (err: unknown) => void;
  }[] = [];

  fetch: SandboxFetch = (url, init) =>
    new Promise((resolve, reject) => {
      const signal = init?.signal;
      const entry = { url, signal, resolve, reject };
      this.calls.push(entry);
      if (signal?.aborted) {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        return;
      }
      signal?.addEventListener(
        "abort",
        () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
        { once: true },
      );
    });

  respond(i: number, ok: boolean, text: string) {
    this.calls[i]!.resolve({ ok, text: async () => text });
  }

  fail(i: number, err: unknown) {
    this.calls[i]!.reject(err);
  }
}

test("a successful download is ready to commit", async () => {
  const mock = new MockFetch();
  const loader = new SandboxLoader(mock.fetch);
  const pending = loader.load();
  mock.respond(0, true, '{"ok":true}');
  assert.deepEqual(await pending, { status: "ready", text: '{"ok":true}' });
});

test("cancel ignores the in-flight download instead of committing it", async () => {
  const mock = new MockFetch();
  const loader = new SandboxLoader(mock.fetch);
  const pending = loader.load();
  loader.cancel();
  mock.respond(0, true, "SHOULD-NOT-COMMIT");
  assert.deepEqual(await pending, { status: "ignored" });
});

test("a superseded download cannot commit after a newer request starts", async () => {
  const mock = new MockFetch();
  const loader = new SandboxLoader(mock.fetch);
  const first = loader.load();
  const second = loader.load();
  mock.respond(0, true, "STALE");
  mock.respond(1, true, "FRESH");
  assert.deepEqual(await first, { status: "ignored" });
  assert.deepEqual(await second, { status: "ready", text: "FRESH" });
});

test("a failed download sets an error instead of committing", async () => {
  const mock = new MockFetch();
  const loader = new SandboxLoader(mock.fetch);
  const missing = loader.load();
  mock.respond(0, false, "");
  assert.deepEqual(await missing, { status: "error", reason: SANDBOX_LOAD_ERROR });

  const network = loader.load();
  mock.fail(1, new Error("offline"));
  assert.deepEqual(await network, { status: "error", reason: SANDBOX_LOAD_ERROR });
});

test("abort after cancel is ignored, not treated as a download failure", async () => {
  const mock = new MockFetch();
  const loader = new SandboxLoader(mock.fetch);
  const pending = loader.load();
  loader.cancel();
  assert.deepEqual(await pending, { status: "ignored" });
});

test("fetch is invoked without the loader as `this` (browsers throw Illegal invocation otherwise)", async () => {
  let receiver: unknown = "unset";
  const fetchImpl = function (this: unknown) {
    receiver = this;
    return Promise.resolve({ ok: true, text: () => Promise.resolve("{}") });
  } as unknown as SandboxFetch;
  const loader = new SandboxLoader(fetchImpl);
  await loader.load();
  assert.notEqual(receiver, loader);
});
