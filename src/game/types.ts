export const SAVE_VERSION = 5;
export const DEFAULT_SEED = 0xa13e2012;
/** Sub-dollar residuals are not insolvency; runOps rounds them to zero. */
export const SOLVENCY_EPS = 1;

export type Resource = "chips" | "power" | "fabric";

export type Order = {
  kind: Resource;
  qty: number;
  arrive: number;
  label: string;
  gen?: number;
  unitCost: number;
  /** Power orders only: which campus this load is filed for. */
  site?: SiteId;
};

export type SiteId = "east" | "south" | "onsite" | "abroad";

export type ExpansionState = {
  specializations: string[];
  cooling: { site: SiteId; arrive: number }[];
  links: { from: SiteId; to: SiteId; arrive: number; cost: number }[];
  pr: { kind: "transparency" | "community" | "launch"; until: number } | null;
  prCooldownUntil: number;
};
export type ExpansionAction =
  | { type: "specializeVenture"; id: string }
  | { type: "upgradeCampus"; site: SiteId }
  | { type: "connectCampuses"; from: SiteId; to: SiteId }
  | { type: "runPR"; kind: "transparency" | "community" | "launch" };

export type PersonState = {
  /** "you", a rival id, or "free". */
  where: string;
  since: number;
};

export type Construction = {
  id: string;
  ventureId: string;
  arrive: number;
  label: string;
};

export type RivalState = {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  color: string;
  aggr: number;
  serveBias: number;
  cash: number;
  chips: number;
  mwSecured: number;
  fabric: number;
  fleet: number;
  cumEff: number;
  revenue: number;
  deployedCap: number;
  lastReleaseAt: number;
  openTier: number;
  freezeUntil: number;
};

export type Paper = {
  id: string;
  at: number;
  algo: number;
  diffused: boolean;
};

export type ReleaseRecord = {
  cap: number;
  mode: "limited" | "broad";
  at: number;
};

export type CrossingRecord = {
  t: number;
  contenders: { id: string; cap: number }[];
  winner: string | null;
  winnerCap: number;
  reason: string;
  hazardAtOps: number;
};

export type Candidate = {
  cap: number;
  createdAt: number;
  evaluated: boolean;
  evalNotes: string;
};

export type DeployMode = "none" | "limited" | "broad";

export type DebtState = {
  principal: number;
  rate: number;
};

export type EventChoice = {
  id: string;
  label: string;
  detail: string;
  cost?: number;
};

export type PendingEvent = {
  id: string;
  title: string;
  body: string;
  choices: EventChoice[];
} | null;

export type EmergencyOffer = {
  gap: number;
  /** Principal actually drawn — covers the ops gap plus same-quarter interest on the new (and repriced) debt. */
  draw: number;
  creditAvail: number;
  canDistressed: boolean;
  distressedAmount: number;
  loanRate: number;
};

export type PendingEmergency = EmergencyOffer | null;

export type LogKind =
  | "decision"
  | "delivery"
  | "incident"
  | "rival"
  | "world"
  | "finance"
  | "research"
  | "ops"
  | "safety"
  | "ending"
  | "shock"
  | "model";

export type LogEvent = {
  id: number;
  t: number;
  type: LogKind;
  actor?: string;
  text: string;
  delta?: Record<string, number>;
};

export type HistoryPoint = {
  t: number;
  cap: number;
  deployed: number;
  nw: number;
  cash: number;
  china: number;
  rivals: number[];
  bottleneck: string;
};

export type EndingId =
  | "capital"
  | "asi_controlled"
  | "asi_ambiguous"
  | "asi_bad"
  | "rival"
  | "china"
  | "insolvent"
  | "timeout";

export type BackgroundId = "research" | "infra" | "enterprise";

export type Resolution = {
  tFrom: number;
  tTo: number;
  revenue: number;
  opex: number;
  ventureIncome: number;
  interest: number;
  net: number;
  capBefore: number;
  capAfter: number;
  deployedBefore: number;
  cashBefore: number;
  cashAfter: number;
  deliveries: string[];
  incident: boolean;
  notes: string[];
};

