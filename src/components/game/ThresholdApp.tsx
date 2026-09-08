import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Action,
  type BackgroundId,
  type GameState,
  CONCEPTS,
  LAST,
  REAL_HISTORY_ENDS,
  applyAction,
  dateOf,
  derive,
  endingView,
  debriefFacts,
  worldOutcome,
  eventChoiceCost,
  exportFilename,
  founderPaper,
  formatSeed,
  randomSeed,
  hasLocalSave,
  loadLocal,
  maxActions,
  money,
  previewQuarter,
  resolveQuarter,
  saveLocal,
  clearLocal,
  deserialize,
  serialize,
  initState,
} from "@/game";
import { CommandView } from "./CommandView";
import { LabView, SupplyView, VenturesView, WireView, WorldView } from "./TabsViews";
import { TitleScreen } from "./TitleScreen";
import { FrontierChart } from "./FrontierChart";
import { GhostBtn, Panel, Sparkline, Still } from "./primitives";
import { STILLS } from "./stills";
import { useGameSound } from "./useGameSound";
import { SandboxLoader } from "./sandbox-load";

const OperationsView = lazy(() => import("./OperationsView").then((module) => ({ default: module.OperationsView })));

const TABS = ["COMMAND", "OPERATIONS", "SUPPLY", "LAB", "VENTURES", "WORLD", "WIRE"] as const;

