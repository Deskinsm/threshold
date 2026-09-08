import { VentureSpecializations, PublicRelations } from "./ExpansionPanels";
import "./expansion.css";
import {
  type Action,
  type Derived,
  type GameState,
  type SiteId,
  BRANCHES,
  CONCEPTS,
  REAL_HISTORY_ENDS,
  RIVAL_DEFS,
  TECH,
  VENTURES,
  arriveLabel,
  chipDisc,
  chipGen,
  chipPrice,
  dateOf,
  fabricMult,
  fabricPrice,
  idx,
  money,
  mw,
  num,
  shocksAt,
  algoMult,
  serveMult,
  talentMult,
  alignScore,
  ventureIncome,
  prestigeMult,
  playerAlloc,
  techCost,
  multiQuarterCap,
  PEOPLE,
  PERSON_EFFECT,
  SITES,
  SITE_NAMES,
  derive,
  poachChance,
  powerLeadAt,
  powerPriceAt,
  roster,
  signingCost,
  siteById,
  techAvailableAt,
} from "@/game";
import { ActRow, Empty, Meta, Panel, ProvenanceTag, SmallBuy, Still } from "./primitives";
import { FrontierChart } from "./FrontierChart";
import { STILLS, campusStill, rivalStill } from "./stills";

export function SupplyView({
  s,
  dispatch,
  onConcept,
}: {
  s: GameState;
  dispatch: (a: Action) => void;
  onConcept: (id: string) => void;
}) {
  const disc = chipDisc(s);
  const unit = chipPrice(s.t) * disc;
  const fUnit = fabricPrice(s.t);
  return (
    <>
      <Panel title="THE MARKET" hint={() => onConcept("hbm")}>
        <p className="mb-3 font-mono text-xs leading-relaxed text-ink-muted">
          Your remaining allocation this quarter is finite. Rejected orders change neither cash nor actions.
          What you leave in the contested pool, the other labs bid into — most aggressive first.
        </p>
        <Meta
          items={[
            ["contested chips left", num(s.market.chips)],
            ["contested power left", mw(s.market.power)],
            ["contested fabric left", num(s.market.fabric)],
            ["your chip allocation", num(s.alloc.chips)],
          ]}
        />
        {shocksAt(s.t).map((sh) => (
          <div key={sh.id} className="mb-2 border-l-2 border-risk bg-panel-2 px-3 py-2 text-sm leading-relaxed">
            <span className="font-mono text-2xs tracking-wider text-risk">
              {sh.target.toUpperCase()} −{(sh.frac * 100).toFixed(0)}%
            </span>
            <ProvenanceTag kind={sh.provenance} />
            <span className="text-ink-muted"> {sh.note}</span>
          </div>
        ))}
      </Panel>
      <Panel title="ACCELERATORS" hint={() => onConcept("depreciation")}>
        <Meta
          items={[
            ["remaining this quarter", num(s.alloc.chips)],
            ["global (your share shown)", num(playerAlloc(s.t, "chips", s.exportControls))],
            ["unit price", money(unit)],
            ["generation", chipGen(s.t).toFixed(1) + "x"],
            ["lead time", "2 quarters"],
          ]}
        />
        <BuyRow
          fracs={[0.15, 0.35, 0.7, 1]}
          remaining={s.alloc.chips}
          format={(q) => num(Math.floor(q))}
          costOf={(q) => Math.floor(q) * unit}
          cash={s.cash}
          actions={s.actions}
          onBuy={(q) => dispatch({ type: "orderChips", qty: Math.floor(q) })}
          tone="chip"
          warnAfter={s.t + 2}
        />
        <p className="mt-2 font-mono text-micro text-ink-muted">3.5% of the fleet retires each quarter. Relative efficiency decays 1.8%.</p>
      </Panel>
      <Panel title="POWER" hint={() => onConcept("power")}>
        <div className="mb-3">
          <div className="mb-1 font-mono text-micro tracking-widest text-ink-muted">
            SITE — where the next load is filed <button type="button" className="text-chip" onClick={() => onConcept("siting")} aria-label="About siting">[?]</button>
          </div>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label="Campus site">
            {SITES.map((site) => {
              const avail = s.t >= idx(site.at);
              const on = s.site === site.id;
              const live = s.mwBySite[site.id];
              return (
                <button
                  key={site.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={!avail}
                  title={!avail ? `Available ${site.at.replace("Q", " Q")}` : site.tradeoff}
                  onClick={() => dispatch({ type: "setSite", site: site.id })}
                  className={`site-radio site-${site.id} ${on ? "is-on" : ""}`}
                >
                  <span className="site-radio-still" aria-hidden>
                    <Still src={campusStill(site.id)} />
                    <span className="site-radio-veil" />
                  </span>
                  <span className="site-radio-body">
                    <span className="site-radio-kicker">{on ? "FILING SITE" : avail ? "AVAILABLE" : `FROM ${site.at.replace("Q", " Q")}`}</span>
                    <span className="site-radio-name">{SITE_NAMES[site.id]}</span>
                    <span className="site-radio-meta">
                      {money(powerPriceAt(site.id))}/MW · {powerLeadAt(s.t, site.id)}q
                      {site.permitRisk >= 0.15 ? ` · ${(site.permitRisk * 100).toFixed(0)}% delay` : ""}
                      {live > 0.05 ? ` · ${mw(live)} live` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-2xs text-ink-muted">{siteById(s.site).tradeoff}</p>
        </div>
        <Meta
          items={[
            ["remaining this quarter", mw(s.alloc.power)],
            ["cost here", money(powerPriceAt(s.site)) + " / MW"],
            ["supports", "700 chips / MW · game assumption"],
            ["lead time here", powerLeadAt(s.t, s.site) + " quarters"],
            ["energized by site", Object.entries(s.mwBySite).filter(([, v]) => v > 0.05).map(([k, v]) => `${SITE_NAMES[k as SiteId]} ${mw(v)}`).join(" · ") || "—"],
          ]}
        />
        <BuyRow
          fracs={[0.2, 0.5, 1]}
          remaining={s.alloc.power}
          format={(q) => mw(q)}
          costOf={(q) => q * powerPriceAt(s.site)}
          cash={s.cash}
          actions={s.actions}
          onBuy={(q) => dispatch({ type: "orderPower", qty: q })}
          tone="power"
          warnAfter={s.t + powerLeadAt(s.t, s.site)}
        />
      </Panel>
      <Panel title="FABRIC" hint={() => onConcept("interconnect")}>
        <Meta
          items={[
            ["remaining this quarter", num(s.alloc.fabric)],
            ["cost", money(fUnit) + " / chip"],
            ["multiplier", fabricMult(s).toFixed(2) + "x"],
            ["lead time", "3 quarters"],
          ]}
        />
        <BuyRow
          fracs={[0.25, 0.6, 1]}
          remaining={s.alloc.fabric}
          format={(q) => num(Math.floor(q))}
          costOf={(q) => Math.floor(q) * fUnit}
          cash={s.cash}
          actions={s.actions}
          onBuy={(q) => dispatch({ type: "orderFabric", qty: Math.floor(q) })}
          tone="money"
          warnAfter={s.t + 3}
        />
      </Panel>
      <Panel title="ON ORDER">
        {s.orders.length === 0 && <Empty>Nothing in the pipeline.</Empty>}
        {s.orders.map((o, i) => (
          <div key={i} className="flex justify-between py-1.5 font-mono text-xs">
            <span>{o.label}</span>
            <span className="text-power">{arriveLabel(o.arrive)}</span>
          </div>
        ))}
      </Panel>
    </>
  );
}

function BuyRow({
  fracs, remaining, format, costOf, cash, actions, onBuy, tone, warnAfter,
}: {
  fracs: number[];
  remaining: number;
  format: (q: number) => string;
  costOf: (q: number) => number;
  cash: number;
  actions: number;
  onBuy: (q: number) => void;
  tone: "chip" | "power" | "money";
  warnAfter: number;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {fracs.map((f) => {
        const q = remaining * f;
        const c = costOf(q);
        const qtyOk = q > 0.0001;
        const ok = actions > 0 && cash >= c && qtyOk;
        const reason = !qtyOk ? "Allocation exhausted" : actions < 1 ? "No actions left" : cash < c ? "Not enough cash" : undefined;
        return (
          <SmallBuy
            key={f}
            ok={ok}
            reason={reason}
            tone={tone}
            label={(f === 1 ? "MAX " : "") + format(q)}
            sub={money(c) + (warnAfter > 72 ? " · after campaign" : "")}
            onClick={() => onBuy(q)}
          />
        );
      })}
    </div>
  );
}

export function LabView({
  s,
  dispatch,
  onConcept,
}: {
  s: GameState;
  dispatch: (a: Action) => void;
  onConcept: (id: string) => void;
}) {
  const forecast = s.tech.includes("laws") ? multiQuarterCap(s, 8) : null;
  return (
    <>
      <Panel title="RESEARCH" hint={() => onConcept("scaling")}>
        <Meta
          items={[
            ["algorithmic multiplier", algoMult(s.tech).toFixed(2) + "x"],
            ["serving multiplier", serveMult(s).toFixed(2) + "x"],
            ["researchers", num(s.researchers) + " (" + talentMult(s.researchers).toFixed(2) + "x)"],
            ["alignment pillars", alignScore(s) + " / 6"],
          ]}
        />
        <p className="mt-2 font-mono text-micro text-ink-muted">
          An algorithmic gain multiplies every chip you own. Alignment modifiers cut hazard growth, not incident chance directly.
        </p>
      </Panel>
      <PeoplePanel s={s} dispatch={dispatch} onConcept={onConcept} />
      {forecast && (
        <Panel title="FORECAST">
          <p className="mb-2 text-xs text-ink-muted">{forecast.assumption}</p>
          <div className="grid grid-cols-3 gap-2 font-mono text-xs sm:grid-cols-5">
            {forecast.points.map((p) => (
              <div key={p.t} className="border border-line bg-panel-2 px-2 py-1">
                <div className="text-2xs text-ink-muted">{p.label}</div>
                <div>{p.cap.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {(Object.keys(BRANCHES) as (keyof typeof BRANCHES)[]).map((b) => (
        <Panel key={b} title={BRANCHES[b].name.toUpperCase()}>
          {TECH.filter((n) => n.br === b).map((n) => {
            const availAt = techAvailableAt(s, n);
            const avail = s.t >= availAt;
            const early = availAt < idx(n.at);
            const owned = s.tech.includes(n.id);
            const cost = techCost(s, n);
            const ok = avail && s.actions > 0 && s.cash >= cost && !owned;
            const reason = owned
              ? undefined
              : !avail
                ? `Unlocks ${arriveLabel(availAt)}${early ? " (early — specialist on staff)" : ""}`
                : s.actions < 1
                  ? "No actions left"
                  : s.cash < cost
                    ? "Not enough cash"
                    : undefined;
            return (
              <div
                key={n.id}
                className="mb-2 border p-3"
                style={{
                  borderColor: owned ? "var(--color-chip)" : "var(--color-line)",
                  background: owned ? "var(--color-panel-2)" : "transparent",
                  opacity: avail || owned ? 1 : 0.4,
                }}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <div className="font-mono text-sm">
                    {n.name}
                    {n.concept && (
                      <button type="button" className="px-1 text-chip" onClick={() => onConcept(n.concept!)} aria-label={n.concept}>
                        [?]
                      </button>
                    )}
                    <ProvenanceTag kind={n.provenance} />
                  </div>
                  <div className="font-mono text-micro text-ink-muted">{n.at.replace("Q", " Q")}</div>
                </div>
                <p className="my-1.5 text-sm leading-relaxed text-ink-muted">{n.desc}</p>
                <div className="mb-2 font-mono text-micro text-chip">
                  {n.algo ? `algo ×${n.algo}  ` : ""}
                  {n.serve ? `serve ×${n.serve}  ` : ""}
                  {n.fleet ? `fleet ×${n.fleet}  ` : ""}
                  {n.fabric ? `fabric ×${n.fabric}  ` : ""}
                  {n.risk ? `hazard growth ${((n.risk) * 100).toFixed(0)}%  ` : ""}
                  {n.action ? "+1 ACTION  " : ""}
                  {n.forecast ? "unlocks forecast  " : ""}
                  {n.align ? `alignment +${n.align}` : ""}
                </div>
                {owned ? (
                  <span className="font-mono text-micro text-chip">FUNDED</span>
                ) : (
                  <SmallBuy ok={ok} reason={reason} label={money(cost)} sub={avail ? "fund" : "not yet"} onClick={() => dispatch({ type: "buyTech", id: n.id })} />
                )}
              </div>
            );
          })}
        </Panel>
      ))}
    </>
  );
}

function PeoplePanel({ s, dispatch, onConcept }: { s: GameState; dispatch: (a: Action) => void; onConcept: (id: string) => void }) {
  const mine = roster(s);
  const d = derive(s);
  const odds = poachChance(s, d);
  const known = PEOPLE.filter((p) => s.t >= idx(p.at));
  const rivalName = (id: string) => RIVAL_DEFS.find((r) => r.id === id)?.name ?? id;
  const TONE = {
    chip: { text: "text-chip", border: "border-chip" },
    power: { text: "text-power", border: "border-power" },
    money: { text: "text-money", border: "border-money" },
    abroad: { text: "text-abroad", border: "border-abroad" },
  } as const;
  const market = known.filter((p) => (s.people[p.id]?.where ?? p.startsAt) === "free").length;
  const elsewhere = known.length - mine.length - market;
  return (
    <Panel title="PEOPLE" hint={() => onConcept("talent")}>
      <p className="mb-2 text-xs text-ink-muted">
        Eight people who matter more than the headcount. Each pulls their branch forward and cuts that branch's research cost 30%. Poach odds right now {(odds * 100).toFixed(0)}% — leading the frontier is the recruiter.
      </p>
      <Meta
        items={[
          ["on staff", String(mine.length)],
          ["on the market", String(market)],
          ["at other labs", String(elsewhere)],
          ["poach odds", `${(odds * 100).toFixed(0)}%`],
        ]}
      />
      {known.length === 0 && <Empty>Nobody worth naming has surfaced yet.</Empty>}
      <div className="mt-3 space-y-2">
        {known.map((p) => {
          const st = s.people[p.id] ?? { where: p.startsAt, since: 0 };
          const yours = st.where === "you";
          const free = st.where === "free";
          const cost = signingCost(s, p.id);
          const cooling = (s.flags[`poach_${p.id}`] ?? -1) > s.t;
          const ok = s.actions > 0 && s.cash >= cost && !yours && !cooling;
          const branch = BRANCHES[p.br as keyof typeof BRANCHES];
          const tone = TONE[branch.token];
          const effect =
            p.br === "ARCH" || p.br === "DATA"
              ? `${branch.name} unlocks ${PERSON_EFFECT[p.br].early}q early · that branch costs 30% less.`
              : p.br === "SYS"
                ? "Candidates arrive pre-evaluated. Serving ×1.12."
                : "Counts as an alignment pillar. Hazard is a little lower while they stay.";
          return (
            <div key={p.id} className={"people-card " + (yours ? `is-yours border-l-2 ${tone.border}` : "")}>
              <div className={"people-kicker " + (yours ? tone.text : "text-ink-faint")}>{branch.name.toUpperCase()}</div>
              <div className="people-card-head">
                <div className={"font-mono text-sm " + (yours ? tone.text : "text-ink")}>
                  {p.name}
                </div>
                <div className={"font-mono text-2xs tracking-wider " + (yours ? tone.text : "text-ink-muted")}>
                  {yours ? `WITH YOU · ${dateOf(st.since).label}` : free ? "ON THE MARKET" : `AT ${rivalName(st.where)}`}
                </div>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{p.blurb}</p>
              <p className={"people-effect " + (yours ? tone.text : "text-ink-faint")}>{effect}</p>
              {!yours && (
                <div className="mt-2">
                  <SmallBuy
                    label={free ? `Sign · ${money(cost)}` : `Poach · ${money(cost)} · ${(odds * 100).toFixed(0)}%`}
                    sub={free ? "1 action" : "1 action · fail costs 35%"}
                    ok={ok}
                    reason={cooling ? `Said no. Again ${arriveLabel(s.flags[`poach_${p.id}`]!)}` : s.actions < 1 ? "No actions left" : s.cash < cost ? "Not enough cash" : undefined}
                    onClick={() => dispatch(free ? { type: "hirePerson", id: p.id } : { type: "poach", id: p.id })}
                    tone={free ? "chip" : "power"}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function VenturesView({
  s,
  d,
  dispatch,
  onConcept,
}: {
  s: GameState;
  d: Derived;
  dispatch: (a: Action) => void;
  onConcept: (id: string) => void;
}) {
  return (
    <>
      <Panel title="GOING WIDE" hint={() => onConcept("capex")}>
        <p className="text-sm leading-relaxed text-ink-muted">
          The trillion-dollar path is owning the substrate. Ventures cost company cash. Reactors commission on a delay;
          turbines do not.
        </p>
        <div className="mt-2 font-mono text-xs text-money">
          venture income {money(ventureIncome(s, d))}/qtr · multiple {s.multiple.toFixed(1)}x
          {prestigeMult(s) > 1 ? ` (+${((prestigeMult(s) - 1) * 100).toFixed(0)}% prestige)` : ""}
        </div>
      </Panel>
      <Panel title="AVAILABLE">
        {VENTURES.map((v) => {
          const avail = s.t >= idx(v.at);
          const owned = s.ventures.includes(v.id) || s.construction.some((c) => c.ventureId === v.id);
          const building = s.construction.find((c) => c.ventureId === v.id);
          const ok = avail && s.actions > 0 && s.cash >= v.cost && !owned;
          const reason = owned
            ? undefined
            : !avail
              ? `Unlocks ${v.at.replace("Q", " Q")}`
              : s.actions < 1
                ? "No actions left"
                : s.cash < v.cost
                  ? "Not enough cash"
                  : undefined;
          return (
            <div
              key={v.id}
              className="mb-2 border p-3"
              style={{
                borderColor: owned ? "var(--color-money)" : "var(--color-line)",
                background: owned ? "var(--color-panel-2)" : "transparent",
                opacity: avail || owned ? 1 : 0.4,
              }}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div className="font-mono text-sm">
                  {v.name}
                  {v.concept && (
                    <button type="button" className="px-1 text-chip" onClick={() => onConcept(v.concept!)}>[?]</button>
                  )}
                  <ProvenanceTag kind={v.provenance} />
                </div>
                <div className="font-mono text-micro text-ink-muted">{v.at.replace("Q", " Q")}</div>
              </div>
              <p className="my-1.5 text-sm leading-relaxed text-ink-muted">{v.desc}</p>
              <div className="mb-2 font-mono text-micro text-money">
                {v.income ? money(v.income) + "/qtr  " : ""}
                {v.powerAdd ? "+" + mw(v.powerAdd) + "  " : ""}
                {v.commissionQ ? `commissions in ${v.commissionQ}q  ` : ""}
                {v.chipDisc ? `chips −${((1 - v.chipDisc) * 100).toFixed(0)}%  ` : ""}
                {v.prestige ? `valuation +${((v.prestige - 1) * 100).toFixed(0)}%` : ""}
              </div>
              {building ? (
                <span className="font-mono text-micro text-power">UNDER CONSTRUCTION · {arriveLabel(building.arrive)}</span>
              ) : owned ? (
                <><span className="font-mono text-micro text-money">OWNED</span><VentureSpecializations s={s} dispatch={dispatch} venture={v.id} /></>
              ) : (
                <SmallBuy ok={ok} reason={reason} tone="money" label={money(v.cost)} sub={avail ? "acquire" : "not yet"} onClick={() => dispatch({ type: "buyVenture", id: v.id })} />
              )}
            </div>
          );
        })}
      </Panel>
    </>
  );
}

export function WorldView({
  s,
  d,
  dispatch,
  onConcept,
}: {
  s: GameState;
  d: Derived;
  dispatch: (a: Action) => void;
  onConcept: (id: string) => void;
}) {
  return (
    <>
      <PublicRelations s={s} dispatch={dispatch} />
      <Panel title="THE FRONTIER">
        <FrontierChart s={s} />
      </Panel>
      <Panel title="THE FIELD" hint={() => onConcept("overhang")}>
        <Meta
          items={[
            ["open weights", s.commonsOpenTier.toFixed(1)],
            ["diffused results", String(s.papers.filter((p) => p.diffused).length)],
            ["talent flow", (s.talentFlow >= 0 ? "+" : "") + String(s.talentFlow)],
            ["broad last", s.lastBroadCap > 0 ? s.lastBroadCap.toFixed(1) : "—"],
          ]}
        />
        <p className="mt-2 font-mono text-micro leading-relaxed text-ink-faint">
          Architecture and data results you fund become everyone's after five quarters. THE COMMONS distills a
          broad release two quarters later. Researchers walk toward whoever is winning.
        </p>
      </Panel>
      <Panel title="THE LABS">
        {s.rivals.map((r, i) => (
          <div key={r.id} className="mb-3 overflow-hidden rounded-md border-l-2 bg-panel-2" style={{ borderColor: r.color }}>
            <div className="relative h-28 sm:h-36">
              <Still src={rivalStill(r.id)} alt="" />
              <div className="absolute inset-0 bg-gradient-to-t from-panel-2 via-panel-2/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-2">
                <span className="font-mono text-sm tracking-wide" style={{ color: r.color }}>{r.name}</span>
                <span className="font-mono text-micro text-ink-muted">{r.tag}</span>
              </div>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-sm leading-relaxed text-ink-muted">{r.blurb}</p>
              <p className="mt-1 font-mono text-micro text-ink-faint">{RIVAL_DEFS[i]?.advantage}</p>
              <div className="mt-1 font-mono text-micro text-ink-muted">
                research {d.rivalCaps[i]?.toFixed(1)} · shipped {r.deployedCap.toFixed(1)} · {num(r.chips)} chips · {money(r.revenue)}/qtr
              </div>
            </div>
          </div>
        ))}
      </Panel>
      <Panel title="ABROAD" hint={() => onConcept("fastfollow")}>
        <div className="overflow-hidden rounded-md border-l-2 border-abroad bg-panel-2">
          <div className="relative h-28 sm:h-36">
            <Still src={STILLS.china} alt="" />
            <div className="absolute inset-0 bg-gradient-to-t from-panel-2 via-panel-2/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 px-3 pb-2 font-mono text-sm tracking-wide text-abroad">STATE PROGRAMME</div>
          </div>
          <div className="px-3 py-2.5">
            <p className="text-sm leading-relaxed text-ink-muted">
              Independent research plus diffusion from actual releases. It can reach 90 even if nobody else does.
              Leakage only fires if you have shipped a frontier-adjacent model.
            </p>
            <div className="mt-1 font-mono text-micro text-ink-muted">
              {s.chinaCap.toFixed(1)} · lag {(d.frontier - s.chinaCap).toFixed(1)} · leaks {s.espionageEvents}
              {s.exportControls ? " · EXPORT CONTROLS" : ""}
            </div>
          </div>
        </div>
      </Panel>
      <Panel title="POLITICS" hint={() => onConcept("export")}>
        <Meta items={[["public trust", s.trust.toFixed(0)], ["regulatory pressure", s.reg.toFixed(0)], ["incidents", String(s.incidents)], ["hazard", s.risk.toFixed(0)]]} />
        <div className="mt-3">
          <ActRow
            label="Push for export controls"
            sub="Widens the lag abroad. Cuts your chip allocation 15% and applies a permanent 22% international revenue haircut."
            cost="1 action"
            ok={s.actions > 0 && s.lobbyCooldown === 0 && !s.exportControls}
            reason={s.exportControls ? "Already in force" : s.lobbyCooldown > 0 ? `Cooldown ${s.lobbyCooldown}q` : "No actions"}
            onClick={() => dispatch({ type: "lobbyExport" })}
          />
          <ActRow
            label="Lobby against regulation"
            sub="Regulatory pressure −16, public trust −5."
            cost="1 action"
            ok={s.actions > 0 && s.lobbyCooldown === 0}
            reason={s.lobbyCooldown > 0 ? `Cooldown ${s.lobbyCooldown}q` : "No actions"}
            onClick={() => dispatch({ type: "lobbyDereg" })}
          />
        </div>
      </Panel>
      <Panel title="CONCEPTS">
        <div className="flex flex-wrap gap-1.5">
          {CONCEPTS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onConcept(c.id)}
              className="rounded-sm border border-line px-2 py-1 font-mono text-micro text-ink-muted hover:border-chip hover:text-ink"
            >
              {c.term}
            </button>
          ))}
        </div>
      </Panel>
    </>
  );
}

export function WireView({ s, filter, onFilter }: { s: GameState; filter: string; onFilter: (f: string) => void }) {
  const kinds = ["all", "decision", "delivery", "incident", "rival", "world", "finance", "model", "shock"];
  const rows = [...s.events].reverse().filter((e) => filter === "all" || e.type === filter);
  return (
    <Panel title="THE WIRE">
      <p className="mb-3 font-mono text-micro text-ink-muted">
        Through Q2 2026 items carry a provenance tag. Full session history is kept — nothing is truncated.
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onFilter(k)}
            className={
              "rounded-sm border px-2 py-1 font-mono text-2xs uppercase tracking-wide " +
              (filter === k ? "border-chip text-chip" : "border-line text-ink-muted")
            }
          >
            {k}
          </button>
        ))}
      </div>
      {rows.length === 0 && <Empty>Nothing in this filter yet.</Empty>}
      {rows.map((l) => (
        <div
          key={l.id}
          className="mb-2 border-l-2 px-3 py-2"
          style={{ borderColor: l.t > REAL_HISTORY_ENDS ? "var(--color-abroad)" : "var(--color-line)" }}
        >
          <div className="font-mono text-2xs tracking-wider text-ink-muted">
            {dateOf(l.t).label} · {l.type}
            {l.actor ? ` · ${l.actor}` : ""}
          </div>
          <div className="mt-1 text-sm leading-relaxed">{l.text}</div>
        </div>
      ))}
    </Panel>
  );
}


