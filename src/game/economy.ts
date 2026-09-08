import { specializationMult, specializationIncome, coolingCapacity, linkCapacity, expansionOpex, campaignActive } from "./expansion.ts";
import {
  CHIPS_PER_MW,
  CONTESTED_SHARE,
  EXPORT_REVENUE_HAIRCUT,
  EXPORT_SUPPLY_PENALTY,
  EARLY_QUARTERS,
  LAST,
  PEOPLE,
  PERSON_EFFECT,
  PLAYER_SHARE,
  SHOCKS,
  SITES,
  TECH,
  VENTURES,
  idx,
} from "./data.ts";
import type { SiteId } from "./types.ts";
import { clamp } from "./format.ts";
import { SOLVENCY_EPS, type Derived, type GameState } from "./types.ts";

export const TRAIN_SCALE = 70;

export function shocksAt(t: number) {
  return SHOCKS.filter((s) => t >= idx(s.from) && t <= idx(s.to));
}

export function supplyAt(t: number, target: "chips" | "power" | "fabric") {
  const base = { chips: 5200 * Math.pow(1.095, t), power: 42 * Math.pow(1.055, t), fabric: 6000 * Math.pow(1.095, t) }[target];
  let avail = base;
  for (const s of shocksAt(t)) {
    if (s.target === target) avail *= 1 - s.frac;
  }
  return avail;
}

export function playerAlloc(t: number, resource: "chips" | "power" | "fabric", exportControls: boolean) {
  const share = PLAYER_SHARE[resource];
  let n = supplyAt(t, resource) * share;
  if (resource === "chips" && exportControls) n *= EXPORT_SUPPLY_PENALTY;
  return n;
}

/** The pool you and the rivals both draw from this quarter. */
export function contestedSupply(t: number, resource: "chips" | "power" | "fabric") {
  return supplyAt(t, resource) * CONTESTED_SHARE[resource];
}

/** Field-wide algorithmic multiplier the rivals run at: a slow baseline plus whatever you have published. */
export function rivalAlgo(s: Pick<GameState, "diffusedAlgo">, t: number) {
  return Math.pow(1.03, t) * s.diffusedAlgo;
}

export function chipPrice(t: number) {
  return 2600 * Math.pow(1.051, t);
}
export function chipGen(t: number) {
  return Math.pow(1.105, t);
}
export function powerPrice() {
  return 9.5e6;
}
export function fabricPrice(t: number) {
  return 260 * Math.pow(1.021, t);
}
export function powerLead(t: number) {
  return t < 40 ? 4 : 8;
}

export function capOf(cumEff: number) {
  return Math.max(0, 7.9 * Math.log10(1 + Math.max(0, cumEff)) - 3.2);
}

export function cumEffOf(cap: number) {
  const c = Math.max(0, cap);
  return Math.pow(10, (c + 3.2) / 7.9) - 1;
}

export function algoMult(tech: string[]) {
  let m = 1;
  for (const n of TECH) if (tech.includes(n.id) && n.algo) m *= n.algo;
  return m;
}
/* ---------------- named researchers ---------------- */
export function roster(s: Pick<GameState, "people">) {
  return PEOPLE.filter((p) => s.people[p.id]?.where === "you");
}
export function personById(id: string) {
  return PEOPLE.find((p) => p.id === id);
}
/** Training multiplier from ARCH/DATA people on your roster. */
export function rosterTrainMult(s: Pick<GameState, "people">) {
  let m = 1;
  for (const p of roster(s)) if (p.br === "ARCH" || p.br === "DATA") m *= PERSON_EFFECT[p.br].train;
  return m;
}
export function rosterServeMult(s: Pick<GameState, "people">) {
  let m = 1;
  for (const p of roster(s)) if (p.br === "SYS") m *= PERSON_EFFECT.SYS.serve;
  return m;
}
export function rosterFleetMult(s: Pick<GameState, "people">) {
  let m = 1;
  for (const p of roster(s)) if (p.br === "SYS") m *= PERSON_EFFECT.SYS.fleet;
  return m;
}
export function rosterHazard(s: Pick<GameState, "people">) {
  let m = 0;
  for (const p of roster(s)) if (p.br === "ALIGN") m += PERSON_EFFECT.ALIGN.hazard;
  return m;
}
/** Research in a branch is cheaper with a specialist on staff. */
export function rosterTechDisc(s: Pick<GameState, "people">, br: string) {
  return roster(s).some((p) => p.br === br) ? PERSON_EFFECT[br as keyof typeof PERSON_EFFECT].techDisc : 1;
}
/** Cost to sign someone: their base signing, ×2.2 if they must be poached from a rival. */
export function signingCost(s: GameState, id: string) {
  const p = personById(id);
  if (!p) return Infinity;
  const where = s.people[id]?.where ?? "free";
  const base = p.signing * Math.pow(1.03, Math.max(0, s.t - idx(p.at)));
  return where === "free" ? base : base * 2.2;
}
/** Chance a poach lands. Leading the frontier is the real recruiter; money is the rest. */
export function poachChance(s: GameState, d: Derived) {
  const lead = d.researchCap - d.frontier;
  return clamp(0.45 + lead * 0.08 + (s.trust - 50) * 0.003, 0.15, 0.9);
}

