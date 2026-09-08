import { emptyExpansion, validateExpansion } from "./expansion.ts";
import { DIFFUSION_POWER, SITES, PEOPLE, RIVAL_DEFS, TECH, idx } from "./data.ts";
import { clone, finite } from "./format.ts";
import { initMarket, initState } from "./init.ts";
import { SAVE_VERSION, type BackgroundId, type GameState, type ReleaseRecord, type RivalState } from "./types.ts";

const KEY = "threshold.v1.save";
const BACKUP = "threshold.v1.bak";

export type SaveBlob = {
  version: number;
  savedAt: string;
  state: GameState;
};

const BACKGROUNDS: BackgroundId[] = ["research", "infra", "enterprise"];
const RIVAL_IDS = RIVAL_DEFS.map((r) => r.id);

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}
function isStr(x: unknown): x is string {
  return typeof x === "string";
}
function isArr(x: unknown): x is unknown[] {
  return Array.isArray(x);
}

function looseState(x: unknown): x is GameState {
  if (!isObj(x)) return false;
  return isNum(x.t) && isNum(x.cash) && isNum(x.rng) && isArr(x.rivals) && isArr(x.events) && isArr(x.tech);
}

function fail(reason: string): { ok: false; reason: string } {
  return { ok: false, reason };
}

function checkRival(r: unknown, i: number): string | null {
  if (!isObj(r)) return `Rival ${i} is not an object.`;
  if (!isStr(r.id) || !RIVAL_IDS.includes(r.id)) return `Rival ${i} has an unknown id.`;
  for (const k of ["cash", "chips", "mwSecured", "fabric", "fleet", "cumEff", "revenue", "deployedCap", "aggr", "serveBias", "lastReleaseAt", "openTier"] as const) {
    if (!isNum(r[k])) return `Rival ${r.id} is missing ${k}.`;
  }
  return null;
}

