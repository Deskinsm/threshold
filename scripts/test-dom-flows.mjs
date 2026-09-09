// DOM flow test. Mounts the real ThresholdApp in jsdom with the project's React and drives the
// flows that unit tests cannot reach: Begin, play, tabs, New-game-while-playing, reload → Continue.
// Regression for the DataCloneError crash (confirm button passed its click event to begin(seed)).
import { JSDOM } from "jsdom";

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const w = dom.window;
for (const k of [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Element",
  "Node",
  "KeyboardEvent",
  "MouseEvent",
  "Event",
  "localStorage",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "matchMedia",
  "AbortController",
]) {
  if (!(k in globalThis) || k === "window" || k === "document" || k === "navigator" || k === "localStorage") {
    try {
      Object.defineProperty(globalThis, k, { value: w[k] ?? globalThis[k], configurable: true, writable: true });
    } catch {
      /* read-only global */
    }
  }
}
if (!w.matchMedia) w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.matchMedia = w.matchMedia;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!w.ResizeObserver) {
  w.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  globalThis.ResizeObserver = w.ResizeObserver;
}
const errors = [];
let failed = 0;
w.addEventListener("error", (e) => errors.push("window.error: " + (e.error?.stack || e.message)));
process.on("unhandledRejection", (e) => errors.push("unhandledRejection: " + (e?.stack || e)));
const origErr = console.error;
console.error = (...a) => {
  const m = a.map(String).join(" ");
  if (/Warning: |act\(/.test(m) === false) errors.push("console.error: " + m.slice(0, 300));
};

import { createServer } from "vite";
import react from "@vitejs/plugin-react";
const server = await createServer({
  configFile: false,
  plugins: [react()],
  resolve: { alias: { "@": new URL("../src", import.meta.url).pathname } },
  server: { middlewareMode: true, hmr: false },
  appType: "custom",
  logLevel: "silent",
});
try {
  const React = (await import("react")).default;
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { ThresholdApp } = await server.ssrLoadModule("/src/components/game/ThresholdApp.tsx");
  const root = createRoot(w.document.getElementById("root"));
  const flush = async () => {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
  };
  await act(async () => {
    root.render(React.createElement(ThresholdApp));
  });
  await flush();
  const text = () => w.document.body.textContent || "";
  const click = async (label) => {
    const btns = [...w.document.querySelectorAll("button")];
    const b = btns.find((x) => (x.textContent || "").trim().toUpperCase().startsWith(label.toUpperCase()));
    if (!b) throw new Error(`no button "${label}" — have: ${btns.slice(0, 30).map((x) => x.textContent.trim().slice(0, 22)).join(" | ")}`);
    await act(async () => {
      b.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    });
    await flush();
  };
  const step = async (name, fn) => {
    try {
      await fn();
      console.log("ok  ", name);
    } catch (e) {
      failed++;
      console.log("FAIL", name, "::", String(e.stack || e).split("\n").slice(0, 14).join("\n      "));
    }
  };

  await step("begin a new game", async () => {
    await click("BEGIN");
    if (!/END QUARTER/i.test(text())) throw new Error("main view not shown");
  });
  await step("end three quarters", async () => {
    for (let i = 0; i < 3; i++) {
      await click("END QUARTER");
      const ev = [...w.document.querySelectorAll("button")].filter((b) => b.closest('[role="dialog"]'));
      if (ev.length) {
        await act(async () => {
          ev[0].dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
        });
        await flush();
      }
    }
  });
  await step("open every tab", async () => {
    for (const t of ["OPERATIONS", "SUPPLY", "LAB", "VENTURES", "WORLD", "WIRE", "COMMAND"]) await click(t);
  });
  await step("New → confirm → begin (new game while playing)", async () => {
    await click("NEW");
    const d = [...w.document.querySelectorAll("button")].filter((b) => b.closest('[role="dialog"]'));
    const go = d.find((b) => /start|new|begin|yes|confirm/i.test(b.textContent)) ?? d[0];
    await act(async () => {
      go.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    });
    await flush();
    if (/BEGIN/i.test(text())) await click("BEGIN");
    if (!/END QUARTER/i.test(text())) throw new Error("main view not shown after new game");
  });
  await step("new game from OPERATIONS tab", async () => {
    await click("OPERATIONS");
    await click("NEW");
    const d = [...w.document.querySelectorAll("button")].filter((b) => b.closest('[role="dialog"]'));
    const go = d.find((b) => /start|new|begin|yes|confirm/i.test(b.textContent)) ?? d[0];
    await act(async () => {
      go.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
    });
    await flush();
    if (/BEGIN/i.test(text())) await click("BEGIN");
    if (!/END QUARTER/i.test(text())) throw new Error("main view not shown");
  });
  await step("reload with a save → Continue", async () => {
    await act(async () => {
      root.unmount();
    });
    const root2 = createRoot(w.document.getElementById("root"));
    await act(async () => {
      root2.render(React.createElement(ThresholdApp));
    });
    await flush();
    await click("CONTINUE");
    if (!/END QUARTER/i.test(text())) throw new Error("continue did not resume");
  });
} finally {
  await server.close();
  console.error = origErr;
}
console.log("\nruntime errors captured:", errors.length);
for (const e of [...new Set(errors)].slice(0, 12)) console.log(" -", e.slice(0, 500));
if (errors.length || failed) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: begin, play, tabs, new-game-while-playing, continue.");