/* ---------------- siting ---------------- */
export function siteById(id: SiteId) {
  return SITES.find((x) => x.id === id)!;
}
export function powerPriceAt(site: SiteId) {
  return powerPrice() * siteById(site).costMult;
}
export function powerLeadAt(t: number, site: SiteId) {
  return Math.max(1, powerLead(t) + siteById(site).leadAdd);
}
/** Abroad capacity runs at 70% while export controls are active. */
export function sitePowerMult(s: Pick<GameState, "mwBySite" | "mwSecured" | "exportControls">) {
  if (!s.exportControls || s.mwSecured <= 0) return 1;
  const abroad = s.mwBySite?.abroad ?? 0;
  return 1 - 0.3 * clamp(abroad / s.mwSecured, 0, 1);
}

export function serveMult(s: GameState) {
  let m = rosterServeMult(s) * specializationMult(s, "serve") * (campaignActive(s, "launch") ? 1.12 : 1);
  for (const n of TECH) if (s.tech.includes(n.id) && n.serve) m *= n.serve;
  for (const v of VENTURES) if (s.ventures.includes(v.id) && v.serve) m *= v.serve;
  if (s.background === "enterprise") m *= 1.18;
  if (s.hyperscaler === "accepted" && flagActive(s, "hyperUntil")) m *= 0.85;
  return m;
}
export function fleetMult(s: Pick<GameState, "tech" | "ventures" | "people"> & Partial<Pick<GameState, "expansion">>) {
  let m = rosterFleetMult(s) * specializationMult(s, "fleet");
  for (const n of TECH) if (s.tech.includes(n.id) && n.fleet) m *= n.fleet;
  for (const v of VENTURES) if (s.ventures.includes(v.id) && v.fleet) m *= v.fleet;
  return m;
}
export function fabricMult(s: Pick<GameState, "tech" | "ventures">) {
  let m = 1;
  for (const n of TECH) if (s.tech.includes(n.id) && n.fabric) m *= n.fabric;
  for (const v of VENTURES) if (s.ventures.includes(v.id) && v.fabric) m *= v.fabric;
  return m;
}
export function chipDisc(s: Pick<GameState, "ventures"> & Partial<Pick<GameState, "expansion">>) {
  let m = specializationMult(s, "chipDiscount");
  for (const v of VENTURES) if (s.ventures.includes(v.id) && v.chipDisc) m *= v.chipDisc;
  return m;
}
export function alignScore(s: Pick<GameState, "tech" | "people">) {
  let a = 0;
  for (const n of TECH) if (s.tech.includes(n.id) && n.align) a += n.align;
  for (const p of PEOPLE) if (p.br === "ALIGN" && s.people?.[p.id]?.where === "you") a += PERSON_EFFECT.ALIGN.pillar;
  return a;
}
/** Quarter a research node becomes available to you: its date, or earlier with the right person on staff. */
export function techAvailableAt(s: Pick<GameState, "people">, node: (typeof TECH)[number]) {
  const early = (node.br === "ARCH" || node.br === "DATA") && roster(s).some((p) => p.br === node.br) ? EARLY_QUARTERS : 0;
  return Math.max(0, idx(node.at) - early);
}
export function hasTech(s: Pick<GameState, "tech">, id: string) {
  return s.tech.includes(id);
}
export function maxActions(s: Pick<GameState, "tech">) {
  let a = 2;
  for (const n of TECH) if (s.tech.includes(n.id) && n.action) a += n.action;
  return a;
}
export function talentMult(researchers: number) {
  return 0.55 + 0.42 * Math.log10(1 + Math.max(0, researchers));
}
export function prestigeMult(s: Pick<GameState, "ventures">) {
  let m = 1;
  for (const v of VENTURES) if (s.ventures.includes(v.id) && v.prestige) m *= v.prestige;
  return m;
}

export function hazardMod(s: Pick<GameState, "tech" | "people">) {
  let m = 1 + rosterHazard(s);
  for (const n of TECH) if (s.tech.includes(n.id) && n.risk) m += n.risk;
  return Math.max(0.2, m);
}