/** Full current-schema check. Called after migrate. Rejects sparse objects that would crash derive(). */
export function validateState(raw: unknown): { ok: true; state: GameState } | { ok: false; reason: string } {
  if (!isObj(raw)) return fail("Save is not an object.");
  const s = raw as unknown as GameState;

  const nums: (keyof GameState)[] = [
    "version", "seed", "rng", "eventSeq", "t", "cash", "personalCash", "ownership",
    "chips", "mwSecured", "fabric", "fleet", "researchers", "trainShare", "cumEff",
    "risk", "preparedness", "trust", "reg", "exportHaircut", "lobbyCooldown", "raiseCooldown",
    "dryPowder", "chinaCap", "chinaBoost", "espionageEvents", "actions", "revenue",
    "lastRevenue", "opex", "multiple", "incidents", "raises", "emergencyRaises", "peakNW",
    "diffusedAlgo", "lastBroadCap", "lastBroadAt", "talentFlow", "deployedCap", "lastReleaseAt",
    "commonsOpenTier", "idleChipQuarters",
  ];
  for (const k of nums) {
    if (!isNum(s[k] as number)) return fail(`Save is missing numeric field ${k}.`);
  }
  if (!finite(s.t) || s.t < 0 || s.t > 200) return fail("Save has an impossible quarter.");
  if (!finite(s.cash) || !finite(s.chips) || s.chips < 0) return fail("Save has an impossible resource.");
  if (s.ownership < 0 || s.ownership > 1) return fail("Ownership is out of bounds.");
  if (s.trainShare < 0 || s.trainShare > 1) return fail("Train share is out of bounds.");
  if (s.trust < 0 || s.trust > 100 || s.risk < 0 || s.risk > 100) return fail("Trust or hazard is out of bounds.");
  if (!BACKGROUNDS.includes(s.background)) return fail("Unknown starting background.");
  if (s.over !== null && typeof s.over !== "string") return fail("Ending field is corrupt.");

  if (!isObj(s.debt) || !isNum(s.debt.principal) || !isNum(s.debt.rate)) return fail("Debt record is incomplete.");
  if (!isObj(s.alloc) || !isNum(s.alloc.chips) || !isNum(s.alloc.power) || !isNum(s.alloc.fabric)) {
    return fail("Allocation record is incomplete.");
  }
  if (!isObj(s.market) || !isNum(s.market.chips) || !isNum(s.market.power) || !isNum(s.market.fabric)) {
    return fail("Market record is incomplete.");
  }
  if (!isObj(s.flags)) return fail("Flags record is incomplete.");
  if (!isObj(s.longestBottleneck) || !isStr(s.longestBottleneck.kind) || !isNum(s.longestBottleneck.quarters)) {
    return fail("Bottleneck record is incomplete.");
  }
  if (!isObj(s.currentBottleneckRun) || !isStr(s.currentBottleneckRun.kind)) return fail("Bottleneck run is incomplete.");

  if (!Array.isArray(s.tech) || !s.tech.every(isStr)) return fail("Research list is corrupt.");
  if (!Array.isArray(s.ventures) || !s.ventures.every(isStr)) return fail("Venture list is corrupt.");
  if (!isObj(s.people) || PEOPLE.some((p) => !isObj(s.people[p.id]) || !["free", "you", ...RIVAL_IDS].includes(s.people[p.id].where) || !Number.isInteger(s.people[p.id].since))) return fail("Researcher roster is corrupt.");
  if (!SITES.some((x) => x.id === s.site) || !isObj(s.mwBySite) || SITES.some((x) => !isNum(s.mwBySite[x.id]) || s.mwBySite[x.id] < 0)) return fail("Campus capacity record is corrupt.");
  const campusTotal = SITES.reduce((n, x) => n + s.mwBySite[x.id], 0);
  if (Math.abs(campusTotal - s.mwSecured) > Math.max(0.001, Math.abs(s.mwSecured) * 1e-9)) return fail("Campus megawatts do not match total power.");
  if (!validateExpansion(s.expansion, s.ventures)) return fail("Expansion record is corrupt.");
  if (!Array.isArray(s.seen) || !s.seen.every(isStr)) return fail("Seen list is corrupt.");
  if (!Array.isArray(s.orders)) return fail("Order book is missing.");
  if (s.orders.some((o) => !isObj(o) || !["chips", "power", "fabric"].includes(o.kind) || !isNum(o.qty) || o.qty < 0 || !Number.isInteger(o.arrive) || (o.site !== undefined && !SITES.some((x) => x.id === o.site)))) return fail("Order book is corrupt.");
  if (!Array.isArray(s.construction)) return fail("Construction list is missing.");
  if (!Array.isArray(s.papers)) return fail("Paper list is missing.");
  if (!Array.isArray(s.releases)) return fail("Release ledger is missing.");
  if (!Array.isArray(s.events)) return fail("Wire is missing.");
  if (!Array.isArray(s.history)) return fail("History is missing.");

  if (!Array.isArray(s.rivals) || s.rivals.length !== 4) return fail("Save is missing the four named labs.");
  for (let i = 0; i < s.rivals.length; i++) {
    const err = checkRival(s.rivals[i], i);
    if (err) return fail(err);
  }
  const ids = s.rivals.map((r) => r.id).sort().join(",");
  if (ids !== [...RIVAL_IDS].sort().join(",")) return fail("Named labs do not match this build.");

  if (s.pendingEvent !== null) {
    if (!isObj(s.pendingEvent) || !isStr(s.pendingEvent.id) || !Array.isArray(s.pendingEvent.choices)) {
      return fail("Pending event is corrupt.");
    }
  }
  if (s.pendingEmergency !== null) {
    if (!isObj(s.pendingEmergency) || !isNum(s.pendingEmergency.gap) || !isNum(s.pendingEmergency.creditAvail)) {
      return fail("Pending emergency is corrupt.");
    }
  }
  if (s.candidate !== null) {
    if (!isObj(s.candidate) || !isNum(s.candidate.cap)) return fail("Candidate is corrupt.");
  }
  if (s.crossing !== null && s.crossing !== undefined) {
    if (!isObj(s.crossing) || !isNum(s.crossing.t) || !Array.isArray(s.crossing.contenders)) {
      return fail("Crossing record is corrupt.");
    }
  }

  return { ok: true, state: s };
}

function reconstructPapers(s: GameState) {
  if (s.papers.length > 0) return;
  const reconstructed = [];
  for (const n of TECH) {
    if (s.tech.includes(n.id) && n.algo && n.algo > 1 && (n.br === "ARCH" || n.br === "DATA")) {
      reconstructed.push({ id: n.id, at: Math.max(0, idx(n.at)), algo: n.algo, diffused: true });
    }
  }
  s.papers = reconstructed;
  if (s.diffusedAlgo === 1 && reconstructed.length) {
    for (const p of reconstructed) s.diffusedAlgo *= Math.pow(p.algo, DIFFUSION_POWER);
  }
}

function synthesizeReleases(s: GameState): ReleaseRecord[] {
  if (s.deployMode === "limited" || s.deployMode === "broad") {
    return [{ cap: s.deployedCap, mode: s.deployMode, at: typeof s.lastReleaseAt === "number" ? s.lastReleaseAt : s.t }];
  }
  return [];
}

