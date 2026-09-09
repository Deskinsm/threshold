import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Panel({
  title,
  hint,
  children,
  className,
  id,
}: {
  title?: string;
  hint?: () => void;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "mb-3.5 rounded-lg border border-line bg-panel p-4 shadow-border",
        className,
      )}
    >
      {title && (
        <div className="mb-2.5 flex items-center gap-1 font-mono text-micro uppercase tracking-widest text-ink-muted">
          {title}
          {hint && (
            <button
              type="button"
              aria-label={`About ${title}`}
              onClick={() => hint()}
              className="px-1 text-chip hover:text-ink"
            >
              [?]
            </button>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function GhostBtn({
  children,
  onClick,
  disabled,
  tone = "chip",
  className,
  title,
  type = "button",
  filled = false,
  pressed,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "chip" | "power" | "money" | "risk" | "ink";
  className?: string;
  title?: string;
  type?: "button" | "submit";
  filled?: boolean;
  pressed?: boolean;
}) {
  const outline = {
    chip: "border-chip text-chip hover:bg-chip/10",
    power: "border-power text-power hover:bg-power/10",
    money: "border-money text-money hover:bg-money/10",
    risk: "border-risk text-risk hover:bg-risk/10",
    ink: "border-line text-ink hover:bg-panel-2",
  }[tone];
  const solid = {
    chip: "border-chip bg-chip text-bg hover:bg-chip/90",
    power: "border-power bg-power text-bg hover:bg-power/90",
    money: "border-money bg-money text-bg hover:bg-money/90",
    risk: "border-risk bg-risk text-ink hover:bg-risk/90",
    ink: "border-line bg-panel-2 text-ink hover:bg-line",
  }[tone];
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      aria-pressed={pressed}
      onClick={onClick ? () => onClick() : undefined}
      className={cn(
        "rounded-sm border px-3 py-2 font-mono text-xs tracking-wide transition-[transform,background-color,border-color] duration-150 ease-out active:not-disabled:scale-[0.96]",
        disabled ? "cursor-not-allowed border-line text-ink-faint opacity-50" : filled ? solid : outline,
        className,
      )}
    >
      {children}
    </button>
  );
}

export function SmallBuy({
  label,
  sub,
  ok,
  reason,
  onClick,
  tone = "chip",
}: {
  label: string;
  sub: string;
  ok: boolean;
  reason?: string;
  onClick: () => void;
  tone?: "chip" | "power" | "money";
}) {
  const color = {
    chip: "border-chip text-chip",
    power: "border-power text-power",
    money: "border-money text-money",
  }[tone];
  return (
    <button
      type="button"
      disabled={!ok}
      title={!ok ? reason : undefined}
      aria-disabled={!ok}
      onClick={() => onClick()}
      className={cn(
        "min-h-11 rounded-sm border px-3 py-2 text-left font-mono text-xs transition-colors duration-150",
        ok ? color + " hover:bg-panel-2" : "cursor-not-allowed border-line text-ink-faint opacity-50",
      )}
    >
      <div>{label}</div>
      <div className="text-2xs text-ink-muted">{sub}</div>
      {!ok && reason && <div className="mt-1 text-2xs text-risk">{reason}</div>}
    </button>
  );
}

export function ActRow({
  label,
  sub,
  cost,
  ok,
  reason,
  onClick,
  info,
}: {
  label: string;
  sub: string;
  cost: string;
  ok: boolean;
  reason?: string;
  onClick: () => void;
  info?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5">
      <div className="min-w-48 flex-1">
        <div className="font-mono text-xs text-ink">
          {label}
          {info && (
            <button type="button" aria-label={`About ${label}`} onClick={() => info()} className="px-1 text-chip">
              [?]
            </button>
          )}
        </div>
        <div className="mt-0.5 text-xs leading-snug text-ink-muted">{sub}</div>
        {!ok && reason && <div className="mt-1 font-mono text-2xs text-risk">{reason}</div>}
      </div>
      <button
        type="button"
        disabled={!ok}
        title={!ok ? reason : undefined}
        onClick={() => onClick()}
        className={cn(
          "min-h-11 whitespace-nowrap rounded-sm border px-3 py-2 font-mono text-micro transition-[transform,background-color] duration-150 active:not-disabled:scale-[0.96]",
          ok ? "border-power text-power hover:bg-power/10" : "cursor-not-allowed border-line text-ink-faint opacity-50",
        )}
      >
        {cost}
      </button>
    </div>
  );
}

export function Meta({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k}>
          <div className="font-mono text-2xs uppercase tracking-wider text-ink-muted">{k}</div>
          <div className="font-mono text-sm tabular text-ink">{v}</div>
        </div>
      ))}
    </div>
  );
}

export function ProvenanceTag({ kind }: { kind: string }) {
  const label = kind.toUpperCase();
  return (
    <span className="ml-2 font-mono text-2xs tracking-wider text-ink-faint">{label}</span>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-ink-muted">{children}</p>;
}

export function Still({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      className={cn("block h-full w-full object-cover", className)}
    />
  );
}

export function Sparkline({
  values,
  color = "var(--color-chip)",
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values, min + 1);
  const w = 72;
  const h = 18;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn("h-4 w-16", className)} aria-hidden>
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} />
    </svg>
  );
}