/** Start-inclusive, end-exclusive: flags store the first quarter the effect is off. */
export function flagActive(s: Pick<GameState, "t" | "flags">, key: string) {
  const until = s.flags[key];
  return typeof until === "number" && until > 0 && s.t < until;
}

/** Temporary containment: live compute ×0.6 for one identified quarter. Ownership is unchanged. */
export function downtimeMul(s: Pick<GameState, "t" | "flags">) {
  return flagActive(s, "downtimeUntil") ? 0.6 : 1;
}

export function derive(s: GameState): Derived {
  const powerCap = s.mwSecured * CHIPS_PER_MW * sitePowerMult(s) + coolingCapacity(s);
  const fabCap = s.fabric * fabricMult(s) + linkCapacity(s);
  const physicalLive = Math.max(0, Math.min(s.chips, powerCap, fabCap));
  const dt = downtimeMul(s);
  const live = physicalLive * dt;
  const bottleneck: Derived["bottleneck"] =
    live === 0 && s.chips <= 0
      ? "none"
      : s.chips <= powerCap && s.chips <= fabCap
        ? "chips"
        : powerCap <= fabCap
          ? "power"
          : "fabric";
  const effChips = live * s.fleet * fleetMult(s);
  const researchCap = capOf(s.cumEff);
  const rivalCaps = s.rivals.map((r) => capOf(r.cumEff));
  const deployedCap = s.deployedCap;
  const frontier = Math.max(researchCap, deployedCap, ...rivalCaps, s.chinaCap);
  return {
    powerCap,
    fabCap,
    live,
    bottleneck,
    idleChips: Math.max(0, s.chips - physicalLive),
    physicalLive,
    downtimeMul: dt,
    effChips,
    researchCap,
    deployedCap,
    rivalCaps,
    frontier,
    capability: researchCap,
  };
}

export function marketPrice(t: number) {
  return 2800 * Math.pow(0.972, t);
}

export function demandIndex(frontier: number, t: number) {
  return 0.055 * Math.pow(1.066, t) * (1 + frontier / 52);
}

export function revenueOf(s: GameState, d: Derived) {
  if (s.deployMode === "none" || s.deployedCap <= 0) return 0;
  const serveEff = d.effChips * (1 - s.trainShare) * serveMult(s);
  const quality = clamp(Math.pow(2, (s.deployedCap - d.frontier) / 4.5), 0.12, 1.7);
  const mode = s.deployMode === "limited" ? 0.42 : 1;
  const regDrag = 1 - clamp(s.reg / 100, 0, 0.35) * (hasTech(s, "evals") ? 0.4 : 1);
  const trustF = 0.6 + 0.4 * clamp(s.trust / 100, 0, 1);
  const commonsDrag = 1 - clamp((s.commonsOpenTier - s.deployedCap + 6) / 26, 0, 0.45);
  const exportDrag = s.exportControls ? 1 - EXPORT_REVENUE_HAIRCUT : 1 - s.exportHaircut;
  const raw = serveEff * marketPrice(s.t) * demandIndex(d.frontier, s.t) * quality * mode * regDrag * trustF * commonsDrag * exportDrag;
  return (raw * MARKET_CEILING) / (raw + MARKET_CEILING);
}

/** Soft ceiling on one company's quarterly serving revenue (~$640B/yr). Scenario assumption. */
export const MARKET_CEILING = 1.6e11;

export function ventureIncome(s: GameState, d: Derived) {
  let inc = specializationIncome(s);
  for (const v of VENTURES) {
    if (!s.ventures.includes(v.id)) continue;
    inc += v.income || 0;
    if (v.capIncome) inc += v.capIncome * Math.pow(1.11, Math.max(0, s.deployedCap - 40));
  }
  return inc;
}

export function opexOf(s: GameState, d: Derived) {
  // Contained chips are powered down: compute opex follows live, not owned.
  const compute = d.live * 210 * Math.pow(1.01, s.t);
  const people = s.researchers * 90000 * Math.pow(1.01, s.t);
  const overhead = 2.2e5 * Math.pow(1.018, s.t);
  return compute + people + overhead + expansionOpex(s);
}

export function interestOf(s: GameState) {
  return s.debt.principal * s.debt.rate;
}

/**
 * Principal required so that, after same-quarter interest on the new (and any repriced) debt,
 * cash is nonnegative. Interest on the new draw is paid this quarter; size the draw to cover it.
 */
export function emergencyDraw(gap: number, principal: number, oldRate: number, newRate: number) {
  const extra = Math.max(0, principal) * Math.max(0, newRate - oldRate);
  const denom = Math.max(1e-6, 1 - newRate);
  return (Math.max(0, gap) + extra) / denom;
}

