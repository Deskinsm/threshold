import {
  type Action,
  type Forecast,
  type GameState,
  type Derived,
  arriveLabel,
  canRaise,
  dateOf,
  hireCost,
  hireCount,
  money,
  mw,
  num,
  pct,
  raiseSize,
  ventureIncome,
  valuationParts,
  netWorthOf,
  valuationOf,
  founderPaper,
  SECONDARY_POINTS,
  ILLIQUIDITY,
} from "@/game";
import { ActRow, GhostBtn, Panel, Still } from "./primitives";
import { cn } from "@/lib/cn";
import { STILLS, rivalStill } from "./stills";

export function CommandView({
  s,
  d,
  f,
  dispatch,
  onEnd,
  onConcept,
  onTab,
}: {
  s: GameState;
  d: Derived;
  f: Forecast;
  dispatch: (a: Action) => void;
  onEnd: () => void;
  onConcept: (id: string) => void;
  onTab: (t: string) => void;
}) {
  const nw = netWorthOf(s, d);
  const val = valuationOf(s, d);
  const parts = valuationParts(s, d);
  const raiseGate = canRaise(s);
  const raiseAmt = raiseSize(s, d);
  const hireC = hireCost(s);
  const safetyCost = Math.max(4e6, s.revenue * 0.35);
  const bottleneckHint =
    d.bottleneck === "chips"
      ? "Buy accelerators on Supply."
      : d.bottleneck === "power"
        ? "File interconnection or buy turbines."
        : d.bottleneck === "fabric"
          ? "Order fabric or the fiber venture."
          : "Nothing is live yet.";

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
      <div>
        <Panel title="COMPUTE" hint={() => onConcept("traininf")} className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 opacity-[0.22]" aria-hidden>
            <Still src={STILLS.compute} />
            <div className="absolute inset-0 bg-gradient-to-b from-panel via-panel/75 to-panel" />
          </div>
          <div className="relative">
          <div className="mb-3 flex justify-end">
            <GhostBtn onClick={() => onTab("OPERATIONS")}>Open live operations</GhostBtn>
          </div>
          <p className="mb-3 font-mono text-xs leading-relaxed text-ink-muted">
            Usable compute is the <span className="text-ink">minimum</span> of chips, energized power, and
            fabric. Each column is utilization of that resource. The shortest usable stack is the live fleet.
          </p>
          {d.downtimeMul < 1 && (
            <div className="mb-3 rounded-md border border-risk/50 bg-risk/10 px-3 py-2 font-mono text-xs text-risk">
              Containment: live compute ×{d.downtimeMul.toFixed(1)} this quarter. Ownership unchanged — {num(s.chips)} accelerators still on the books.
            </div>
          )}
          <ComputeTanks s={s} d={d} onConcept={onConcept} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-line bg-panel-2 px-3 py-2 font-mono text-xs">
            <div>
              <span className="text-ink-muted">BINDING </span>
              <span className={d.bottleneck === "power" ? "text-power" : d.bottleneck === "fabric" ? "text-money" : "text-chip"}>
                {d.bottleneck.toUpperCase()}
              </span>
              <span className="text-ink-muted">
                {" "}
                · live {num(d.live)} · idle {num(d.idleChips)}
              </span>
            </div>
            <button type="button" className="text-chip underline-offset-2 hover:underline" onClick={() => onTab("SUPPLY")}>
              {bottleneckHint}
            </button>
          </div>
          </div>
        </Panel>

        <Panel title="ALLOCATION" hint={() => onConcept("traininf")}>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span className="text-chip">TRAIN {(s.trainShare * 100).toFixed(0)}%</span>
            <span className="text-money">SERVE {((1 - s.trainShare) * 100).toFixed(0)}%</span>
          </div>
          <label className="sr-only" htmlFor="train-share">
            Training versus serving allocation
          </label>
          <input
            id="train-share"
            type="range"
            min={0}
            max={100}
            value={Math.round(s.trainShare * 100)}
            onChange={(e) => dispatch({ type: "setTrainShare", share: Number(e.target.value) / 100 })}
            className="w-full"
          />
          <div className="mt-2 flex justify-between font-mono text-micro text-ink-muted">
            <span>+{f.capDelta.toFixed(2)} research cap next quarter</span>
            <span>{money(f.revenue)} projected serving</span>
          </div>
          <p className="mt-2 font-mono text-micro text-ink-faint">Free. No action. The only decision you make every quarter.</p>
        </Panel>

        <Panel title="MODEL" hint={() => onConcept("release")}>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs sm:grid-cols-4">
            <Stat k="research" v={d.researchCap.toFixed(1)} />
            <Stat k="deployed" v={s.deployedCap.toFixed(1) + (s.deployMode !== "none" ? ` ${s.deployMode}` : " none")} />
            <Stat k="candidate" v={s.candidate ? s.candidate.cap.toFixed(1) : "—"} />
            <Stat k="eval" v={s.candidate ? (s.candidate.evaluated ? "done" : "open") : "—"} />
          </div>
          {s.candidate?.evalNotes && <p className="mt-2 text-xs text-ink-muted">{s.candidate.evalNotes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <GhostBtn tone="chip" disabled={s.actions < 1 || !!s.over} onClick={() => dispatch({ type: "prepareCandidate" })}>
              Cut candidate
            </GhostBtn>
            <GhostBtn tone="ink" disabled={s.actions < 1 || !s.candidate} onClick={() => dispatch({ type: "evaluateCandidate" })}>
              Evaluate
            </GhostBtn>
            <GhostBtn tone="money" disabled={s.actions < 1 || !s.candidate} onClick={() => dispatch({ type: "deploy", mode: "limited" })}>
              Limited release
            </GhostBtn>
            <GhostBtn tone="power" disabled={s.actions < 1 || !s.candidate} onClick={() => dispatch({ type: "deploy", mode: "broad" })}>
              Broad release
            </GhostBtn>
          </div>
          <p className="mt-2 font-mono text-micro text-ink-faint">
            Serving revenue and the threshold crossing track what you have shipped, not what you have trained.
          </p>
        </Panel>

        <Panel title="THE QUARTER">
          <ActRow
            label={`Hire researchers (+${hireCount(s)})`}
            sub={`Talent moves with headcount. Signing ${money(hireC)}.`}
            cost={money(hireC)}
            ok={s.actions > 0 && s.cash >= hireC}
            reason={s.actions < 1 ? "No actions left" : s.cash < hireC ? "Not enough cash" : undefined}
            onClick={() => dispatch({ type: "hire" })}
          />
          <ActRow
            label="Safety review"
            sub="Hazard −9, preparedness +4, trust +6. Capability unchanged."
            cost={money(safetyCost)}
            ok={s.actions > 0 && s.cash >= safetyCost}
            reason={s.cash < safetyCost ? "Not enough cash" : "No actions left"}
            onClick={() => dispatch({ type: "safetyPush" })}
          />
          <ActRow
            label={`Raise a round — ${money(raiseAmt)}`}
            sub={`Dilutes you from ${pct(s.ownership)} to ${pct(s.ownership * (val / Math.max(1, val + raiseAmt)))}. Valuation is ops + assets + cash − debt.`}
            cost="1 action"
            ok={s.actions > 0 && raiseGate.ok}
            reason={raiseGate.ok ? "No actions left" : raiseGate.reason}
            onClick={() => dispatch({ type: "raise" })}
            info={() => onConcept("dilution")}
          />
          <ActRow
            label="Sell 2 percentage points (secondary)"
            sub={`${money(val * SECONDARY_POINTS * ILLIQUIDITY)} personal cash. Company cash unchanged.`}
            cost="1 action"
            ok={s.actions > 0 && s.ownership > 0.04}
            reason="Need a 2% ownership floor"
            onClick={() => dispatch({ type: "secondary" })}
          />
        </Panel>

        <ForecastBlock s={s} d={d} f={f} />

        <button
          type="button"
          onClick={onEnd}
          className="end-q mt-1 min-h-12 w-full rounded-sm px-4 py-3 font-mono text-sm tracking-wide text-power transition-transform duration-150 active:scale-[0.96]"
        >
          END QUARTER → {dateOf(Math.min(s.t + 1, 72)).label}
        </button>
        {f.wouldInsolvent && (
          <p className="mt-2 text-center font-mono text-micro text-risk">
            This quarter would exhaust cash. Ending it opens emergency financing.
          </p>
        )}
      </div>

      <aside>
        <Panel title="THIS QUARTER">
          <Row k="Cash" v={money(s.cash)} warn={s.cash < 0} />
          <Row k="Runway" v={f.runwayQuarters === null ? "cash-flow positive" : `${f.runwayQuarters} qtr`} warn={f.runwayQuarters !== null && f.runwayQuarters < 4} />
          <Row k="Paper" v={money(founderPaper(s, d))} />
          <Row k="Net worth" v={money(nw)} />
          <Row k="Ownership" v={pct(s.ownership, 2)} />
          <Row k="Debt" v={money(s.debt.principal)} warn={s.debt.principal > 0} />
          <Row k="Valuation" v={money(val)} />
          <p className="mt-2 font-mono text-2xs leading-relaxed text-ink-faint">
            ops {money(parts.ops)} · assets {money(parts.assets)} · cash {money(parts.cash)} · debt −{money(parts.debt)}
          </p>
          <p className="mt-1 font-mono text-2xs text-ink-faint">Paper is founder claim on ops + assets − debt, excluding idle cash. Capital win uses paper.</p>
        </Panel>
        <Panel title="ON ORDER">
          {s.orders.length === 0 && s.construction.length === 0 && (
            <p className="text-sm text-ink-muted">Nothing in the pipeline. Empty is a decision about 2028.</p>
          )}
          {s.orders.map((o, i) => (
            <div key={i} className="flex justify-between gap-2 border-b border-line py-1.5 font-mono text-xs">
              <span>{o.label}</span>
              <span className="text-power">{arriveLabel(o.arrive)}</span>
            </div>
          ))}
          {s.construction.map((c) => (
            <div key={c.id} className="flex justify-between gap-2 border-b border-line py-1.5 font-mono text-xs">
              <span>{c.label} (build)</span>
              <span className="text-power">{arriveLabel(c.arrive)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="RIVALS">
          {s.rivals.map((r, i) => (
            <div key={r.id} className="mb-2 overflow-hidden rounded-md border-l-2 bg-panel-2" style={{ borderColor: r.color }}>
              <div className="relative h-12 sm:h-14">
                <Still src={rivalStill(r.id)} alt="" />
                <div className="absolute inset-0 bg-gradient-to-r from-panel-2 via-panel-2/80 to-panel-2/20" />
                <div className="absolute inset-0 flex items-end justify-between px-3 pb-1.5 font-mono text-xs">
                  <span style={{ color: r.color }}>{r.name}</span>
                  <span className="text-ink-muted">{r.tag}</span>
                </div>
              </div>
              <div className="px-3 pb-2 pt-1">
                <div className="h-1 overflow-hidden rounded-full bg-bg-sunken">
                  <div
                    className="h-full"
                    style={{ width: `${Math.min(100, (r.deployedCap / 90) * 100)}%`, background: r.color }}
                  />
                </div>
                <div className="mt-1 font-mono text-micro text-ink-muted">
                  research {d.rivalCaps[i]?.toFixed(1)} · shipped {r.deployedCap.toFixed(1)} / 90 · {num(r.chips)} chips
                </div>
              </div>
            </div>
          ))}
          <div className="overflow-hidden rounded-md border-l-2 border-abroad bg-panel-2">
            <div className="relative h-12 sm:h-14">
              <Still src={STILLS.china} alt="" />
              <div className="absolute inset-0 bg-gradient-to-r from-panel-2 via-panel-2/80 to-panel-2/20" />
              <div className="absolute inset-0 flex items-end px-3 pb-1.5 font-mono text-xs text-abroad">STATE PROGRAMME</div>
            </div>
            <div className="px-3 pb-2 pt-1">
              <div className="h-1 overflow-hidden rounded-full bg-bg-sunken">
                <div className="h-full bg-abroad" style={{ width: `${Math.min(100, (s.chinaCap / 90) * 100)}%` }} />
              </div>
              <div className="mt-1 font-mono text-micro text-ink-muted">
                {s.chinaCap.toFixed(1)} / 90 · lag {(d.frontier - s.chinaCap).toFixed(1)} · leaks {s.espionageEvents}
                {s.exportControls ? " · EXPORTS ON" : ""}
              </div>
            </div>
          </div>
        </Panel>
        {s.lastResolution && <ResolutionCard s={s} />}
      </aside>
    </div>
  );
}

function ComputeTanks({
  s,
  d,
  onConcept,
}: {
  s: GameState;
  d: Derived;
  onConcept: (id: string) => void;
}) {
  const items = [
    {
      id: "chips" as const,
      label: "ACCELERATORS",
      cap: s.chips,
      fill: "bg-chip",
      dim: "bg-chip/20",
      text: "text-chip",
      note: `${num(s.chips)} owned`,
      concept: "hbm",
    },
    {
      id: "power" as const,
      label: "POWER",
      cap: d.powerCap,
      fill: "bg-power",
      dim: "bg-power/20",
      text: "text-power",
      note: `${mw(s.mwSecured)} → ${num(d.powerCap)} chips`,
      concept: "power",
    },
    {
      id: "fabric" as const,
      label: "FABRIC",
      cap: d.fabCap,
      fill: "bg-money",
      dim: "bg-money/20",
      text: "text-money",
      note: `${num(d.fabCap)} networkable`,
      concept: "interconnect",
    },
  ];
  const maxAbs = Math.max(...items.map((i) => i.cap), 1);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {items.map((it) => {
        const phys = it.cap > 0 ? Math.min(1, d.physicalLive / it.cap) : 0;
        const util = it.cap > 0 ? Math.min(1, d.live / it.cap) : 0;
        const rel = Math.max(0.06, it.cap / maxAbs);
        const bind = d.bottleneck === it.id;
        return (
          <div
            key={it.id}
            className={cn(
              "rounded-md border p-2.5 sm:p-3",
              bind ? "border-current bg-panel-2" : "border-line",
              it.text,
            )}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="font-mono text-2xs tracking-widest">{it.label}</span>
              <button type="button" aria-label={`About ${it.label}`} onClick={() => onConcept(it.concept)} className="text-chip">
                [?]
              </button>
            </div>
            <div className="relative mt-2 h-32 overflow-hidden rounded-sm border border-line bg-bg-sunken tank-grid sm:h-40">
              <div className={cn("tank-fill absolute inset-x-0 bottom-0", it.dim)} style={{ height: `${rel * 100}%` }} />
              <div
                className={cn("tank-fill absolute inset-x-0 bottom-0 opacity-90", it.fill)}
                style={{ height: `${util * rel * 100}%` }}
              />
              {d.downtimeMul < 1 && phys > util && (
                <div
                  className="tank-hatch absolute inset-x-0"
                  style={{
                    bottom: `${util * rel * 100}%`,
                    height: `${(phys - util) * rel * 100}%`,
                  }}
                />
              )}
              <div
                className="absolute inset-x-0 border-t border-dashed border-ink/50"
                style={{ bottom: `${util * rel * 100}%` }}
              />
            </div>
            <div className={cn("mt-2 font-mono text-lg tabular leading-none sm:text-xl", bind ? "live-glow text-ink" : "text-ink")}>{num(it.cap)}</div>
            <div className="mt-1 font-mono text-2xs text-ink-muted">{it.note}</div>
            <div className="mt-0.5 font-mono text-2xs text-ink-faint">{(util * 100).toFixed(0)}% of this stack is live</div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">{k}</div>
      <div className="font-mono text-sm tabular">{v}</div>
    </div>
  );
}

function Row({ k, v, warn }: { k: string; v: string; warn?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5 font-mono text-xs">
      <span className="text-ink-muted">{k}</span>
      <span className={warn ? "text-risk" : "tabular"}>{v}</span>
    </div>
  );
}

function ForecastBlock({ s, d, f }: { s: GameState; d: Derived; f: Forecast }) {
  const unlocked = s.tech.includes("laws");
  return (
    <Panel title="NEXT QUARTER">
      <p className="mb-2 font-mono text-micro text-ink-faint">
        Last quarter actuals are labelled separately from this projection. Projection assumes no incidents.
      </p>
      <Row k="Projected serving" v={money(f.revenue)} />
      <Row k="Ventures" v={money(f.ventureIncome)} />
      <Row k="Opex" v={money(f.opex)} />
      <Row k="Interest" v={money(f.interest)} />
      <Row k="Net" v={money(f.net)} warn={f.net < 0} />
      <Row k="End cash" v={money(f.cashAfter)} warn={f.cashAfter < 0} />
      <Row k="Research cap" v={`${f.capBefore.toFixed(2)} → ${f.capAfter.toFixed(2)}`} />
      {f.deliveriesNext.length > 0 && (
        <p className="mt-2 font-mono text-micro text-chip">
          Installing at open of next quarter: {f.deliveriesNext.map((o) => o.label).join(", ")}
        </p>
      )}
      <p className="mt-2 font-mono text-2xs text-ink-faint">
        Last actual: serving {money(s.lastRevenue)} · opex {money(s.opex)} · ventures {money(ventureIncome(s, d))}
      </p>
      {unlocked && (
        <p className="mt-2 text-xs text-chip">Scaling Laws funded — multi-quarter forecast is on the Lab tab.</p>
      )}
      {!unlocked && (
        <p className="mt-2 font-mono text-2xs text-ink-faint">Cash warnings are always on. Multi-quarter capability forecast unlocks with Scaling Laws.</p>
      )}
    </Panel>
  );
}

function ResolutionCard({ s }: { s: GameState }) {
  const r = s.lastResolution!;
  return (
    <Panel title="LAST RESOLUTION">
      <Row k="Net" v={money(r.net)} warn={r.net < 0} />
      <Row k="Cap" v={`${r.capBefore.toFixed(2)} → ${r.capAfter.toFixed(2)}`} />
      <Row k="Cash" v={`${money(r.cashBefore)} → ${money(r.cashAfter)}`} />
      {r.incident && <p className="mt-2 font-mono text-micro text-risk">Incident this quarter.</p>}
      {r.deliveries.map((d) => (
        <p key={d} className="mt-1 font-mono text-micro text-chip">{d}</p>
      ))}
    </Panel>
  );
}