export function migrate(raw: SaveBlob): SaveBlob {
  const s = clone(raw.state) as GameState;
  let v = raw.version ?? 0;
  if (v < 1) v = 1;
  if (v < 2) {
    if (!s.market) s.market = initMarket(Math.min(s.t ?? 0, 72));
    if (!Array.isArray(s.papers)) s.papers = [];
    if (typeof s.diffusedAlgo !== "number") s.diffusedAlgo = 1;
    if (typeof s.lastBroadCap !== "number") s.lastBroadCap = s.deployMode === "broad" ? s.deployedCap : 0;
    if (typeof s.talentFlow !== "number") s.talentFlow = 0;
    reconstructPapers(s);
    v = 2;
  }
  if (v < 3) {
    if (!Array.isArray(s.releases)) s.releases = synthesizeReleases(s);
    if (typeof s.lastBroadAt !== "number") {
      s.lastBroadAt = s.lastBroadCap > 0 ? (typeof s.lastReleaseAt === "number" ? s.lastReleaseAt : -8) : -8;
    }
    if (s.crossing === undefined) s.crossing = null;
    for (const r of s.rivals as RivalState[]) {
      if (typeof r.freezeUntil !== "number") r.freezeUntil = -1;
    }
    if (s.pendingEmergency && typeof s.pendingEmergency.draw !== "number") {
      s.pendingEmergency.draw = s.pendingEmergency.gap;
    }
    v = 3;
  }
  if (v < 4) {
    // v4: named researchers and siting.
    if (!s.people) s.people = Object.fromEntries(PEOPLE.map((p) => [p.id, { where: p.startsAt, since: 0 }]));
    if (!s.mwBySite) s.mwBySite = { east: s.mwSecured, south: 0, onsite: 0, abroad: 0 };
    if (!s.site) s.site = "east";
    v = 4;
  }
  if (v < 5) {
    s.expansion = emptyExpansion();
    // Older ventures added aggregate MW without attributing them to a campus.
    // Preserve total power and existing assignments; infer only missing capacity.
    if (s.mwBySite && SITES.every((x) => isNum(s.mwBySite[x.id]) && s.mwBySite[x.id] >= 0)) {
      const missing = s.mwSecured - SITES.reduce((n, x) => n + s.mwBySite[x.id], 0);
      if (missing > 0) {
        const generation = (s.ventures.includes("turbine") ? 900 : 0) + (s.ventures.includes("smr") ? 3200 : 0);
        const onsite = Math.min(missing, Math.max(0, generation - s.mwBySite.onsite));
        s.mwBySite.onsite += onsite;
        s.mwBySite.east += missing - onsite;
      }
    }
    v = 5;
  }
  s.version = SAVE_VERSION;
  return { version: SAVE_VERSION, savedAt: raw.savedAt, state: s };
}

export function serialize(state: GameState): string {
  const blob: SaveBlob = { version: SAVE_VERSION, savedAt: new Date().toISOString(), state };
  return JSON.stringify(blob);
}

export function deserialize(json: string): { ok: true; state: GameState } | { ok: false; reason: string } {
  try {
    const parsed = JSON.parse(json) as SaveBlob;
    if (!parsed || typeof parsed !== "object") return fail("Save is not an object.");
    if (!Number.isInteger(parsed.version) || parsed.version < 0) return fail("Save has no version.");
    if (parsed.version > SAVE_VERSION) return fail("Save is from a newer build.");
    if (!looseState(parsed.state)) return fail("Save is missing required fields.");
    const migrated = migrate(parsed);
    const checked = validateState(migrated.state);
    if (!checked.ok) return checked;
    return { ok: true, state: checked.state };
  } catch {
    return fail("Save could not be parsed.");
  }
}

export function loadLocal(): { ok: true; state: GameState } | { ok: false; reason: string } {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fail("No save.");
    return deserialize(raw);
  } catch {
    return fail("Storage is unavailable.");
  }
}

export function saveLocal(state: GameState) {
  try {
    const prev = localStorage.getItem(KEY);
    if (prev) localStorage.setItem(BACKUP, prev);
    localStorage.setItem(KEY, serialize(state));
    return { ok: true as const };
  } catch {
    return { ok: false as const, reason: "Could not write save." };
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasLocalSave() {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function newGame(background: GameState["background"], seed?: number) {
  return initState({ background, seed });
}

export function exportFilename(seed?: number) {
  const d = new Date();
  const day = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  if (seed !== undefined) return `threshold-${(seed >>> 0).toString(16).padStart(8, "0")}-${day}.json`;
  return `threshold-${day}.json`;
}
