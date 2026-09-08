import { HISTORICAL_FRONTIER, LAST, RIVAL_DEFS, idx } from "@/game/data.ts";
import type { GameState } from "@/game/types.ts";
import { Empty } from "./primitives";

export function FrontierChart({ s }: { s: GameState }) {
  const W = 640;
  const H = 260;
  const PAD = 32;
  const pts = s.history;
  if (pts.length < 2) return <Empty>The curve needs a few quarters before it says anything.</Empty>;
  const x = (t: number) => PAD + (t / LAST) * (W - PAD * 2);
  const y = (c: number) => H - PAD - (Math.max(0, Math.min(100, c)) / 100) * (H - PAD * 2);
  const poly = (get: (p: (typeof pts)[0]) => number) => pts.map((p) => `${x(p.t)},${y(get(p))}`).join(" ");
  const last = pts[pts.length - 1]!;
  const youArea = `${poly((p) => p.cap)} ${x(last.t)},${y(0)} ${x(pts[0]!.t)},${y(0)}`;
  const record = HISTORICAL_FRONTIER.map((h) => ({ t: idx(h.at), cap: h.cap, note: h.note }));
  const recordLine = record.map((h) => `${x(h.t)},${y(h.cap)}`).join(" ");
  const recordAt = (t: number) => {
    const after = record.find((h) => h.t >= t);
    const before = [...record].reverse().find((h) => h.t <= t);
    if (!after || !before) return null;
    if (after.t === before.t) return after.cap;
    return before.cap + ((after.cap - before.cap) * (t - before.t)) / (after.t - before.t);
  };
  const vsRecord = recordAt(last.t);

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full min-w-80" role="img" aria-label="Capability over time">
        <defs>
          <linearGradient id="capFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fa8a0" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#4fa8a0" stopOpacity="0" />
          </linearGradient>
          <filter id="lineGlow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x={PAD} y={y(100)} width={W - PAD * 2} height={y(90) - y(100)} fill="#c45c40" opacity="0.08" />
        <line x1={PAD} y1={y(90)} x2={W - PAD} y2={y(90)} stroke="#c45c40" strokeDasharray="4 5" />
        <text x={W - PAD} y={y(90) - 6} fill="#c45c40" fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="end">
          THRESHOLD 90
        </text>
        {[25, 50, 75].map((g) => (
          <line key={g} x1={PAD} y1={y(g)} x2={W - PAD} y2={y(g)} stroke="#2a3140" />
        ))}
        <polygon points={youArea} fill="url(#capFill)" />
        <polyline fill="none" stroke="#dfdbd1" strokeWidth={1.2} strokeDasharray="2 4" opacity="0.7" points={recordLine} />
        {record.filter((h) => h.note).map((h) => (
          <g key={h.t}>
            <circle cx={x(h.t)} cy={y(h.cap)} r="1.8" fill="#dfdbd1" opacity="0.8" />
            <text x={x(h.t) + 3} y={y(h.cap) - 3} fill="#8b909c" fontSize="7" fontFamily="IBM Plex Mono, monospace">{h.note}</text>
          </g>
        ))}
        {s.rivals.map((r, i) => (
          <polyline key={r.id} fill="none" stroke={r.color} strokeWidth={1.1} points={poly((p) => p.rivals[i] ?? 0)} />
        ))}
        <polyline fill="none" stroke="#8a7bb8" strokeWidth={1.6} points={poly((p) => p.china)} />
        <polyline fill="none" stroke="#7e9e58" strokeWidth={1.5} strokeDasharray="5 3" points={poly((p) => p.deployed)} />
        <polyline fill="none" stroke="#4fa8a0" strokeWidth={2.6} filter="url(#lineGlow)" points={poly((p) => p.cap)} />
        <circle cx={x(last.t)} cy={y(last.cap)} r="3.2" fill="#4fa8a0" />
        <circle cx={x(last.t)} cy={y(last.china)} r="2.4" fill="#8a7bb8" />
        <text x={PAD} y={H - 8} fill="#8b909c" fontSize="9" fontFamily="IBM Plex Mono, monospace">2012</text>
        <text x={W - PAD} y={H - 8} fill="#8b909c" fontSize="9" fontFamily="IBM Plex Mono, monospace" textAnchor="end">2030</text>
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 font-mono text-2xs">
        <span className="text-cream">┄ the record (estimate)</span>
        {vsRecord !== null && (
          <span className={last.cap >= vsRecord ? "text-chip" : "text-risk"}>
            you vs history: {last.cap >= vsRecord ? "+" : ""}{(last.cap - vsRecord).toFixed(1)}
          </span>
        )}
        <span className="text-chip">— research</span>
        <span className="text-money">— deployed</span>
        <span className="text-abroad">— abroad</span>
        {RIVAL_DEFS.map((r) => (
          <span key={r.id} style={{ color: r.color }}>— {r.name}</span>
        ))}
      </div>
    </div>
  );
}
