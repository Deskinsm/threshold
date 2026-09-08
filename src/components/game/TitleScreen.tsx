import { useEffect, useState } from "react";
import { BACKGROUNDS, type BackgroundId, formatSeed, parseSeed, randomSeed } from "@/game";
import { GhostBtn } from "./primitives";

export function TitleScreen({
  hasSave,
  background,
  onBackground,
  onBegin,
  onContinue,
  onSandbox,
  presetSeed,
}: {
  hasSave: boolean;
  background: BackgroundId;
  onBackground: (b: BackgroundId) => void;
  onBegin: (seed: number) => void;
  onContinue: () => void;
  onSandbox?: () => void;
  presetSeed?: number;
}) {
  const [seedText, setSeedText] = useState(() => (presetSeed !== undefined ? formatSeed(presetSeed) : ""));
  const [pending, setPending] = useState<null | "begin" | "sandbox">(null);
  const parsed = parseSeed(seedText);

  useEffect(() => {
    if (presetSeed !== undefined) {
      setSeedText(formatSeed(presetSeed));
      return;
    }
    setSeedText((cur) => (cur ? cur : formatSeed(randomSeed())));
  }, [presetSeed]);

  function requestBegin() {
    const seed = parsed ?? randomSeed();
    if (hasSave && pending !== "begin") {
      setPending("begin");
      return;
    }
    onBegin(seed);
  }

  function requestSandbox() {
    if (!onSandbox) return;
    if (hasSave && pending !== "sandbox") {
      setPending("sandbox");
      return;
    }
    onSandbox();
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-bg text-ink">
      <TitleBackdrop />
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:bg-gradient-to-r lg:from-bg lg:via-bg/92 lg:to-transparent lg:py-16">
          <div className="stagger-in max-w-xl">
            <div className="font-mono text-micro tracking-[0.32em] text-chip">2012 — 2030 · 73 QUARTERS</div>
            <h1 className="mt-3 font-sans text-5xl font-light leading-none tracking-tight text-ink sm:text-7xl lg:text-8xl">
              THRESHOLD
            </h1>
            <div className="mt-3 h-px w-24 bg-chip/70" />
            <div className="mt-3 font-mono text-sm tracking-[0.22em] text-ink-muted">THE INTELLIGENCE RACE</div>

            <p className="mt-6 text-base leading-relaxed text-cream lg:mt-8">
              It is October 2012. A neural network trained on two gaming GPUs has just won an image
              competition by a margin that cannot be explained away, and a very small number of people
              have understood what that implies. You are one of them.
            </p>
            <p className="mt-4 hidden text-base leading-relaxed text-cream sm:block">
              Two ways to win, and they pull against each other. Usable compute is the minimum of chips,
              power, and fabric. The binding constraint migrates. So does the money.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <GhostBtn filled tone="chip" className="min-h-12 px-7 py-3 text-sm" onClick={requestBegin}>
                BEGIN — Q4 2012
              </GhostBtn>
              {hasSave && (
                <GhostBtn tone="ink" className="min-h-12 px-6 py-3 text-sm" onClick={onContinue}>
                  CONTINUE
                </GhostBtn>
              )}
              {onSandbox && (
                <GhostBtn tone="power" className="min-h-12 px-6 py-3 text-sm" onClick={requestSandbox}>
                  SANDBOX — Q3 2024
                </GhostBtn>
              )}
            </div>
            {onSandbox && (
              <p className="mt-2 max-w-xl font-mono text-2xs leading-relaxed text-ink-faint">
                The sandbox opens a late-game fixture — four campuses, four ventures, $10B. Not an earned run.
              </p>
            )}

            {pending && hasSave && (
              <div className="mt-3 rounded-md border border-power/50 bg-panel/90 p-3">
                <p className="text-sm leading-relaxed text-cream">
                  {pending === "sandbox"
                    ? "A save is already on this machine. The expansion sandbox replaces it. It is not an earned campaign."
                    : "A save is already on this machine. Begin replaces it. Export first if you want it."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <GhostBtn
                    tone="risk"
                    onClick={() => (pending === "sandbox" ? onSandbox?.() : onBegin(parsed ?? randomSeed()))}
                  >
                    Replace save
                  </GhostBtn>
                  <GhostBtn tone="ink" onClick={() => setPending(null)}>
                    Cancel
                  </GhostBtn>
                </div>
              </div>
            )}

            {seedText ? (
              <SeedConsole
                seedText={seedText}
                parsed={parsed}
                onChange={(v) => {
                  setSeedText(v);
                  setPending(null);
                }}
                onRoll={() => {
                  setSeedText(formatSeed(randomSeed()));
                  setPending(null);
                }}
              />
            ) : (
              <div className="mt-6 h-28 rounded-md border border-line bg-bg-sunken/80" aria-hidden />
            )}

            <div className="mt-8">
              <div className="font-mono text-micro uppercase tracking-widest text-ink-muted">Starting background</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {(Object.keys(BACKGROUNDS) as BackgroundId[]).map((id) => {
                  const b = BACKGROUNDS[id]!;
                  const on = background === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onBackground(id)}
                      className={
                        "min-h-11 rounded-md border p-3 text-left transition-[border-color,background-color] duration-150 " +
                        (on ? "border-chip bg-panel-2" : "border-line bg-panel/80 hover:border-line-strong")
                      }
                    >
                      <div className="font-mono text-xs text-chip">{b.name}</div>
                      <div className="mt-1 text-xs leading-snug text-ink-muted">{b.plus}</div>
                      <div className="mt-1 hidden text-xs leading-snug text-ink-faint sm:block">{b.minus}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 grid gap-3 lg:hidden">
              <WinCard tone="money" title="CAPITAL" body="One trillion in founder paper — claim on operations and assets, not a cash hoard. Own the substrate. Dilution is the price of the balance sheet." />
              <WinCard tone="chip" title="THE THRESHOLD" body="Deploy capability 90 first. Whether that counts as winning depends on what you were willing to skip — and on whether you actually ship it." />
              <WinCard tone="abroad" title="AND ONE THING TO LOSE TO" body="Four domestic labs and a state programme. Every one of them can cross. The race is not a metaphor." />
            </div>

            <p className="mt-6 max-w-xl font-mono text-micro leading-relaxed text-ink-muted">
              Events through Q2 2026 are labelled historical, estimate, or game abstraction — not “the
              real record” by date alone. Everything after is projection. The seed is the whole campaign.
            </p>
          </div>
        </div>

        <div className="hidden flex-col justify-end gap-3 px-5 py-16 sm:px-8 lg:flex">
          <WinCard tone="money" title="CAPITAL" body="One trillion in founder paper — claim on operations and assets, not a cash hoard. Own the substrate. Dilution is the price of the balance sheet." />
          <WinCard tone="chip" title="THE THRESHOLD" body="Deploy capability 90 first. Whether that counts as winning depends on what you were willing to skip — and on whether you actually ship it." />
          <WinCard tone="abroad" title="AND ONE THING TO LOSE TO" body="Four domestic labs and a state programme. Every one of them can cross. The race is not a metaphor." />
        </div>
      </div>
    </div>
  );
}

function SeedConsole({
  seedText,
  parsed,
  onChange,
  onRoll,
}: {
  seedText: string;
  parsed: number | null;
  onChange: (v: string) => void;
  onRoll: () => void;
}) {
  return (
    <div className="mt-6 rounded-md border border-line bg-bg-sunken/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor="campaign-seed" className="font-mono text-micro uppercase tracking-widest text-ink-muted">
          Campaign seed
        </label>
        <button type="button" onClick={onRoll} className="font-mono text-2xs tracking-wider text-chip hover:text-ink">
          NEW SEED
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-xs text-ink-faint">0x</span>
        <input
          id="campaign-seed"
          name="campaign-seed"
          type="text"
          inputMode="text"
          autoComplete="off"
          suppressHydrationWarning
          value={seedText}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="min-h-11 w-full rounded-sm border border-line bg-bg px-3 font-mono text-sm tracking-[0.18em] text-chip caret-chip outline-none focus:border-chip"
          placeholder="a13e2012"
          aria-invalid={seedText.length > 0 && parsed === null}
        />
      </div>
      <p className="mt-2 font-mono text-2xs leading-relaxed text-ink-faint">
        {parsed === null
          ? "Eight hex digits. Same seed, background, and decisions replay the campaign."
          : `Replayable as ${formatSeed(parsed)}. Rival aggression and leakage are rolled from this.`}
      </p>
    </div>
  );
}

function WinCard({ tone, title, body }: { tone: "money" | "chip" | "abroad"; title: string; body: string }) {
  const border = { money: "border-l-money", chip: "border-l-chip", abroad: "border-l-abroad" }[tone];
  const color = { money: "text-money", chip: "text-chip", abroad: "text-abroad" }[tone];
  return (
    <div className={"rounded-lg border border-line bg-panel/85 p-4 shadow-panel backdrop-blur-sm border-l-2 " + border}>
      <div className={"font-mono text-micro tracking-widest " + color}>{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-cream">{body}</p>
    </div>
  );
}

function TitleBackdrop() {
  const curves = [
    { d: "M48 340 C 160 336, 240 300, 340 250 S 560 140, 752 78", c: "#4fa8a0", w: 2.6 },
    { d: "M48 348 C 170 340, 260 310, 370 240 S 590 120, 752 54", c: "#d99b34", w: 1.5 },
    { d: "M48 352 C 180 348, 280 330, 400 280 S 610 190, 752 128", c: "#7e9e58", w: 1.2 },
    { d: "M48 356 C 190 352, 300 340, 420 300 S 620 220, 752 160", c: "#9aa4b4", w: 1.1 },
    { d: "M48 358 C 200 356, 320 348, 450 310 S 640 240, 752 188", c: "#8a7bb8", w: 1.8 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0">
      <img
        src="/art/title-lab.jpg"
        alt=""
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover opacity-50 lg:left-[30%] lg:w-[70%] lg:opacity-80"
        style={{ maskImage: "linear-gradient(to right, transparent, black 16%)", WebkitMaskImage: "linear-gradient(to right, transparent, black 16%)" }}
      />
      <div className="grid-bg absolute inset-0 opacity-25" />
      <svg viewBox="0 0 800 400" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <defs>
          <linearGradient id="youFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4fa8a0" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#4fa8a0" stopOpacity="0" />
          </linearGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <line x1="48" y1="72" x2="752" y2="72" stroke="#c45c40" strokeDasharray="4 6" strokeWidth="1" style={{ animation: "pulse-threshold 3.6s ease-in-out infinite" }} />
        <text x="752" y="64" fill="#c45c40" fontSize="11" fontFamily="IBM Plex Mono, monospace" textAnchor="end">THRESHOLD 90</text>
        {[0, 25, 50, 75].map((g) => (
          <line key={g} x1="48" y1={360 - g * 3.2} x2="752" y2={360 - g * 3.2} stroke="#2a3140" strokeWidth="0.8" />
        ))}
        <path
          d="M48 340 C 160 336, 240 300, 340 250 S 560 140, 752 78 L 752 360 L 48 360 Z"
          fill="url(#youFill)"
          style={{ animation: "fill-area 1.6s 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
        />
        {curves.map((c, i) => (
          <path
            key={i}
            d={c.d}
            fill="none"
            stroke={c.c}
            strokeWidth={c.w}
            strokeLinecap="round"
            filter={i === 0 ? "url(#glow)" : undefined}
            strokeDasharray="1400"
            strokeDashoffset="1400"
            style={{ animation: `draw-line 2.6s ${0.12 + i * 0.16}s cubic-bezier(0.22,1,0.36,1) forwards` }}
          />
        ))}
        <text x="48" y="384" fill="#8b909c" fontSize="11" fontFamily="IBM Plex Mono, monospace">2012</text>
        <text x="400" y="384" fill="#5c6270" fontSize="11" fontFamily="IBM Plex Mono, monospace" textAnchor="middle">2022</text>
        <text x="752" y="384" fill="#8b909c" fontSize="11" fontFamily="IBM Plex Mono, monospace" textAnchor="end">2030</text>
      </svg>
      <div className="vignette absolute inset-0" />
      <div className="scanline" />
      <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-bg/20 lg:via-bg/50 lg:to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-transparent to-bg/25" />
    </div>
  );
}
