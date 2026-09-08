import { CampusNetwork } from "./ExpansionPanels";
import type { Action } from "@/game";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Activity, Cpu, Network, Zap, ArrowUpRight, PackageCheck, FlaskConical, Radio } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { arriveLabel, num, mw, dateOf, SITE_NAMES, type GameState, type Resource } from "@/game";
import { Panel, GhostBtn } from "./primitives";
import { capacityTimeline, fleetSegments } from "./operations-model";
import { STILLS } from "./stills";

const COLORS = { chips: "var(--color-chip)", power: "var(--color-power)", fabric: "var(--color-money)" };
const NAMES = { chips: "Accelerators", power: "Power", fabric: "Network fabric" };
const ICONS = { chips: Cpu, power: Zap, fabric: Network };
const SEGMENT_COLORS = {
  train: "var(--color-chip)",
  serve: "var(--ops-serve)",
  paused: "var(--color-risk)",
  idle: "var(--color-line-strong)",
};

export function OperationsView({ s, dispatch, onTab, onEnd }: { s: GameState; dispatch: (a: Action) => void; onTab: (tab: string) => void; onEnd: () => void }) {
  const timeline = useMemo(() => capacityTimeline(s), [s]);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Resource>("chips");
  const [motion, setMotion] = useState(true);

  useEffect(() => {
    setOffset(0);
  }, [s.t]);

  const point = timeline[Math.min(offset, timeline.length - 1)]!;
  const future = point.t > s.t;
  const d = point.d;
  const capacity = { chips: point.chips, power: d.powerCap, fabric: d.fabCap };
  const max = Math.max(1, ...Object.values(capacity));
  const segments = fleetSegments(point.chips, d.live, d.physicalLive, s.trainShare);
  const total = point.chips > 0 ? point.chips : 1;
  const selectedIdle = Math.max(0, capacity[selected] - d.physicalLive);
  const deliveries = [
    ...s.expansion.cooling
      .filter((p) => p.arrive > s.t)
      .map((p) => ({ id: `cool-${p.site}`, at: p.arrive, name: `Cooling retrofit · ${SITE_NAMES[p.site]}` })),
    ...s.expansion.links
      .filter((p) => p.arrive > s.t)
      .map((p) => ({
        id: `link-${p.from}-${p.to}`,
        at: p.arrive,
        name: `Interconnect · ${SITE_NAMES[p.from]} ↔ ${SITE_NAMES[p.to]}`,
      })),
    ...s.orders.map((o, i) => ({ id: `o${i}`, at: o.arrive, name: o.label })),
    ...s.construction.map((c) => ({ id: c.id, at: c.arrive, name: c.label })),
  ].sort((a, b) => a.at - b.at);
  const chart = timeline.map((p) => ({
    t: p.t,
    live: Math.round(p.d.live),
    idle: Math.round(Math.max(0, p.chips - p.d.live)),
    date: dateOf(p.t).label,
  }));

  return (
    <div className={`ops-view ${motion ? "" : "ops-still"}`}>
      <section className="ops-heading">
        <div>
          <p className="ops-eyebrow">
            <Activity size={16} aria-hidden /> OPERATIONS
          </p>
          <h1>The machine behind the model.</h1>
          <p>Trace the constraint. Watch the capacity come online.</p>
        </div>
        <GhostBtn
          tone="ink"
          className="ops-motion min-h-11"
          pressed={!motion}
          onClick={() => setMotion((v) => !v)}
        >
          {motion ? "Pause motion" : "Resume motion"}
        </GhostBtn>
      </section>

      <CampusNetwork s={s} dispatch={dispatch} />

      <div className="ops-datebar">
        <span className={future ? "text-power" : "text-chip"}>
          {future ? "CAPACITY PREVIEW" : "LIVE FLEET"} · {dateOf(point.t).label}
        </span>
        {future && (
          <GhostBtn tone="ink" className="min-h-11" onClick={() => setOffset(0)}>
            Return to live
          </GhostBtn>
        )}
        <span className="ops-note">Inspecting capacity costs no action.</span>
      </div>

      <div className="ops-resources">
        {(["chips", "power", "fabric"] as Resource[]).map((key) => {
          const Icon = ICONS[key];
          const binding = key === d.bottleneck;
          return (
            <button
              key={key}
              type="button"
              className={`ops-resource ${selected === key ? "is-selected" : ""}`}
              style={{ "--resource-color": COLORS[key] } as CSSProperties}
              aria-pressed={selected === key}
              onClick={() => setSelected(key)}
            >
              <span className="ops-resource-name">
                <Icon size={20} aria-hidden />
                {NAMES[key]}
                <span>{binding ? "CONSTRAINT" : "HEADROOM"}</span>
              </span>
              <strong>
                {num(capacity[key])}
                <small> chip capacity</small>
              </strong>
              <div className="ops-capacity-track">
                <div style={{ width: `${(capacity[key] / max) * 100}%` }} />
              </div>
              <span className="ops-resource-foot">
                {key === "chips"
                  ? `${num(point.chips)} owned`
                  : key === "power"
                    ? `${mw(point.mw)} energized`
                    : "Including network multipliers"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="ops-insight" role="status">
        <strong style={{ color: COLORS[selected] }}>{NAMES[selected]}</strong>
        <span>
          {selected === d.bottleneck
            ? `Sets the physical ceiling at ${num(d.physicalLive)} chips. Expanding it can move the constraint to the next resource.`
            : `${num(selectedIdle)} chip-equivalents of headroom. ${d.bottleneck === "none" ? "No fleet is installed." : `${NAMES[d.bottleneck]} sets the current physical ceiling.`}`}
          {d.downtimeMul < 1 ? ` Containment temporarily reduces throughput to ${Math.round(d.downtimeMul * 100)}%.` : ""}
        </span>
        <GhostBtn tone="ink" className="min-h-11" onClick={() => onTab("SUPPLY")}>
          Plan capacity <ArrowUpRight size={16} aria-hidden />
        </GhostBtn>
      </div>

      <section className="ops-fleet" aria-label="Fleet allocation visualization">
        <img className="ops-fleet-backdrop" src={STILLS.compute} alt="" />
        <div className="ops-fleet-title">
          <div>
            <p className="ops-eyebrow">FLEET ACTIVITY</p>
            <strong>
              {num(d.live)} <span>live / {num(point.chips)} owned</span>
            </strong>
          </div>
          <span className="ops-efficiency">{(point.chips > 0 ? (d.live / point.chips) * 100 : 0).toFixed(1)}% utilization</span>
        </div>
        <div className="ops-tiles" aria-hidden="true">
          {Array.from({ length: 48 }, (_, index) => {
            const start = index / 48;
            const end = (index + 1) / 48;
            let cursor = 0;
            return (
              <div className="ops-tile" key={index}>
                {segments.map((seg) => {
                  const a = cursor;
                  cursor += seg.value / total;
                  const width = Math.max(0, Math.min(end, cursor) - Math.max(start, a)) * 48 * 100;
                  return width > 0 ? (
                    <span
                      key={seg.id}
                      className={`ops-tile-${seg.id}`}
                      style={{
                        width: `${width}%`,
                        backgroundColor: SEGMENT_COLORS[seg.id],
                        animationDelay: `${index * -0.11}s`,
                      }}
                    />
                  ) : null;
                })}
              </div>
            );
          })}
        </div>
        <div className="ops-legend">
          {segments.map((seg) => (
            <span key={seg.id}>
              <i style={{ backgroundColor: SEGMENT_COLORS[seg.id] }} />
              {seg.label} <b>{num(seg.value)}</b>
            </span>
          ))}
        </div>
        <p className="ops-fleet-caption">Each tile represents 1/48 of your fleet; mixed tiles show partial allocation.</p>
      </section>

      <div className="ops-flows">
        <div
          className={`ops-flow ${s.trainShare > 0 && d.live > 0 ? "is-active" : ""}`}
          style={{ "--flow-color": "var(--color-chip)" } as CSSProperties}
        >
          <div className="ops-flow-line" />
          <FlaskConical size={24} aria-hidden />
          <div>
            <span>TRAINING</span>
            <strong>{num(d.live * s.trainShare)} chips</strong>
            <p>
              {Math.round(s.trainShare * 100)}% of live fleet · research capability {d.researchCap.toFixed(1)}
            </p>
          </div>
        </div>
        <div
          className={`ops-flow ${s.trainShare < 1 && d.live > 0 && s.deployMode !== "none" ? "is-active" : ""}`}
          style={{ "--flow-color": "var(--ops-serve)" } as CSSProperties}
        >
          <div className="ops-flow-line" />
          <Radio size={24} aria-hidden />
          <div>
            <span>SERVING ALLOCATION</span>
            <strong>{num(d.live * (1 - s.trainShare))} chips</strong>
            <p>
              {s.deployMode === "none"
                ? "No deployed model. This allocation earns no model revenue."
                : `${s.deployMode === "broad" ? "Broad" : "Limited"} deployment · shipped capability ${s.deployedCap.toFixed(1)}`}
            </p>
          </div>
        </div>
      </div>
      {future && (
        <p className="ops-note mb-4">
          Capacity preview keeps today's training split, models, technology, and ventures except scheduled
          commissioning. It includes retirement, deliveries, campus cooling and links, export restrictions and
          containment expiry; it does not forecast research, funding or competitor decisions.
        </p>
      )}

      <div className="ops-bottom">
        <Panel title="Commissioning horizon">
          <div className="ops-slider-label">
            <label htmlFor="ops-horizon">Inspect the next {timeline.length - 1} quarters</label>
            <output htmlFor="ops-horizon">{dateOf(point.t).label}</output>
          </div>
          <input
            id="ops-horizon"
            className="ops-slider"
            type="range"
            min={0}
            max={timeline.length - 1}
            value={Math.min(offset, timeline.length - 1)}
            disabled={timeline.length < 2}
            onChange={(e) => setOffset(Number(e.target.value))}
            aria-valuetext={dateOf(point.t).label}
          />
          <div className="ops-chart" role="img" aria-label="Capacity timeline. Exact values are available by changing the quarter slider above.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 16, right: 0, left: 0, bottom: 8 }}>
                <XAxis dataKey="date" tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis width={54} tickFormatter={(v) => num(Number(v))} tick={{ fill: "var(--color-ink-muted)", fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "var(--color-panel)", borderColor: "var(--color-line)", color: "var(--color-ink)" }}
                  formatter={(v) => num(Number(v))}
                  cursor={{ fill: "var(--color-panel-2)" }}
                />
                <Bar dataKey="live" name="Live chips" stackId="fleet" fill="var(--color-chip)" isAnimationActive={false} />
                <Bar dataKey="idle" name="Idle / contained chips" stackId="fleet" fill="var(--color-line-strong)" isAnimationActive={false} />
                <ReferenceLine x={dateOf(point.t).label} stroke="var(--color-power)" strokeDasharray="4 4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="ops-note">Committed orders only. Retirement continues even with an empty pipeline. Previewing does not advance the game.</p>
        </Panel>
        <Panel title="On the way">
          {deliveries.length ? (
            <ol className="ops-deliveries">
              {deliveries.map((item) => (
                <li key={item.id}>
                  <PackageCheck size={18} aria-hidden />
                  <div>
                    <strong>{item.name}</strong>
                    <span>
                      {arriveLabel(item.at)}
                      {item.at <= point.t ? " · included in this view" : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="ops-empty">
              Nothing is scheduled. Your fleet will shrink as chips retire. Place orders before the next constraint becomes urgent.
            </p>
          )}
          <div className="ops-actions">
            <GhostBtn onClick={() => onTab("SUPPLY")}>Order infrastructure</GhostBtn>
            <GhostBtn tone="ink" onClick={() => onTab("COMMAND")}>
              Set allocation
            </GhostBtn>
          </div>
        </Panel>
      </div>
      <div className="ops-quarter">
        <span>{future ? "Preview only. End Quarter resolves the current quarter." : "Ready to run the next quarter?"}</span>
        <GhostBtn
          tone="power"
          onClick={() => {
            setOffset(0);
            onEnd();
          }}
        >
          End Quarter
        </GhostBtn>
      </div>
    </div>
  );
}
