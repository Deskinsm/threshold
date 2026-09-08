import { CHIPS_PER_MW, LAST, SITES } from "./data.ts";
import type { ExpansionAction, ExpansionState, GameState, SiteId } from "./types.ts";

export const emptyExpansion = (): ExpansionState => ({
  specializations: [],
  cooling: [],
  links: [],
  pr: null,
  prCooldownUntil: 0,
});
export const SITE_NAMES: Record<SiteId, string> = {
  east: "Grid corridor",
  south: "Southern campus",
  onsite: "On-site generation",
  abroad: "Partner campus",
};
export const SPECIALIZATIONS = [
  {
    id: "colo-leases",
    venture: "colo",
    name: "Enterprise leases",
    cost: 20e6,
    income: 2e6,
    description: "+$2M venture income per quarter.",
  },
  {
    id: "colo-cooling",
    venture: "colo",
    name: "Cooling engineering",
    cost: 30e6,
    description:
      "Campus cooling retrofits provide +25% powered capacity instead of +15%. Requires a commissioned retrofit.",
  },
  {
    id: "cloud-managed",
    venture: "cloud",
    name: "Managed inference",
    cost: 80e6,
    serve: 1.12,
    opex: 1e6,
    description:
      "Serving efficiency ×1.12; +$1M operating cost per quarter. Requires a deployed model to earn model revenue.",
  },
  {
    id: "cloud-contracts",
    venture: "cloud",
    name: "Reserved contracts",
    cost: 65e6,
    income: 5e6,
    description: "+$5M venture income per quarter.",
  },
  {
    id: "fiber-backbone",
    venture: "fiber",
    name: "Private backbone",
    cost: 250e6,
    description:
      "Doubles the fabric bonus of commissioned campus links from 15% to 30% of the smaller endpoint's powered capacity.",
  },
  {
    id: "fiber-transit",
    venture: "fiber",
    name: "Wholesale transit",
    cost: 220e6,
    income: 15e6,
    description: "+$15M venture income per quarter.",
  },
  {
    id: "silicon-efficient",
    venture: "silicon",
    name: "Efficient accelerators",
    cost: 500e6,
    fleet: 1.1,
    description: "Fleet efficiency ×1.10, on top of your existing silicon program.",
  },
  {
    id: "silicon-packaging",
    venture: "silicon",
    name: "Packaging partnership",
    cost: 450e6,
    chipDiscount: 0.9,
    description:
      "New accelerator purchases cost another 10% less. Does not increase the available supply.",
  },
] as const;
export const CAMPAIGNS = [
  {
    id: "transparency",
    name: "Open accountability",
    cost: 3e6,
    revenueShare: 0.05,
    duration: 0,
    description:
      "Publish an independent review: trust +6, preparedness +2. No direct reduction to technical hazard.",
  },
  {
    id: "community",
    name: "Community partnership",
    cost: 2e6,
    revenueShare: 0.03,
    duration: 4,
    description:
      "Fund local consultation: trust +4, regulatory pressure −5. Halves permit-delay odds on new power filings for 4 quarters; existing orders keep their dates.",
  },
  {
    id: "launch",
    name: "Product roadshow",
    cost: 5e6,
    revenueShare: 0.08,
    duration: 3,
    description:
      "Serving efficiency ×1.12 for 3 quarters; trust +2, hazard +3. Requires a deployed model.",
  },
] as const;
export function selectedSpecializations(s: { expansion?: ExpansionState }) {
  return SPECIALIZATIONS.filter((x) => s.expansion?.specializations.includes(x.id));
}
export function specializationMult(
  s: { expansion?: ExpansionState },
  field: "serve" | "fleet" | "chipDiscount",
) {
  return selectedSpecializations(s).reduce(
    (n, x) => n * ((field in x ? (x as unknown as Record<string, number>)[field] : 1) ?? 1),
    1,
  );
}
export function specializationIncome(s: GameState) {
  return selectedSpecializations(s).reduce((n, x) => n + ("income" in x ? x.income : 0), 0);
}
export function campaignActive(s: GameState, kind: string) {
  return s.expansion.pr?.kind === kind && s.t < s.expansion.pr.until;
}
export function coolingBonus(s: GameState, site: SiteId) {
  if (!s.expansion.cooling.some((p) => p.site === site && p.arrive <= s.t)) return 0;
  return s.expansion.specializations.includes("colo-cooling") ? 0.25 : 0.15;
}
export function campusCapacity(s: GameState, site: SiteId) {
  return (
    s.mwBySite[site] *
    CHIPS_PER_MW *
    (site === "abroad" && s.exportControls ? 0.7 : 1) *
    (1 + coolingBonus(s, site))
  );
}
export function coolingCapacity(s: GameState) {
  return SITES.reduce(
    (n, site) =>
      n +
      s.mwBySite[site.id] *
        CHIPS_PER_MW *
        (site.id === "abroad" && s.exportControls ? 0.7 : 1) *
        coolingBonus(s, site.id),
    0,
  );
}
export function linkCapacity(s: GameState) {
  const fraction = s.expansion.specializations.includes("fiber-backbone") ? 0.3 : 0.15;
  return s.expansion.links.reduce(
    (n, link) =>
      n +
      (link.arrive <= s.t
        ? Math.min(campusCapacity(s, link.from), campusCapacity(s, link.to)) * fraction
        : 0),
    0,
  );
}
export function expansionOpex(s: GameState) {
  return (
    selectedSpecializations(s).reduce((n, x) => n + ("opex" in x ? x.opex : 0), 0) +
    s.expansion.links.reduce((n, link) => n + (link.arrive <= s.t ? link.cost * 0.01 : 0), 0)
  );
}
export function linkKey(from: SiteId, to: SiteId) {
  return [from, to].sort().join(":");
}
export function expansionQuote(
  s: GameState,
  a: ExpansionAction,
): { cost: number; lead: number; reason: string; name: string } {
  let cost = 0,
    lead = 0,
    reason = "",
    name = "";
  if (a.type === "specializeVenture") {
    const def = SPECIALIZATIONS.find((x) => x.id === a.id);
    if (!def) return { cost, lead, name, reason: "Unknown specialization." };
    cost = def.cost;
    name = def.name;
    if (!s.ventures.includes(def.venture))
      reason = "Acquire and commission the parent venture first.";
    else if (selectedSpecializations(s).some((x) => x.venture === def.venture))
      reason = "One permanent specialization per venture.";
  } else if (a.type === "upgradeCampus") {
    name = "Cooling retrofit";
    lead = 2;
    if (!SITES.some((x) => x.id === a.site)) reason = "Unknown campus.";
    else {
      cost = Math.max(5e6, s.mwBySite[a.site] * 2e6);
      if (s.mwBySite[a.site] <= 0) reason = "Energize this campus first.";
      else if (s.expansion.cooling.some((x) => x.site === a.site))
        reason = "Cooling retrofit already funded.";
    }
  } else if (a.type === "connectCampuses") {
    name = "Campus interconnect";
    lead = 3;
    if (!SITES.some((x) => x.id === a.from) || !SITES.some((x) => x.id === a.to) || a.from === a.to)
      reason = "Choose two different campuses.";
    else {
      cost = Math.max(10e6, Math.min(s.mwBySite[a.from], s.mwBySite[a.to]) * 3e6);
      if (s.mwBySite[a.from] <= 0 || s.mwBySite[a.to] <= 0)
        reason = "Both campuses must have energized power.";
      else if (s.expansion.links.some((x) => linkKey(x.from, x.to) === linkKey(a.from, a.to)))
        reason = "This connection is already funded.";
    }
  } else {
    const def = CAMPAIGNS.find((x) => x.id === a.kind);
    if (!def) return { cost, lead, name, reason: "Unknown campaign." };
    cost = Math.max(def.cost, Math.max(0, s.revenue) * def.revenueShare);
    name = def.name;
    if (s.t < s.expansion.prCooldownUntil)
      reason = `Next campaign in ${s.expansion.prCooldownUntil - s.t} quarters.`;
    else if (a.kind === "launch" && (s.deployMode === "none" || s.deployedCap <= 0))
      reason = "Deploy a model first.";
  }
  if (!reason && s.t + lead > LAST) reason = "This project would finish after the final quarter.";
  if (!reason)
    reason = s.over
      ? "The run is over."
      : s.pendingEvent
        ? "Resolve the current event first."
        : s.pendingEmergency
          ? "Resolve emergency financing first."
          : s.actions < 1
            ? "No actions left this quarter."
            : s.cash < cost
              ? "Not enough cash."
              : "";
  return { cost, lead, reason, name };
}
export function applyExpansion(s: GameState, a: ExpansionAction) {
  const q = expansionQuote(s, a);
  if (q.reason) return q;
  s.cash -= q.cost;
  s.actions--;
  if (a.type === "specializeVenture") s.expansion.specializations.push(a.id);
  if (a.type === "upgradeCampus") s.expansion.cooling.push({ site: a.site, arrive: s.t + q.lead });
  if (a.type === "connectCampuses")
    s.expansion.links.push({ from: a.from, to: a.to, arrive: s.t + q.lead, cost: q.cost });
  if (a.type === "runPR") {
    const def = CAMPAIGNS.find((x) => x.id === a.kind)!;
    s.expansion.pr = { kind: a.kind, until: s.t + def.duration };
    s.expansion.prCooldownUntil = s.t + 6;
    s.trust = Math.min(
      100,
      s.trust + (a.kind === "transparency" ? 6 : a.kind === "community" ? 4 : 2),
    );
    if (a.kind === "transparency") s.preparedness = Math.min(100, s.preparedness + 2);
    if (a.kind === "community") s.reg = Math.max(0, s.reg - 5);
    if (a.kind === "launch") s.risk = Math.min(100, s.risk + 3);
  }
  return q;
}
export function addVenturePower(s: GameState, id: string, amount: number) {
  s.mwSecured += amount;
  s.mwBySite[id === "colo" ? "east" : "onsite"] += amount;
}

