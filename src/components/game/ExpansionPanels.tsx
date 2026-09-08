import { useEffect, useState } from "react";
import type { Action, ExpansionAction, GameState, SiteId } from "@/game";
import {
  CAMPAIGNS,
  SITE_NAMES,
  SITES,
  SPECIALIZATIONS,
  arriveLabel,
  campaignActive,
  campusCapacity,
  coolingBonus,
  expansionQuote,
  idx,
  linkCapacity,
  linkKey,
  money,
  mw,
  num,
  powerLeadAt,
  powerPriceAt,
} from "@/game";
import { Meta, Panel, SmallBuy, Still } from "./primitives";
import { campusStill } from "./stills";
import "./expansion.css";

type Props = { s: GameState; dispatch: (a: Action) => void };

const PR_KICKER: Record<string, string> = {
  transparency: "TRUST",
  community: "PERMITS",
  launch: "DEMAND",
};

function ExpansionBuy({
  s,
  dispatch,
  action,
  detail,
  live,
  kicker,
}: Props & { action: ExpansionAction; detail: string; live?: boolean; kicker?: string }) {
  const q = expansionQuote(s, action);
  return (
    <button
      type="button"
      className={"expansion-choice" + (live ? " is-live" : "")}
      disabled={!!q.reason}
      title={q.reason || undefined}
      onClick={() => dispatch(action)}
    >
      {kicker && (
        <span className="expansion-choice-kicker">{live ? "LIVE · " : ""}{kicker}</span>
      )}
      <span className="expansion-choice-name">{q.name}</span>
      <span className="expansion-choice-detail">{detail}</span>
      <span className="expansion-choice-cost">
        {money(q.cost)} · 1 action{q.lead ? ` · ${q.lead}q` : ""}
      </span>
      {q.reason ? <span className="expansion-choice-reason">{q.reason}</span> : null}
    </button>
  );
}