export function cashInsolvent(cash: number) {
  return cash < -SOLVENCY_EPS;
}

export function roundCash(cash: number) {
  if (cash < 0 && cash > -SOLVENCY_EPS) return 0;
  return cash;
}

export function assetBook(s: GameState) {
  const chips = s.chips * chipPrice(s.t) * 0.45;
  const power = s.mwSecured * powerPrice() * 0.7;
  const ventures = VENTURES.reduce((a, v) => a + (s.ventures.includes(v.id) ? v.cost * 0.55 : 0), 0);
  return chips + power + ventures;
}

export function operatingValue(s: GameState, d: Derived) {
  const annual = Math.max(0, s.revenue + ventureIncome(s, d)) * 4;
  const sizeDrag = Math.pow(1 + annual / 4e11, -0.35);
  const revenueValue = annual * s.multiple * sizeDrag * prestigeMult(s);
  const narrative = 4e7 * Math.pow(1.13, s.t) * (1 + d.researchCap / 25) * (d.researchCap >= d.frontier - 1 ? 1.18 : 1);
  return Math.max(revenueValue, narrative);
}

export function valuationOf(s: GameState, d: Derived) {
  const ops = operatingValue(s, d);
  const assets = assetBook(s);
  const cash = Math.max(0, s.cash);
  return Math.max(0, ops + assets + cash - s.debt.principal);
}

export function valuationParts(s: GameState, d: Derived) {
  const ops = operatingValue(s, d);
  const assets = assetBook(s);
  const cash = Math.max(0, s.cash);
  const debt = s.debt.principal;
  return { ops, assets, cash, debt, total: Math.max(0, ops + assets + cash - debt) };
}

export function netWorthOf(s: GameState, d: Derived) {
  return s.ownership * valuationOf(s, d) + s.personalCash;
}

/** Capital-path score: claim on operations and assets, excluding idle company cash. */
export function founderPaper(s: GameState, d: Derived) {
  return s.ownership * Math.max(0, operatingValue(s, d) + assetBook(s) - s.debt.principal) + s.personalCash;
}

export function hireCount(s: GameState) {
  return Math.max(4, Math.floor(s.researchers * 0.35));
}
export function hireCost(s: GameState) {
  const n = hireCount(s);
  const disc = s.background === "research" ? 0.85 : 1;
  return n * 320000 * Math.pow(1.02, s.t) * disc;
}

export function raiseSize(s: GameState, d: Derived) {
  const ops = operatingValue(s, d);
  const asked = Math.max(6e6, Math.min(ops * 0.2, s.dryPowder, 2.5e10));
  return asked;
}

export function creditLimit(s: GameState, d: Derived) {
  const v = valuationOf(s, d);
  return Math.min(v * 0.12, 8e9) * clamp(s.trust / 100, 0.25, 1);
}

export function creditAvail(s: GameState, d: Derived) {
  return Math.max(0, creditLimit(s, d) - s.debt.principal);
}

export function canRaise(s: GameState) {
  if (s.raiseCooldown > 0) return { ok: false, reason: `Investors are cooling off (${s.raiseCooldown}q).` };
  if (s.raises >= 10) return { ok: false, reason: "The well is dry. Ten rounds is the ceiling." };
  if (s.emergencyRaises >= 2 && s.revenue <= 0) return { ok: false, reason: "Distressed paper has closed the ordinary market." };
  if (s.t > 20 && s.revenue <= 0 && s.deployMode === "none") {
    return { ok: false, reason: "No product, no traction. Ship something or the round dies." };
  }
  if (s.dryPowder < 6e6) return { ok: false, reason: "Remaining fund demand is exhausted." };
  return { ok: true, reason: "" };
}

export function techCost(s: GameState, node: (typeof TECH)[number]) {
  const base = s.background === "research" && s.t < 24 ? node.cost * 0.82 : node.cost;
  return base * rosterTechDisc(s, node.br);
}

export function trainYield(s: GameState, d: Derived) {
  const researchBias = s.background === "research" ? 1.12 : s.background === "enterprise" ? 0.88 : 1;
  return d.effChips * s.trainShare * algoMult(s.tech) * talentMult(s.researchers) * rosterTrainMult(s) * researchBias * TRAIN_SCALE;
}

export function runwayQuarters(s: GameState, d: Derived) {
  const net = revenueOf(s, d) + ventureIncome(s, d) - opexOf(s, d) - interestOf(s);
  if (net >= 0) return null;
  if (s.cash <= 0) return 0;
  return Math.floor(s.cash / -net);
}

export function exhaustQuarter(s: GameState, d: Derived) {
  const r = runwayQuarters(s, d);
  if (r === null) return null;
  const t = s.t + r;
  return t > LAST ? null : t;
}
