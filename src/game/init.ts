import { emptyExpansion } from "./expansion.ts";
import { DEFAULT_SEED, SAVE_VERSION, type BackgroundId, type GameState, type RivalState } from "./types.ts";
import { PEOPLE, RIVAL_DEFS, TIMELINE } from "./data.ts";
import { capOf, contestedSupply, cumEffOf, playerAlloc } from "./economy.ts";
import { nextRand } from "./rng.ts";
import { pushEvent } from "./log.ts";

function rivalFromDef(def: (typeof RIVAL_DEFS)[number]): RivalState {
  const cumEff = cumEffOf(def.startCap);
  return {
    id: def.id,
    name: def.name,
    tag: def.tag,
    blurb: def.blurb,
    color: def.color,
    aggr: def.aggr,
    serveBias: def.serveBias,
    cash: def.cash,
    chips: def.chips,
    mwSecured: def.mw,
    fabric: def.fabric,
    fleet: 1,
    cumEff,
    revenue: 0,
    deployedCap: capOf(cumEff) * 0.85,
    lastReleaseAt: -4,
    openTier: 0,
    freezeUntil: -1,
  };
}

export function initAlloc(t: number, exportControls: boolean) {
  return {
    chips: playerAlloc(t, "chips", exportControls),
    power: playerAlloc(t, "power", exportControls),
    fabric: playerAlloc(t, "fabric", exportControls),
  };
}

export function initMarket(t: number) {
  return {
    chips: contestedSupply(t, "chips"),
    power: contestedSupply(t, "power"),
    fabric: contestedSupply(t, "fabric"),
  };
}

export function initState(opts?: { seed?: number; background?: BackgroundId }): GameState {
  const seed = opts?.seed ?? DEFAULT_SEED;
  const background = opts?.background ?? "research";
  const s: GameState = {
    version: SAVE_VERSION,
    seed,
    rng: seed >>> 0,
    eventSeq: 0,
    t: 0,
    over: null,
    overActor: null,
    background,
    cash: 4.5e6,
    personalCash: 0,
    ownership: 0.88,
    chips: 8,
    mwSecured: 1.2,
    fabric: 40,
    fleet: 1,
    orders: [],
    construction: [],
    researchers: 6,
    trainShare: 0.7,
    cumEff: 15,
    tech: [],
    ventures: [],
    risk: 4,
    preparedness: 0,
    trust: 60,
    reg: 0,
    exportControls: false,
    exportHaircut: 0,
    lobbyCooldown: 0,
    raiseCooldown: 0,
    dryPowder: 1.8e11,
    chinaCap: 3.2,
    chinaBoost: 0,
    espionageEvents: 0,
    rivals: RIVAL_DEFS.map(rivalFromDef),
    actions: 2,
    revenue: 0,
    lastRevenue: 0,
    opex: 0,
    multiple: 14,
    events: [],
    seen: [],
    history: [],
    incidents: 0,
    raises: 0,
    emergencyRaises: 0,
    peakNW: 0,
    debt: { principal: 0, rate: 0.045 },
    alloc: initAlloc(0, false),
    market: initMarket(0),
    papers: [],
    diffusedAlgo: 1,
    lastBroadCap: 0,
    lastBroadAt: -8,
    releases: [],
    talentFlow: 0,
    people: Object.fromEntries(PEOPLE.map((p) => [p.id, { where: p.startsAt, since: 0 }])),
    expansion: emptyExpansion(),
    mwBySite: { east: 1.2, south: 0, onsite: 0, abroad: 0 },
    site: "east",
    candidate: null,
    deployedCap: 0,
    deployMode: "none",
    lastReleaseAt: -8,
    pendingEvent: null,
    pendingEmergency: null,
    flags: {},
    lastResolution: null,
    seenChecklist: false,
    hyperscaler: null,
    commonsOpenTier: 0,
    idleChipQuarters: 0,
    longestBottleneck: { kind: "chips", start: 0, quarters: 0 },
    currentBottleneckRun: { kind: "chips", start: 0, quarters: 0 },
    crossing: null,
  };

  if (background === "research") {
    s.researchers = 14;
    s.cumEff = 22;
    s.cash = 3.2e6;
    s.ownership = 0.9;
  } else if (background === "infra") {
    s.researchers = 4;
    s.cash = 1.1e7;
    s.mwSecured = 21.2;
    s.mwBySite = { east: 21.2, south: 0, onsite: 0, abroad: 0 };
    s.fabric = 80;
    s.chips = 24;
    s.ownership = 0.72;
    s.cumEff = 10;
    s.ventures = ["colo"];
    s.trainShare = 0.4;
  } else {
    s.researchers = 5;
    s.cash = 9e6;
    s.ownership = 0.8;
    s.cumEff = 12;
    s.trainShare = 0.35;
    s.deployedCap = capOf(12);
    s.deployMode = "limited";
    s.releases = [{ cap: capOf(12), mode: "limited", at: 0 }];
    s.lastReleaseAt = 0;
  }

  for (const r of s.rivals) r.aggr *= 0.88 + nextRand(s) * 0.24;

  pushEvent(
    s,
    "world",
    `Q4 2012. You have ${s.background === "infra" ? "megawatts and a building" : s.background === "enterprise" ? "a channel and a modest model" : "$3.2M, eight GPUs, and people who read the ImageNet paper and could not sleep"}. Two ways to win, and they pull against each other. Seed ${ (s.seed >>> 0).toString(16).padStart(8, "0") }.`,
  );
  s.history.push({
    t: 0,
    cap: capOf(s.cumEff),
    deployed: s.deployedCap,
    nw: s.ownership * 5e7,
    cash: s.cash,
    china: s.chinaCap,
    rivals: s.rivals.map((r) => capOf(r.cumEff)),
    bottleneck: "chips",
  });
  void TIMELINE;
  return s;
}