/** Strict validation before imported expansion state can reach the renderer or simulation. */
export function validateExpansion(raw: unknown, ventures: string[]): boolean {
  const obj = (x: unknown): x is Record<string, unknown> =>
    !!x && typeof x === "object" && !Array.isArray(x);
  const quarter = (x: unknown): x is number =>
    typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= 206;
  const site = (x: unknown) => SITES.some((s) => s.id === x);
  if (
    !obj(raw) ||
    !Array.isArray(raw.specializations) ||
    !Array.isArray(raw.cooling) ||
    !Array.isArray(raw.links) ||
    !quarter(raw.prCooldownUntil)
  )
    return false;
  const parents: string[] = [];
  for (const id of raw.specializations) {
    const def = SPECIALIZATIONS.find((x) => x.id === id);
    if (!def || !ventures.includes(def.venture) || parents.includes(def.venture)) return false;
    parents.push(def.venture);
  }
  const sites: unknown[] = [];
  for (const p of raw.cooling) {
    if (!obj(p) || !site(p.site) || !quarter(p.arrive) || sites.includes(p.site)) return false;
    sites.push(p.site);
  }
  const pairs: string[] = [];
  for (const p of raw.links) {
    if (
      !obj(p) ||
      !site(p.from) ||
      !site(p.to) ||
      p.from === p.to ||
      !quarter(p.arrive) ||
      typeof p.cost !== "number" ||
      !Number.isFinite(p.cost) ||
      p.cost < 10e6
    )
      return false;
    const key = linkKey(p.from as SiteId, p.to as SiteId);
    if (pairs.includes(key)) return false;
    pairs.push(key);
  }
  const pr = raw.pr;
  if (
    pr !== null &&
    (!obj(pr) ||
      !CAMPAIGNS.some((x) => x.id === pr.kind) ||
      !quarter(pr.until) ||
      pr.until > raw.prCooldownUntil)
  )
    return false;
  return true;
}