export type GameState = {
  version: number;
  seed: number;
  rng: number;
  eventSeq: number;
  t: number;
  over: EndingId | null;
  overActor: string | null;
  background: BackgroundId;
  cash: number;
  personalCash: number;
  ownership: number;
  chips: number;
  mwSecured: number;
  fabric: number;
  fleet: number;
  orders: Order[];
  construction: Construction[];
  researchers: number;
  trainShare: number;
  cumEff: number;
  tech: string[];
  ventures: string[];
  risk: number;
  preparedness: number;
  trust: number;
  reg: number;
  exportControls: boolean;
  exportHaircut: number;
  lobbyCooldown: number;
  raiseCooldown: number;
  dryPowder: number;
  chinaCap: number;
  chinaBoost: number;
  espionageEvents: number;
  rivals: RivalState[];
  actions: number;
  revenue: number;
  lastRevenue: number;
  opex: number;
  multiple: number;
  events: LogEvent[];
  seen: string[];
  history: HistoryPoint[];
  incidents: number;
  raises: number;
  emergencyRaises: number;
  peakNW: number;
  debt: DebtState;
  alloc: { chips: number; power: number; fabric: number };
  /** Contested supply this quarter, shared by you and the rivals. Your orders and theirs both drain it. */
  market: { chips: number; power: number; fabric: number };
  /** Algorithmic results you funded. After a lag they diffuse to every other lab (compute overhang). */
  papers: Paper[];
  /** Field-wide algorithmic multiplier the rivals inherit from diffused papers. */
  diffusedAlgo: number;
  /** Highest capability you have ever released broadly. This is what THE COMMONS distills. */
  lastBroadCap: number;
  /** Quarter of the last *broad* release. Limited releases must not move this. */
  lastBroadAt: number;
  /** Immutable release ledger. New releases never rewrite older diffusion clocks. */
  releases: ReleaseRecord[];
  /** Net researchers gained (+) or lost (−) to other labs over the run. */
  talentFlow: number;
  /** Named researchers: where each one is right now. */
  people: Record<string, PersonState>;
  /** Energized megawatts by campus. Sums to mwSecured. */
  mwBySite: Record<SiteId, number>;
  expansion: ExpansionState;
  /** Campus the next power order is filed for. */
  site: SiteId;
  candidate: Candidate | null;
  deployedCap: number;
  deployMode: DeployMode;
  lastReleaseAt: number;
  pendingEvent: PendingEvent;
  pendingEmergency: PendingEmergency;
  flags: Record<string, number>;
  lastResolution: Resolution | null;
  seenChecklist: boolean;
  hyperscaler: "accepted" | "refused" | null;
  commonsOpenTier: number;
  idleChipQuarters: number;
  longestBottleneck: { kind: string; start: number; quarters: number };
  currentBottleneckRun: { kind: string; start: number; quarters: number };
  /** Adjudicated crossing, stored at resolution so endings and the world debrief agree. */
  crossing: CrossingRecord | null;
};

export type Action =
  | ExpansionAction
  | { type: "fileCampusPower"; site: SiteId; qty: number }
  | { type: "orderChips"; qty: number }
  | { type: "orderPower"; qty: number }
  | { type: "orderFabric"; qty: number }
  | { type: "hire" }
  | { type: "hirePerson"; id: string }
  | { type: "poach"; id: string }
  | { type: "setSite"; site: SiteId }
  | { type: "buyTech"; id: string }
  | { type: "buyVenture"; id: string }
  | { type: "raise" }
  | { type: "secondary" }
  | { type: "lobbyExport" }
  | { type: "lobbyDereg" }
  | { type: "safetyPush" }
  | { type: "prepareCandidate" }
  | { type: "evaluateCandidate" }
  | { type: "deploy"; mode: "limited" | "broad" }
  | { type: "chooseEvent"; choice: string }
  | { type: "emergency"; choice: "credit" | "distressed" | "default" }
  | { type: "setTrainShare"; share: number }
  | { type: "dismissChecklist" };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string; state: GameState };

export type Derived = {
  powerCap: number;
  fabCap: number;
  live: number;
  bottleneck: "chips" | "power" | "fabric" | "none";
  idleChips: number;
  /** Physical live before containment haircut. */
  physicalLive: number;
  downtimeMul: number;
  effChips: number;
  researchCap: number;
  deployedCap: number;
  rivalCaps: number[];
  frontier: number;
  capability: number;
};

export type Forecast = {
  cashBefore: number;
  revenue: number;
  opex: number;
  ventureIncome: number;
  interest: number;
  net: number;
  cashAfter: number;
  capBefore: number;
  capAfter: number;
  capDelta: number;
  live: number;
  bottleneck: Derived["bottleneck"];
  deliveriesNext: Order[];
  commissionsNext: Construction[];
  runwayQuarters: number | null;
  exhaustQuarter: number | null;
  wouldInsolvent: boolean;
  assumptions: string[];
};