export function VentureSpecializations({ s, dispatch, venture }: Props & { venture: string }) {
  const branches = SPECIALIZATIONS.filter((x) => x.venture === venture);
  if (!branches.length) return null;
  const chosen = branches.find((x) => s.expansion.specializations.includes(x.id));
  return (
    <div className={"venture-branches" + (chosen ? " is-locked" : "")}>
      <p className="font-mono text-micro tracking-widest text-money">
        {chosen ? "SPECIALIZATION · PERMANENT" : "CHOOSE A DIRECTION"}
      </p>
      {chosen ? (
        <>
          <strong className="mt-1 block text-sm font-normal">{chosen.name}</strong>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">{chosen.description}</p>
          <p className="mt-2 font-mono text-2xs tracking-wider text-ink-faint">The other door is closed.</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            One permanent choice. The other door closes. Benefits begin immediately unless they require a campus project.
          </p>
          <div className="venture-fork">
            {branches.map((x) => (
              <ExpansionBuy
                key={x.id}
                s={s}
                dispatch={dispatch}
                action={{ type: "specializeVenture", id: x.id }}
                detail={x.description}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PublicRelations({ s, dispatch }: Props) {
  const pr = s.expansion.pr;
  const active = pr && s.t < pr.until;
  return (
    <Panel title="PUBLIC RELATIONS">
      <p className="mb-3 text-sm leading-relaxed text-ink-muted">
        Trust is not a press release. Each campaign spends one action. You can start another in six quarters.
      </p>
      <Meta
        items={[
          ["public trust", `${s.trust.toFixed(0)} / 100`],
          ["regulatory pressure", `${s.reg.toFixed(0)} / 100`],
          ["active campaign", active ? CAMPAIGNS.find((x) => x.id === pr.kind)!.name : "None"],
          [
            "next campaign",
            s.t < s.expansion.prCooldownUntil ? arriveLabel(s.expansion.prCooldownUntil) : "Available now",
          ],
        ]}
      />
      {active && (
        <p className="pr-live">
          <span>LIVE</span>
          {CAMPAIGNS.find((x) => x.id === pr.kind)!.name} through the start of {arriveLabel(pr.until)}.
        </p>
      )}
      <div className="pr-grid">
        {CAMPAIGNS.map((c) => (
          <ExpansionBuy
            key={c.id}
            s={s}
            dispatch={dispatch}
            live={!!active && pr.kind === c.id}
            kicker={PR_KICKER[c.id]}
            action={{ type: "runPR", kind: c.id }}
            detail={`${c.description} Costs the greater of ${money(c.cost)} or ${Math.round(c.revenueShare * 100)}% of last reported quarterly model revenue.`}
          />
        ))}
      </div>
    </Panel>
  );
}

const GRID: SiteId[] = ["east", "south", "onsite", "abroad"];
const POS: Record<SiteId, [number, number]> = {
  east: [25, 25],
  south: [75, 25],
  onsite: [25, 75],
  abroad: [75, 75],
};

export function CampusNetwork({ s, dispatch }: Props) {
  const [selected, setSelected] = useState<SiteId>(s.site);
  const site = SITES.find((x) => x.id === selected)!;
  const cooling = s.expansion.cooling.find((x) => x.site === selected);
  const powered = s.mwBySite[selected];
  const orders = s.orders.filter((o) => o.kind === "power" && (o.site ?? "east") === selected);
  const onlineLinks = s.expansion.links.filter((x) => x.arrive <= s.t);
  const permitRisk = site.permitRisk * (campaignActive(s, "community") ? 0.5 : 1);
  const peak = Math.max(1, ...GRID.map((id) => s.mwBySite[id]));

  useEffect(() => {
    setSelected(s.site);
  }, [s.site]);

  function inspect(id: SiteId) {
    setSelected(id);
    const open = s.t >= idx(SITES.find((x) => x.id === id)!.at);
    if (open && s.site !== id) dispatch({ type: "setSite", site: id });
  }

  return (
    <Panel title="CAMPUS NETWORK · LIVE">
      <div className="campus-intro">
        <div>
          <h2>Four sites. One fleet.</h2>
          <p>A schematic, not a map. Workloads are not placed per campus. Select a site to file power, retrofit cooling, or draw a link.</p>
        </div>
        <div className="campus-network-stat">
          <strong>{num(linkCapacity(s))}</strong>
          <span>
            extra fabric · {onlineLinks.length} online {onlineLinks.length === 1 ? "link" : "links"}
          </span>
        </div>
      </div>

      <div className="campus-map" aria-label="Campus network schematic. Select a campus to manage it.">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line className="campus-cross" x1="50" y1="46.5" x2="50" y2="53.5" vectorEffect="non-scaling-stroke" />
          <line className="campus-cross" x1="46.5" y1="50" x2="53.5" y2="50" vectorEffect="non-scaling-stroke" />
          {s.expansion.links.map((link) => {
            const from = POS[link.from];
            const to = POS[link.to];
            const online = link.arrive <= s.t;
            return (
              <g key={linkKey(link.from, link.to)}>
                <line
                  className={online ? "campus-line online" : "campus-line building"}
                  x1={from[0]}
                  y1={from[1]}
                  x2={to[0]}
                  y2={to[1]}
                  vectorEffect="non-scaling-stroke"
                />
                {online && (
                  <line
                    className="campus-line packet"
                    x1={from[0]}
                    y1={from[1]}
                    x2={to[0]}
                    y2={to[1]}
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </g>
            );
          })}
        </svg>
        {GRID.map((id) => {
          const x = SITES.find((siteDef) => siteDef.id === id)!;
          const amount = s.mwBySite[id];
          const pending = s.orders
            .filter((o) => o.kind === "power" && (o.site ?? "east") === id)
            .reduce((n, o) => n + o.qty, 0);
          const open = s.t >= idx(x.at);
          const cooled = s.expansion.cooling.find((p) => p.site === id);
          const linked = s.expansion.links.filter((l) => l.from === id || l.to === id);
          const status = amount > 0 ? "ENERGIZED" : !open ? `OPENS ${x.at.replace("Q", " Q")}` : pending > 0 ? "IN DEVELOPMENT" : "UNDEVELOPED";
          return (
            <button
              type="button"
              key={id}
              aria-pressed={selected === id}
              aria-label={`${SITE_NAMES[id]}. ${status}. ${mw(amount)} energized.`}
              onClick={() => inspect(id)}
              className={`campus-node site-${id} ${selected === id ? "selected" : ""} ${amount > 0 ? "energized" : ""} ${!open ? "locked" : ""}`}
            >
              <span className="campus-node-still" aria-hidden>
                <Still src={campusStill(id)} />
                <span className="campus-node-veil" />
              </span>
              <span className="campus-node-body">
                <span className="campus-node-status">{status}</span>
                <strong>{SITE_NAMES[id]}</strong>
                <span className="campus-node-mw">
                  {mw(amount)}
                  {pending > 0 ? ` · +${mw(pending)} queued` : ""}
                </span>
                <span className="campus-mw" aria-hidden="true">
                  <i style={{ width: `${Math.max(amount > 0 ? 8 : 0, (amount / peak) * 100)}%` }} />
                </span>
                {(cooled || linked.length > 0) && (
                  <span className="campus-pips">
                    {cooled && (
                      <span className={cooled.arrive <= s.t ? "campus-pip chip" : "campus-pip power"}>
                        {cooled.arrive <= s.t ? "COOLING ON" : "COOLING DUE"}
                      </span>
                    )}
                    {linked.some((l) => l.arrive <= s.t) && <span className="campus-pip chip">LINKED</span>}
                    {linked.some((l) => l.arrive > s.t) && <span className="campus-pip power">LINKING</span>}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <p className="campus-legend">
        <span>
          <i className="online" />
          Online link
        </span>
        <span>
          <i className="building" />
          Under construction
        </span>
        <span>The schematic is this quarter. The slider below inspects future capacity.</span>
      </p>
      {s.expansion.links.length === 0 && (
        <p className="mb-3 text-xs leading-relaxed text-ink-muted">
          No intercampus links yet. Energize a second campus to build the first connection. Existing fabric continues
          operating.
        </p>
      )}

      <div className={`campus-detail site-${selected}`} key={selected}>
        <div className="campus-detail-still" aria-hidden>
          <Still src={campusStill(selected)} />
        </div>
        <div className="campus-detail-body">
          <div className="campus-detail-heading">
            <div>
              <h3>{SITE_NAMES[selected]}</h3>
              <p className="campus-detail-aka">{site.name}</p>
            </div>
            <span>
              {s.t < idx(site.at)
                ? `OPENS ${site.at.replace("Q", " Q")}`
                : selected === s.site
                  ? "FILING SITE"
                  : "OPEN FOR EXPANSION"}
            </span>
          </div>
          <p className="mb-3 text-sm leading-relaxed text-ink-muted">{site.blurb}</p>
          <Meta
            items={[
              ["energized power", mw(powered)],
              ["powered chip capacity", num(campusCapacity(s, selected))],
              [
                "cooling retrofit",
                cooling
                  ? cooling.arrive <= s.t
                    ? `Active · +${Math.round(coolingBonus(s, selected) * 100)}%`
                    : `Due ${arriveLabel(cooling.arrive)}`
                  : "Not installed",
              ],
              ["export availability", selected === "abroad" && s.exportControls ? "70%" : "100%"],
            ]}
          />
          <div className="campus-section">
            <h4>Expand power</h4>
            <p>
              {money(powerPriceAt(selected))} per MW · {powerLeadAt(s.t, selected)}q base lead ·{" "}
              {(permitRisk * 100).toFixed(0)}% chance of a 2q permit delay. {mw(s.alloc.power)} allocation remains this
              quarter.
              {selected === "onsite"
                ? " Each filing also adds 2 regulatory pressure and costs 1 trust."
                : selected === "abroad"
                  ? " Each filing also increases China spillover by 0.08."
                  : ""}
            </p>
            <div className="campus-power-actions">
              {[1, 5, 20].map((qty) => {
                const cost = qty * powerPriceAt(selected);
                const reason = s.over
                  ? "The run is over"
                  : s.pendingEvent || s.pendingEmergency
                    ? "Resolve the pending decision"
                    : s.t < idx(site.at)
                      ? `Unlocks ${site.at.replace("Q", " Q")}`
                      : s.actions < 1
                        ? "No actions left"
                        : qty > s.alloc.power
                          ? "Insufficient power allocation"
                          : s.cash < cost
                            ? "Not enough cash"
                            : "";
                return (
                  <SmallBuy
                    key={qty}
                    tone="power"
                    label={`+${qty} MW · ${money(cost)}`}
                    sub="File power · 1 action"
                    ok={!reason}
                    reason={reason}
                    onClick={() => dispatch({ type: "fileCampusPower", site: selected, qty })}
                  />
                );
              })}
            </div>
            {orders.map((o, i) => (
              <p key={i} className="mt-2 font-mono text-xs text-power">
                {mw(o.qty)} committed · due {arriveLabel(o.arrive)}
              </p>
            ))}
          </div>
          <div className="campus-section">
            <h4>Improve the campus</h4>
            {cooling ? (
              <p>
                Cooling retrofit {cooling.arrive <= s.t ? "commissioned" : `due ${arriveLabel(cooling.arrive)}`}. Applies
                to this campus's current and future power.
              </p>
            ) : (
              <ExpansionBuy
                s={s}
                dispatch={dispatch}
                action={{ type: "upgradeCampus", site: selected }}
                detail={`Adds ${s.expansion.specializations.includes("colo-cooling") ? "25" : "15"}% powered chip capacity at this site after 2 quarters. Does not add raw MW or chips. Applies to future power at the same campus.`}
              />
            )}
          </div>
          <div className="campus-section">
            <h4>Connect campuses</h4>
            <p>
              Each link adds fabric capacity equal to{" "}
              {s.expansion.specializations.includes("fiber-backbone") ? "30" : "15"}% of the smaller endpoint's powered
              chip capacity. Online links cost 1% of their purchase price per quarter. Export restrictions reduce overseas
              link capacity. Chips and power still constrain the fleet.
            </p>
            <div className="campus-links">
              {SITES.filter((x) => x.id !== selected).map((x) => {
                const link = s.expansion.links.find((l) => linkKey(l.from, l.to) === linkKey(selected, x.id));
                return link ? (
                  <div className="campus-link-status" key={x.id}>
                    <span>
                      {SITE_NAMES[selected]} ↔ {SITE_NAMES[x.id]}
                    </span>
                    <strong className={link.arrive <= s.t ? "text-chip" : "text-power"}>
                      {link.arrive <= s.t ? "ONLINE" : `DUE ${arriveLabel(link.arrive)}`}
                    </strong>
                  </div>
                ) : (
                  <ExpansionBuy
                    key={x.id}
                    s={s}
                    dispatch={dispatch}
                    action={{ type: "connectCampuses", from: selected, to: x.id }}
                    detail={`Connect ${SITE_NAMES[selected]} to ${SITE_NAMES[x.id]}. Three quarters to commission.`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