export function ThresholdApp() {
  const [hasSave, setHasSave] = useState(false);
  const [started, setStarted] = useState(false);
  const [background, setBackground] = useState<BackgroundId>("research");
  const [s, setS] = useState<GameState>(() => initState({ background: "research" }));
  const [tab, setTab] = useState<(typeof TABS)[number]>("COMMAND");
  const [concept, setConcept] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [wireFilter, setWireFilter] = useState("all");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [presetSeed, setPresetSeed] = useState<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);
  const prevFocus = useRef<HTMLElement | null>(null);
  const sandboxLoader = useRef(new SandboxLoader(fetch));
  const [sandboxBusy, setSandboxBusy] = useState(false);
  const [titleErr, setTitleErr] = useState<string | null>(null);

  useEffect(() => {
    setHasSave(hasLocalSave());
  }, []);

  useEffect(() => {
    if (!started) return;
    const r = saveLocal(s);
    if (!r.ok) {
      setHasSave(false);
      setToast(`${r.reason} Export a copy if you need this run.`);
    } else {
      setHasSave(true);
    }
  }, [s, started]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const d = useMemo(() => derive(s), [s]);
  const f = useMemo(() => previewQuarter(s), [s]);
  const sound = useGameSound(s, started);
  const paper = founderPaper(s, d);
  const date = dateOf(Math.min(s.t, 72));
  const proj = s.t > REAL_HISTORY_ENDS;
  const sandbox = s.events.some((e) => e.text.startsWith("EXPANSION DEMO:"));

  const dispatch = useCallback((a: Action) => {
    setS((cur) => {
      const r = applyAction(cur, a);
      if (!r.ok) {
        setToast(r.reason);
        return cur;
      }
      return r.state;
    });
  }, []);

  const endQuarter = useCallback(() => {
    setS((cur) => {
      if (cur.over) return cur;
      if (cur.pendingEvent) {
        setToast("Resolve the current event first.");
        return cur;
      }
      if (cur.pendingEmergency) {
        setToast("Resolve emergency financing first.");
        return cur;
      }
      return resolveQuarter(cur);
    });
  }, []);

  function dropPendingSandbox() {
    sandboxLoader.current.cancel();
    setSandboxBusy(false);
  }

  function begin(seed?: number) {
    dropPendingSandbox();
    setTitleErr(null);
    setImportErr(null);
    const next = initState({ background, seed: seed ?? randomSeed() });
    setS(next);
    setStarted(true);
    setTab("COMMAND");
    setConfirmNew(false);
    setPresetSeed(undefined);
  }

  function cont() {
    dropPendingSandbox();
    setTitleErr(null);
    const loaded = loadLocal();
    if (!loaded.ok) {
      setTitleErr(loaded.reason);
      return;
    }
    setS(loaded.state);
    setStarted(true);
  }

  function doImport(text: string, nextTab?: (typeof TABS)[number], toastMsg?: string) {
    dropPendingSandbox();
    const r = deserialize(text);
    if (!r.ok) {
      if (started) setImportErr(r.reason);
      else setTitleErr(r.reason);
      return;
    }
    setImportErr(null);
    setTitleErr(null);
    setS(r.state);
    setStarted(true);
    if (nextTab) setTab(nextTab);
    const wr = saveLocal(r.state);
    if (!wr.ok) setToast(`${wr.reason} The run is loaded in memory — export a copy.`);
    else setToast(toastMsg ?? "Imported.");
  }

  function loadSandbox() {
    setSandboxBusy(true);
    setTitleErr(null);
    setImportErr(null);
    void sandboxLoader.current.load().then((result) => {
      if (result.status === "ignored") return;
      setSandboxBusy(false);
      if (result.status === "error") {
        setTitleErr(result.reason);
        return;
      }
      const r = deserialize(result.text);
      if (!r.ok) {
        setTitleErr(r.reason);
        return;
      }
      setImportErr(null);
      setTitleErr(null);
      setS(r.state);
      setStarted(true);
      setTab("OPERATIONS");
      const wr = saveLocal(r.state);
      if (!wr.ok) setToast(`${wr.reason} The run is loaded in memory — export a copy.`);
      else setToast("Sandbox loaded — Q3 2024. Not an earned campaign.");
    });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setConcept(null);
        setConfirmNew(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!started) {
    return (
      <>
        <div className="grain" aria-hidden />
        <TitleScreen
          hasSave={hasSave}
          background={background}
          onBackground={setBackground}
          onBegin={(seed) => begin(seed)}
          onContinue={cont}
          onSandbox={loadSandbox}
          onCancelSandbox={() => {
            dropPendingSandbox();
            setTitleErr(null);
          }}
          sandboxBusy={sandboxBusy}
          error={titleErr}
          presetSeed={presetSeed}
        />
      </>
    );
  }

  if (s.over) {
    return (
      <>
        <div className="grain" aria-hidden />
        <EndingScreen
          s={s}
          onAgain={() => {
            clearLocal();
            setStarted(false);
            setHasSave(false);
            setPresetSeed(undefined);
            setS(initState({ background, seed: randomSeed() }));
          }}
          onReplay={() => {
            const next = initState({ background: s.background, seed: s.seed });
            setBackground(s.background);
            setS(next);
            setStarted(true);
            setTab("COMMAND");
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="grain" aria-hidden />
      <header className="sticky top-0 z-20 border-b border-line bg-panel/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-sm tracking-[0.22em]">THRESHOLD</span>
            <span className="font-mono text-base tabular text-ink">{date.label}</span>
            {proj && <span className="font-mono text-2xs tracking-wider text-abroad">PROJECTED</span>}
            {sandbox && (
              <span className="font-mono text-2xs tracking-wider text-power" title="Synthetic late-game fixture. Not an earned campaign.">
                SANDBOX
              </span>
            )}
            <span className="hidden font-mono text-2xs tracking-wider text-ink-faint sm:inline" title="Campaign seed">
              0x{formatSeed(s.seed)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-power" aria-label={`${s.actions} actions remaining`}>
              {"◆".repeat(s.actions) + "◇".repeat(Math.max(0, maxActions(s) - s.actions))}
              <span className="ml-2 text-ink-muted">{s.actions} action{s.actions === 1 ? "" : "s"}</span>
            </span>
            <GhostBtn
              tone="ink"
              className="px-2 py-1 text-2xs"
              pressed={sound.enabled}
              title={sound.error || "Optional sound cues. Muted by default."}
              onClick={sound.toggle}
            >
              Sound {sound.enabled ? "on" : "off"}
            </GhostBtn>
            <GhostBtn tone="ink" className="px-2 py-1 text-2xs" onClick={() => setConfirmNew(true)}>
              New
            </GhostBtn>
            <GhostBtn tone="ink" className="px-2 py-1 text-2xs" onClick={() => downloadSave(s)}>
              Export
            </GhostBtn>
            <GhostBtn tone="ink" className="px-2 py-1 text-2xs" onClick={() => fileRef.current?.click()}>
              Import
            </GhostBtn>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                file.text().then(doImport);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        <div className="h-px bg-line">
          <div className="h-px bg-chip" style={{ width: `${(s.t / LAST) * 100}%` }} />
        </div>
        <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-x-5 gap-y-2 px-4 py-2.5 font-mono text-xs">
          <Head k="PAPER" v={money(paper)} c="text-money" />
          <Head k="CASH" v={money(s.cash)} c={s.cash < 1e6 ? "text-risk" : "text-ink"} />
          <Head k="RUNWAY" v={f.runwayQuarters === null ? "∞" : `${f.runwayQuarters}q`} c={f.runwayQuarters !== null && f.runwayQuarters < 4 ? "text-risk" : "text-ink"} />
          <Head k="RESEARCH" v={d.researchCap.toFixed(1)} c="text-chip" />
          <Head k="SHIPPED" v={s.deployedCap.toFixed(1)} c="text-chip" />
          <Head k="FRONTIER" v={d.frontier.toFixed(1)} c={d.researchCap >= d.frontier - 0.05 ? "text-chip" : "text-ink-muted"} />
          <Head k="ABROAD" v={s.chinaCap.toFixed(1)} c="text-abroad" />
          <Head k="HAZARD" v={s.risk.toFixed(0)} c={s.risk > 55 ? "text-risk" : "text-ink-muted"} />
          <RaceMeter you={d.researchCap} abroad={s.chinaCap} frontier={d.frontier} />
          <Sparkline values={s.history.map((h) => h.cap)} className="mb-0.5 hidden sm:block" />
        </div>
        <nav className="flex gap-0 overflow-x-auto border-t border-line bg-bg" aria-label="Sections">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={
                "whitespace-nowrap px-4 py-2.5 font-mono text-micro tracking-widest transition-colors duration-150 " +
                (tab === t ? "border-b-2 border-chip bg-panel-2 text-ink" : "border-b-2 border-transparent text-ink-muted hover:text-ink")
              }
            >
              {t}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-4 pb-28 lg:pb-8">
        {!s.seenChecklist && tab === "COMMAND" && (
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-chip/35 bg-panel px-3 py-2">
            <span className="font-mono text-micro tracking-widest text-chip">Q0</span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-cream">
              Runway is finite. Binding constraint is <span className="text-ink">{d.bottleneck}</span>.
              Put something in the pipeline, set train/serve, then end the quarter. Dilution buys time.
            </p>
            <GhostBtn className="ml-auto" onClick={() => dispatch({ type: "dismissChecklist" })}>
              Dismiss
            </GhostBtn>
          </div>
        )}

        {tab === "COMMAND" && (
          <CommandView s={s} d={d} f={f} dispatch={dispatch} onEnd={endQuarter} onConcept={(id) => { prevFocus.current = document.activeElement as HTMLElement; setConcept(id); }} onTab={(t) => setTab(t as (typeof TABS)[number])} />
        )}
        {tab === "OPERATIONS" && (
          <Suspense fallback={<p className="py-8 text-ink-muted" role="status">Opening Operations…</p>}>
            <OperationsView key={s.seed} s={s} dispatch={dispatch} onTab={(t) => setTab(t as (typeof TABS)[number])} onEnd={endQuarter} />
          </Suspense>
        )}
        {tab === "SUPPLY" && <SupplyView s={s} dispatch={dispatch} onConcept={setConcept} />}
        {tab === "LAB" && <LabView s={s} dispatch={dispatch} onConcept={setConcept} />}
        {tab === "VENTURES" && <VenturesView s={s} d={d} dispatch={dispatch} onConcept={setConcept} />}
        {tab === "WORLD" && <WorldView s={s} d={d} dispatch={dispatch} onConcept={setConcept} />}
        {tab === "WIRE" && <WireView s={s} filter={wireFilter} onFilter={setWireFilter} />}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel p-3 lg:hidden">
        <button
          type="button"
          onClick={endQuarter}
          className="end-q min-h-12 w-full rounded-sm font-mono text-sm text-power"
        >
          END QUARTER →
        </button>
      </div>

      {sound.error && (
        <div role="status" className="fixed bottom-20 left-4 z-40 max-w-sm border border-line bg-panel px-3 py-2 font-mono text-xs text-ink">
          {sound.error}
        </div>
      )}
      {toast && (
        <div role="status" className="fixed bottom-20 right-4 z-40 max-w-sm border border-risk bg-panel px-3 py-2 font-mono text-xs text-risk shadow-panel lg:bottom-4">
          {toast}
        </div>
      )}
      {importErr && (
        <div role="alert" className="fixed bottom-32 right-4 z-40 max-w-sm border border-risk bg-panel px-3 py-2 text-sm">
          Import failed: {importErr}. Current run is unchanged.
        </div>
      )}

      {s.pendingEvent && (
        <Modal title={s.pendingEvent.title} onClose={() => undefined} closeable={false}>
          <p className="text-sm leading-relaxed text-cream">{s.pendingEvent.body}</p>
          <div className="mt-4 grid gap-2">
            {s.pendingEvent.choices.map((c) => {
              const cost = eventChoiceCost(s, s.pendingEvent!.id, c.id);
              const unaffordable = cost > 0 && s.cash < cost;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={unaffordable}
                  title={unaffordable ? `Need ${money(cost)}. You have ${money(s.cash)}.` : undefined}
                  onClick={() => dispatch({ type: "chooseEvent", choice: c.id })}
                  className={
                    "rounded-md border p-3 text-left transition-[border-color,background-color] duration-150 " +
                    (unaffordable ? "cursor-not-allowed border-line opacity-50" : "border-line hover:border-chip")
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-mono text-sm text-chip">{c.label}</div>
                    {cost > 0 && (
                      <div className={"font-mono text-2xs tabular " + (unaffordable ? "text-risk" : "text-power")}>
                        {money(cost)}
                      </div>
                    )}
                  </div>
                  <div className="mt-1 text-xs leading-relaxed text-ink-muted">{c.detail}</div>
                  {unaffordable && (
                    <div className="mt-1 font-mono text-2xs text-risk">
                      Unaffordable — you have {money(s.cash)}.
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </Modal>
      )}

      {s.pendingEmergency && (
        <Modal title="Cash would go negative" onClose={() => undefined} closeable={false}>
          <p className="text-sm leading-relaxed text-cream">
            Committing this quarter would leave the company {money(-s.pendingEmergency.gap)} short. A draw of{" "}
            {money(s.pendingEmergency.draw)} covers that gap plus same-quarter interest on the new principal. There is
            no silent overdraft.
          </p>
          <div className="mt-4 grid gap-2">
            <GhostBtn
              tone="power"
              disabled={s.pendingEmergency.creditAvail + 1 < s.pendingEmergency.draw}
              title={
                s.pendingEmergency.creditAvail + 1 < s.pendingEmergency.draw
                  ? "Credit line cannot cover the draw including interest"
                  : undefined
              }
              onClick={() => dispatch({ type: "emergency", choice: "credit" })}
            >
              Draw {money(s.pendingEmergency.draw)} at {(s.pendingEmergency.loanRate * 400).toFixed(0)}% APR
              <span className="mt-1 block text-2xs text-ink-muted">
                Covers {money(s.pendingEmergency.gap)} shortfall · available {money(s.pendingEmergency.creditAvail)}
              </span>
            </GhostBtn>
            <GhostBtn
              tone="money"
              disabled={!s.pendingEmergency.canDistressed}
              onClick={() => dispatch({ type: "emergency", choice: "distressed" })}
            >
              Distressed raise {money(s.pendingEmergency.distressedAmount)}
              <span className="mt-1 block text-2xs text-ink-muted">Punitive dilution. Two rescues is the maximum.</span>
            </GhostBtn>
            <GhostBtn tone="risk" onClick={() => dispatch({ type: "emergency", choice: "default" })}>
              Accept insolvency
            </GhostBtn>
          </div>
        </Modal>
      )}

      {concept && (
        <ConceptModal
          id={concept}
          onClose={() => {
            setConcept(null);
            prevFocus.current?.focus();
          }}
        />
      )}

      {confirmNew && (
        <Modal title="Start over?" onClose={() => setConfirmNew(false)}>
          <p className="text-sm text-cream">This replaces the current run. Export first if you want it.</p>
          <div className="mt-4 flex gap-2">
            <GhostBtn tone="risk" onClick={begin}>
              New game
            </GhostBtn>
            <GhostBtn tone="ink" onClick={() => setConfirmNew(false)}>
              Cancel
            </GhostBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Head({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div>
      <div className="text-2xs tracking-widest text-ink-muted">{k}</div>
      <div className={`tabular ${c}`}>{v}</div>
    </div>
  );
}

function RaceMeter({ you, abroad, frontier }: { you: number; abroad: number; frontier: number }) {
  const w = (n: number) => `${Math.min(100, (n / 90) * 100)}%`;
  return (
    <div className="min-w-36 flex-1" title={`You ${you.toFixed(1)} · frontier ${frontier.toFixed(1)} · abroad ${abroad.toFixed(1)} / 90`}>
      <div className="text-2xs tracking-widest text-ink-muted">RACE / 90</div>
      <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-bg-sunken">
        <div className="race-fill absolute inset-y-0 left-0 bg-chip/80" style={{ width: w(you) }} />
        <div className="absolute top-0 h-1.5 w-px bg-risk" style={{ left: "100%", display: "none" }} />
      </div>
      <div className="relative mt-0.5 h-1 overflow-hidden rounded-full bg-bg-sunken">
        <div className="race-fill absolute inset-y-0 left-0 bg-abroad/80" style={{ width: w(abroad) }} />
      </div>
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
  closeable = true,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  closeable?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    const prev = document.activeElement as HTMLElement | null;
    node?.querySelector<HTMLElement>("button, [href], input")?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && closeable) onClose();
      if (e.key === "Tab" && node) {
        const list = [...node.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter((el) => !el.hasAttribute("disabled"));
        if (list.length === 0) return;
        const first = list[0]!;
        const last = list[list.length - 1]!;
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [closeable, onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg-sunken/80 p-4"
      role="presentation"
      onClick={() => closeable && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-in max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg border border-chip bg-panel p-5 shadow-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div id="modal-title" className="font-mono text-micro tracking-widest text-chip">
          {title}
        </div>
        <div className="mt-3">{children}</div>
        {closeable && (
          <GhostBtn tone="ink" className="mt-4" onClick={onClose}>
            Close
          </GhostBtn>
        )}
      </div>
    </div>
  );
}

function ConceptModal({ id, onClose }: { id: string; onClose: () => void }) {
  const con = CONCEPTS.find((c) => c.id === id);
  if (!con) return null;
  return (
    <Modal title="CONCEPT" onClose={onClose}>
      <h2 className="font-sans text-2xl font-light">{con.term}</h2>
      <p className="mt-1 font-mono text-2xs tracking-wider text-ink-faint">{con.provenance.toUpperCase()}</p>
      <p className="mt-3 text-sm leading-relaxed text-cream">{con.body}</p>
      {"source" in con && con.source && (
        <a href={con.source} className="mt-3 inline-block font-mono text-micro text-chip underline" target="_blank" rel="noreferrer">
          {con.source}
        </a>
      )}
    </Modal>
  );
}

function EndingScreen({ s, onAgain, onReplay }: { s: GameState; onAgain: () => void; onReplay: () => void }) {
  const e = endingView(s);
  const facts = debriefFacts(s);
  const world = worldOutcome(s);
  const seedHex = formatSeed(s.seed);
  const color = {
    money: "text-money",
    chip: "text-chip",
    power: "text-power",
    risk: "text-risk",
    abroad: "text-abroad",
    dim: "text-ink-muted",
  }[e.color];
  const worldColor = {
    chip: "text-chip",
    power: "text-power",
    risk: "text-risk",
    abroad: "text-abroad",
  }[world.color];
  const worldBar = {
    chip: "bg-chip",
    power: "bg-power",
    risk: "bg-risk",
    abroad: "bg-abroad",
  }[world.color];
  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg px-5 py-12 text-ink">
      <div className="pointer-events-none absolute inset-0">
        <Still src={STILLS.ending} className="opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-b from-bg/70 via-bg/55 to-bg" />
      </div>
      <div className="pointer-events-none absolute inset-0 opacity-25">
        <FrontierChart s={s} />
      </div>
      <div className="vignette pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-3xl">
        <div className={`font-mono text-micro tracking-widest ${color}`}>{e.kicker}</div>
        <h1 className="mt-2 font-sans text-4xl font-light tracking-tight sm:text-5xl">{e.title}</h1>
        {e.body.map((p, i) => (
          <p key={i} className="mt-4 text-base leading-relaxed text-cream">{p}</p>
        ))}

        <section className="mt-8 rounded-lg border border-line bg-panel/90 p-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="font-mono text-micro tracking-widest text-ink-muted">SCENARIO ASSESSMENT</div>
              <div className={`mt-1 font-mono text-lg tracking-widest ${worldColor}`}>{world.label}</div>
            </div>
            <div className={`font-mono text-2xl tabular ${worldColor}`}>{world.score}</div>
          </div>
          <div className="assess-track mt-3">
            <div className={`assess-fill ${worldBar}`} style={{ width: `${world.score}%` }} />
          </div>
          <p className="mt-3 font-mono text-2xs leading-relaxed text-ink-faint">
            A scenario heuristic, not a calibrated safety score. It uses the crossing record stored at
            resolution{facts.crossingReason ? ` (${facts.crossingReason})` : ""}.
            {facts.hazardAtCrossing != null ? ` Hazard at crossing ${facts.hazardAtCrossing.toFixed(0)}.` : ""}
          </p>
          {world.lines.map((line, i) => (
            <p key={i} className="mt-2 text-sm leading-relaxed text-cream">{line}</p>
          ))}
        </section>

        <div className="mt-4 border border-line bg-panel/90 p-4 font-mono text-sm backdrop-blur-sm">
          <Fact k="Campaign seed" v={`0x${seedHex}`} />
          <Fact k="Personal net worth" v={money(facts.nw)} />
          <Fact k="Founder paper (capital path)" v={money(facts.paper)} />
          <Fact k="Company valuation" v={money(facts.val)} />
          <Fact k="Ownership" v={`${(facts.ownership * 100).toFixed(2)}% · ${facts.raises} rounds`} />
          <Fact k="Research / deployed / frontier" v={`${facts.researchCap.toFixed(1)} / ${facts.deployed.toFixed(1)} / ${facts.frontier.toFixed(1)}`} />
          <Fact k="Alignment pillars" v={`${facts.align} / 6`} />
          <Fact k="Incidents" v={String(facts.incidents)} />
          <Fact k="Abroad" v={`${facts.china.toFixed(1)} · ${facts.leaks} leaks`} />
          <Fact k="Longest bottleneck" v={`${facts.longestBottleneck.kind} · ${facts.longestBottleneck.quarters}q`} />
          <Fact k="Idle-chip quarters" v={String(facts.idleChipQuarters)} />
          <Fact k="Named researchers on staff" v={facts.roster.length ? facts.roster.join(", ") : "none"} />
          {facts.vsRecord && (
            <Fact k="You vs the record, Q2 2026" v={`${facts.vsRecord.you.toFixed(1)} vs ~${facts.vsRecord.record} (${facts.vsRecord.delta >= 0 ? "+" : ""}${facts.vsRecord.delta.toFixed(1)})`} />
          )}
        </div>
        <Panel title="DEBRIEF" className="mt-4">
          <p className="text-sm leading-relaxed text-cream">
            Capability is a gameplay abstraction of cumulative training compute, not a scientific definition of ASI.
            {facts.raises > 4
              ? ` You raised ${facts.raises} times and ended at ${(facts.ownership * 100).toFixed(1)}% — a small slice of a large company is the usual shape.`
              : ` You raised ${facts.raises} time(s) and kept ${(facts.ownership * 100).toFixed(1)}%.`}
            {facts.ventures >= 4
              ? ` You went wide — ${facts.ventures} ventures.`
              : ` You stayed close to the lab (${facts.ventures} ventures).`}
          </p>
        </Panel>
        <div className="mt-6 flex flex-wrap gap-2">
          <GhostBtn filled tone="chip" className="min-h-12 px-5 py-3" onClick={onAgain}>
            Play again
          </GhostBtn>
          <GhostBtn tone="ink" className="min-h-12 px-5 py-3" onClick={onReplay}>
            Replay seed 0x{seedHex}
          </GhostBtn>
          <GhostBtn tone="ink" className="min-h-12 px-5 py-3" onClick={() => downloadSave(s)}>
            Export final state
          </GhostBtn>
        </div>
      </div>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 text-xs">
      <span className="text-ink-muted">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function downloadSave(s: GameState) {
  const blob = new Blob([serialize(s)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = exportFilename(s.seed);
  a.click();
  URL.revokeObjectURL(url);
}
