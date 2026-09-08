export type Provenance = "historical" | "estimate" | "abstraction" | "projection";

export const TIMELINE = (() => {
  const out: { y: number; q: number; key: string; label: string }[] = [];
  for (let y = 2012; y <= 2030; y++) {
    for (let q = 1; q <= 4; q++) {
      if (y === 2012 && q < 4) continue;
      out.push({ y, q, key: `${y}Q${q}`, label: `Q${q} ${y}` });
    }
  }
  return out;
})();

export const LAST = TIMELINE.length - 1;
export const REAL_HISTORY_ENDS = TIMELINE.findIndex((d) => d.key === "2026Q2");
export const QUARTERS = TIMELINE.length;

export function idx(key: string) {
  return TIMELINE.findIndex((d) => d.key === key);
}

export function dateOf(t: number) {
  if (t < 0) return TIMELINE[0];
  if (t >= TIMELINE.length) {
    return { y: 2031, q: 1, key: "2031Q1", label: "after 2030" };
  }
  return TIMELINE[t];
}

export function arriveLabel(arrive: number) {
  if (arrive > LAST) return `${dateOf(arrive).label} (after campaign)`;
  return dateOf(arrive).label;
}

export type TechNode = {
  id: string;
  br: "ARCH" | "DATA" | "SYS" | "ALIGN";
  name: string;
  at: string;
  cost: number;
  algo?: number;
  serve?: number;
  fleet?: number;
  fabric?: number;
  risk?: number;
  align?: number;
  action?: number;
  forecast?: boolean;
  shield?: boolean;
  concept: string | null;
  proj?: boolean;
  desc: string;
  provenance: Provenance;
};

export const TECH: TechNode[] = [
  {
    id: "conv", br: "ARCH", name: "Deep Convolutional Nets", at: "2012Q4", cost: 1.2e6, algo: 1.35, concept: "flop",
    provenance: "historical",
    desc: "Stack the layers, put them on GPUs, stop hand-designing features. The result that started all of this.",
  },
  {
    id: "attn", br: "ARCH", name: "Sequence Models with Attention", at: "2015Q1", cost: 7e6, algo: 1.35, concept: null,
    provenance: "historical",
    desc: "Let the model decide which part of the input to look at. Machine translation stops being a research problem.",
  },
  {
    id: "xform", br: "ARCH", name: "The Transformer", at: "2017Q2", cost: 3.4e7, algo: 2.1, concept: "scaling",
    provenance: "historical",
    desc: "Drop recurrence entirely; attention is enough, and it parallelizes. Published openly, no patent.",
  },
  {
    id: "moe", br: "ARCH", name: "Mixture of Experts", at: "2022Q1", cost: 1.9e8, algo: 1.5, serve: 1.25, concept: "moe",
    provenance: "historical",
    desc: "Route each token to a few specialist sub-networks. Frontier capability at a fraction of the serving cost.",
  },
  {
    id: "arch5", br: "ARCH", name: "Sparse Recurrent Depth", at: "2028Q1", cost: 9e9, algo: 1.7, concept: null, proj: true,
    provenance: "projection",
    desc: "PROJECTED. A depth-recurrent successor that lets the model spend variable computation per token without a separate reasoning scaffold.",
  },
  {
    id: "laws", br: "DATA", name: "Scaling Laws", at: "2020Q1", cost: 4.5e7, algo: 1.35, forecast: true, concept: "scaling",
    provenance: "historical",
    desc: "Measure the loss curve and find a straight line on a log plot. Unlocks multi-quarter capability forecasts. The in-game formula is a gameplay abstraction, not the Kaplan et al. fit.",
  },
  {
    id: "chin", br: "DATA", name: "Compute-Optimal Data", at: "2022Q2", cost: 2.4e8, algo: 1.5, concept: "chinchilla",
    provenance: "historical",
    desc: "The paper landed in Q1; this is the quarter the lab actually rebalances its runs. Parameters and tokens should scale together under a compute-optimal training setup — not a universal rule for every deployment objective.",
  },
  {
    id: "rlhf", br: "DATA", name: "RLHF & Instruction Tuning", at: "2022Q3", cost: 2.8e8, algo: 1.1, serve: 1.7, concept: "rlhf",
    provenance: "historical",
    desc: "Teach the model to be useful rather than merely predictive. Almost no capability gain and an enormous commercial one.",
  },
  {
    id: "synth", br: "DATA", name: "Self-Play & Synthetic Data", at: "2025Q2", cost: 2.6e9, algo: 1.7, concept: null,
    provenance: "estimate",
    desc: "The public internet is finite and largely consumed. Generate your own training data, verify it, and train on what survives.",
  },
  {
    id: "cont", br: "DATA", name: "Continual Learning", at: "2028Q3", cost: 1.4e10, algo: 1.8, concept: null, proj: true,
    provenance: "projection",
    desc: "PROJECTED. The model stops being a snapshot. Deployment and training become the same process.",
  },
  {
    id: "par", br: "SYS", name: "Model & Pipeline Parallelism", at: "2018Q3", cost: 2.1e7, fleet: 1.25, concept: "interconnect",
    provenance: "historical",
    desc: "Split one model across many chips without drowning in communication. Your existing fleet gets meaningfully more useful.",
  },
  {
    id: "quant", br: "SYS", name: "Quantization & Distillation", at: "2023Q2", cost: 4.2e8, serve: 2.0, concept: "distill",
    provenance: "historical",
    desc: "Serve at 8 bits, then 4. Compress the frontier model into something small enough to be profitable.",
  },
  {
    id: "ttc", br: "SYS", name: "Test-Time Compute", at: "2024Q3", cost: 1.3e9, algo: 1.55, serve: 1.2, concept: "ttc",
    provenance: "historical",
    desc: "Let the model reason before it answers. ABSTRACTED: currently a training and serving multiplier, not a per-query cost model.",
  },
  {
    id: "agent", br: "SYS", name: "Agentic Scaffolds", at: "2026Q2", cost: 4.2e9, serve: 1.4, action: 1, concept: null,
    provenance: "estimate",
    desc: "The model uses tools, runs for hours, and completes work instead of answering questions. Permanently grants a third action each quarter.",
  },
  {
    id: "fab", br: "SYS", name: "Custom Optical Interconnect", at: "2027Q2", cost: 8.5e9, fabric: 1.5, concept: "interconnect", proj: true,
    provenance: "projection",
    desc: "PROJECTED. Stop buying the network and start building it. Raises your fabric ceiling by half.",
  },
  {
    id: "interp", br: "ALIGN", name: "Interpretability Program", at: "2023Q3", cost: 1.6e8, risk: -0.3, align: 1, concept: null,
    provenance: "estimate",
    desc: "Find out what is actually happening inside the network. Cuts hazard growth by about a third. Does not change incident chance except through the hazard index.",
  },
  {
    id: "evals", br: "ALIGN", name: "Dangerous Capability Evals", at: "2024Q4", cost: 6.5e8, risk: -0.25, shield: true, align: 1, concept: null,
    provenance: "estimate",
    desc: "Test for the capabilities you would need to know about before deployment. Softens regulatory drag and is required to evaluate a candidate honestly.",
  },
  {
    id: "oversight", br: "ALIGN", name: "Scalable Oversight", at: "2027Q3", cost: 1.1e10, risk: -0.25, align: 2, concept: "oversight", proj: true,
    provenance: "projection",
    desc: "PROJECTED. Supervision that does not require the supervisor to be smarter than the supervised. Required for a controlled crossing.",
  },
  {
    id: "control", br: "ALIGN", name: "Control & Containment", at: "2029Q1", cost: 2.2e10, risk: -0.25, align: 2, concept: null, proj: true,
    provenance: "projection",
    desc: "PROJECTED. Assume oversight fails and design the deployment so it fails safely. The second required pillar of a controlled crossing.",
  },
];

export const BRANCHES = {
  ARCH: { name: "Architecture", token: "chip" as const },
  DATA: { name: "Data & Training", token: "power" as const },
  SYS: { name: "Systems & Serving", token: "money" as const },
  ALIGN: { name: "Alignment", token: "abroad" as const },
};

export type VentureDef = {
  id: string;
  name: string;
  at: string;
  cost: number;
  income?: number;
  powerAdd?: number;
  fabric?: number;
  chipDisc?: number;
  fleet?: number;
  serve?: number;
  prestige?: number;
  capIncome?: number;
  commissionQ?: number;
  proj?: boolean;
  concept: string | null;
  desc: string;
  provenance: Provenance;
};

export const VENTURES: VentureDef[] = [
  {
    id: "colo", name: "Colocation Portfolio", at: "2015Q1", cost: 4.5e7, income: 4e6, powerAdd: 12, concept: "capex",
    provenance: "abstraction",
    desc: "Buy the buildings and the cooling before you need them. Adds 12 MW outright and pays modest rent.",
  },
  {
    id: "cloud", name: "Cloud Reseller", at: "2017Q1", cost: 1.4e8, income: 1.6e7, concept: null,
    provenance: "abstraction",
    desc: "Sell other people's compute at a markup while you wait for your own. Unglamorous, cash-generative.",
  },
  {
    id: "fiber", name: "Long-Haul Fiber Network", at: "2019Q2", cost: 6.5e8, income: 6e7, fabric: 1.45, concept: "interconnect",
    provenance: "abstraction",
    desc: "Own the glass between your campuses. Raises your fabric ceiling by 45%.",
  },
  {
    id: "silicon", name: "Custom Silicon Program", at: "2020Q3", cost: 1.1e9, income: 0, chipDisc: 0.72, fleet: 1.18, concept: "hbm",
    provenance: "estimate",
    desc: "Design your own accelerator. Chips cost 28% less and your fleet runs 18% more efficiently. You still queue at the same packaging house.",
  },
  {
    id: "launch", name: "Orbital Launch Company", at: "2021Q1", cost: 2.2e9, income: 1.4e8, prestige: 1.15, concept: null,
    provenance: "abstraction",
    desc: "Unrelated to the mission, enormously related to the story. Adds a 15% premium to your valuation multiple.",
  },
  {
    id: "robot", name: "Humanoid Robotics", at: "2023Q1", cost: 3.4e9, income: 0, capIncome: 9e6, concept: null,
    provenance: "projection",
    desc: "Income scales with deployed capability rather than compute. Worthless now, potentially enormous later.",
  },
  {
    id: "turbine", name: "On-Site Turbine Fleet", at: "2024Q3", cost: 6.5e9, income: 0, powerAdd: 900, concept: "power",
    provenance: "estimate",
    desc: "Stop waiting for the utility. 900 MW of gas turbines on your own land, delivered this quarter.",
  },
  {
    id: "smr", name: "Modular Reactor Program", at: "2027Q1", cost: 2.6e10, income: 6e8, powerAdd: 3200, commissionQ: 12, proj: true, concept: "power",
    provenance: "projection",
    desc: "PROJECTED. 3.2 GW, in twelve quarters. Construction is visible separately from operating assets. The only power purchase that does not compete with anyone else's demand.",
  },
  {
    id: "device", name: "Consumer Device", at: "2028Q1", cost: 1.9e10, income: 2.2e9, serve: 1.3, proj: true, concept: null,
    provenance: "projection",
    desc: "PROJECTED. Distribution you own outright. Raises serving revenue 30%.",
  },
];

export const SHOCKS = [
  {
    id: "crypto1", from: "2017Q3", to: "2018Q2", target: "chips" as const, frac: 0.34, provenance: "estimate" as Provenance,
    note: "Cryptocurrency mining is consuming a third of global accelerator output. GAME ASSUMPTION: the exact share is a scenario parameter.",
  },
  {
    id: "crypto2", from: "2021Q1", to: "2021Q4", target: "chips" as const, frac: 0.3, provenance: "estimate" as Provenance,
    note: "A second mining cycle plus pandemic supply disruption. Lead times on everything have doubled.",
  },
  {
    id: "fiberwar", from: "2022Q2", to: "2026Q4", target: "fabric" as const, frac: 0.29, provenance: "abstraction" as Provenance,
    note: "GAME ASSUMPTION. Battlefield demand out of Ukraine — fiber, RF, optics — is modelled as a 29% fabric shock. Not an audited industry statistic.",
  },
  {
    id: "hbm", from: "2024Q1", to: "2026Q4", target: "chips" as const, frac: 0.26, provenance: "estimate" as Provenance,
    note: "The shortage is no longer silicon. HBM stacks and CoWoS packaging are allocated 18 months forward.",
  },
  {
    id: "grid", from: "2026Q1", to: "2030Q4", target: "power" as const, frac: 0.33, provenance: "estimate" as Provenance,
    note: "Vehicle electrification and reindustrialization compete for the same interconnections. GAME ASSUMPTION: 33% power shock.",
  },
  {
    id: "consumer", from: "2028Q1", to: "2030Q4", target: "chips" as const, frac: 0.2, provenance: "projection" as Provenance,
    note: "PROJECTED. On-device inference silicon in phones and vehicles consumes a fifth of leading-edge output.",
  },
];

export type WireItem = { text: string; provenance: Provenance; source?: string };

export const WIRE: Record<string, WireItem[]> = {
  "2012Q4": [{ text: "AlexNet wins ImageNet by a margin nobody can explain away. It was trained on two consumer gaming GPUs.", provenance: "historical", source: "https://proceedings.neurips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html" }],
  "2013Q1": [{ text: "Google acquires DNNresearch — three people, no product, no revenue. The talent market now has a price.", provenance: "historical" }],
  "2014Q1": [{ text: "DeepMind acquired for a reported $500M. It has never shipped anything.", provenance: "historical" }],
  "2014Q3": [{ text: "Sequence-to-sequence learning published. Machine translation begins collapsing into a single general method.", provenance: "historical" }],
  "2015Q4": [{ text: "OpenAI founded as a non-profit with $1B in pledges. TensorFlow released free.", provenance: "historical" }],
  "2016Q1": [{ text: "AlphaGo defeats Lee Sedol 4-1. Move 37 is not in any human game record.", provenance: "historical" }],
  "2016Q2": [{ text: "Google reveals the TPU has been running in production for a year. Vertical integration in accelerators begins.", provenance: "historical" }],
  "2017Q2": [{ text: "'Attention Is All You Need' is published. Eight authors, one architecture, no patent.", provenance: "historical", source: "https://arxiv.org/abs/1706.03762" }],
  "2017Q4": [{ text: "AlphaZero teaches itself chess in nine hours. Meanwhile GPU prices have doubled — miners are buying everything.", provenance: "historical" }],
  "2018Q2": [{ text: "GPT-1: 117M parameters. Unremarkable results, remarkable method — pretrain on everything, then fine-tune.", provenance: "historical" }],
  "2018Q4": [{ text: "BERT tops every language benchmark. The pretrain-then-adapt pattern is now settled science.", provenance: "historical" }],
  "2019Q1": [{ text: "GPT-2 held back from full release over misuse concerns. The field's first real argument about deployment.", provenance: "historical" }],
  "2019Q3": [{ text: "Microsoft invests $1B in OpenAI, most of it earmarked as Azure credits. Capital and compute stop being separable.", provenance: "historical" }],
  "2020Q1": [{ text: "Kaplan et al. publish empirical scaling laws for language-model loss. The industry reads a roadmap: spend more. The game's capability formula is a separate abstraction.", provenance: "historical", source: "https://arxiv.org/abs/2001.08361" }],
  "2020Q2": [{ text: "GPT-3. 175B parameters, ~3.1e23 FLOP, and it does tasks nobody trained it to do.", provenance: "estimate" }],
  "2020Q3": [{ text: "NVIDIA A100 ships in volume. The datacenter GPU becomes the unit of account.", provenance: "historical" }],
  "2021Q1": [{ text: "DALL-E and Codex. Generative models arrive as products rather than papers.", provenance: "historical" }],
  "2021Q4": [{ text: "Every large lab is now compute-constrained rather than idea-constrained.", provenance: "estimate" }],
  "2022Q1": [{ text: "Chinchilla submitted 29 March 2022: model size and training tokens should scale together under its compute-optimal setup. Adoption in this game is dated Q2.", provenance: "historical", source: "https://arxiv.org/abs/2203.15556" }],
  "2022Q3": [{ text: "Stable Diffusion ships with open weights. Image generation goes from a service to a free download in a fortnight.", provenance: "historical" }],
  "2022Q4": [{ text: "ChatGPT reaches a million users in five days. Separately, the US restricts advanced accelerator exports to China.", provenance: "historical" }],
  "2023Q1": [{ text: "GPT-4. LLaMA weights leak within a week of the research release. The open-weight ecosystem now exists whether or not anyone intended it.", provenance: "historical" }],
  "2023Q2": [{ text: "H100 lead times reach a year. NVIDIA crosses a trillion dollars in market value on allocations, not shipments.", provenance: "historical" }],
  "2023Q3": [{ text: "Llama 2 released under a commercial license. The price of everything below the frontier begins falling toward zero.", provenance: "historical" }],
  "2023Q4": [{ text: "The EU reaches provisional agreement on the AI Act; the US issues an executive order with a compute-threshold reporting trigger.", provenance: "historical" }],
  "2024Q1": [{ text: "Long-context and video generation land in the same quarter. The bottleneck quietly moves from GPUs to HBM and packaging.", provenance: "estimate" }],
  "2024Q3": [{ text: "A model that reasons before answering. Test-time compute becomes a second scaling axis.", provenance: "historical" }],
  "2024Q4": [{ text: "Utilities report multi-year interconnection queues. Labs begin signing nuclear PPAs and buying gas turbines outright.", provenance: "historical" }],
  "2025Q1": [{ text: "A Chinese lab ships a frontier-adjacent reasoning model trained for a fraction of the assumed cost, with open weights. Markets reprice the sector in a day.", provenance: "historical" }],
  "2025Q2": [{ text: "A $500B multi-year datacenter program is announced. The capex-to-revenue gap becomes the sector's defining financial fact.", provenance: "estimate" }],
  "2025Q4": [{ text: "Agentic coding tools go into production. The first serious argument about whether the models are accelerating their own development.", provenance: "estimate" }],
  "2026Q1": [{ text: "Multi-gigawatt campuses break ground. Local grid politics becomes an AI story.", provenance: "estimate" }],
  "2026Q2": [{ text: "The last quarter of the recorded past. Everything after this is projection — including yours.", provenance: "historical" }],
};

export type RivalDef = {
  id: string;
  name: string;
  tag: string;
  blurb: string;
  startCap: number;
  cash: number;
  chips: number;
  mw: number;
  fabric: number;
  aggr: number;
  serveBias: number;
  color: string;
  advantage: string;
};

export const RIVAL_DEFS: RivalDef[] = [
  {
    id: "helios", name: "HELIOS", tag: "The Scaler",
    blurb: "Capital-rich and single-minded. Buys compute in volumes that distort the market and ships the moment a run finishes.",
    startCap: 6.4, cash: 1.2e9, chips: 300, mw: 0.6, fabric: 280, aggr: 1.55, serveBias: 0.28, color: "#D99B34",
    advantage: "Rushes broad launches. Competes hard for chip allocations. No evaluation delay.",
  },
  {
    id: "commons", name: "THE COMMONS", tag: "Open Weights",
    blurb: "Releases its models free. Never the frontier, always close enough — and every release collapses the price of the tier below it.",
    startCap: 5.6, cash: 3e8, chips: 140, mw: 0.35, fabric: 160, aggr: 0.85, serveBias: 0.3, color: "#7E9E58",
    advantage: "Periodic open-weight releases that cut serving margins at or below its deployed tier.",
  },
  {
    id: "meridian", name: "MERIDIAN", tag: "The Incumbent",
    blurb: "Mediocre research, unassailable distribution. It does not need to win the frontier; it needs you to need its channel.",
    startCap: 5.2, cash: 4e9, chips: 220, mw: 0.9, fabric: 240, aggr: 1.1, serveBias: 0.72, color: "#9AA4B4",
    advantage: "Enterprise distribution: extra serving revenue even off-frontier. Slow to train, fast to sell.",
  },
  {
    id: "aegis", name: "AEGIS RESEARCH", tag: "The Safety Lab",
    blurb: "Slower by policy, and it compounds regulatory goodwill instead of revenue. It gets stronger every time one of you has an incident.",
    startCap: 6.0, cash: 8e8, chips: 160, mw: 0.4, fabric: 180, aggr: 0.72, serveBias: 0.45, color: "#8A7BB8",
    advantage: "Lags deployments by a quarter to evaluate. Gains compute on incidents. Earns regulated-market access.",
  },
];

/* ---------------------------- named researchers ---------------------------- */
export type PersonDef = {
  id: string;
  name: string;
  br: "ARCH" | "DATA" | "SYS" | "ALIGN";
  at: string;
  /** Where they are at game start: "free" or a rival id. */
  startsAt: string;
  signing: number;
  blurb: string;
};
/** Fictional. Any resemblance to a real researcher is a coincidence of the field having archetypes. */
export const PEOPLE: PersonDef[] = [
  { id: "okafor", name: "Nnamdi Okafor", br: "ARCH", at: "2012Q4", startsAt: "free", signing: 9e5,
    blurb: "Wrote the convnet everyone else copied. Cares about architectures the way other people care about their children." },
  { id: "lindqvist", name: "Maja Lindqvist", br: "SYS", at: "2014Q1", startsAt: "meridian", signing: 2.4e6,
    blurb: "Runs the largest cluster in the world and is bored by it. Can make ten thousand chips act like one." },
  { id: "petrov", name: "Ilya Petrov-Ha", br: "DATA", at: "2016Q1", startsAt: "free", signing: 5e6,
    blurb: "Believes the loss curve is a law of physics and has the plots to make you believe it too." },
  { id: "achterberg", name: "Rosa Achterberg", br: "ALIGN", at: "2017Q3", startsAt: "aegis", signing: 6e6,
    blurb: "Left a tenured chair to work on a problem she says nobody is allowed to be wrong about twice." },
  { id: "tanaka", name: "Kenji Tanaka", br: "ARCH", at: "2019Q2", startsAt: "helios", signing: 3e7,
    blurb: "Attention was his idea, or close enough that HELIOS pays him as if it were." },
  { id: "diallo", name: "Aminata Diallo", br: "SYS", at: "2021Q3", startsAt: "free", signing: 6e7,
    blurb: "Serves a billion queries a day at a cost the finance team refuses to believe." },
  { id: "morrow", name: "Sam Morrow", br: "DATA", at: "2023Q4", startsAt: "commons", signing: 2.2e8,
    blurb: "Trains on data nobody else can find, and open-sources the recipe out of spite." },
  { id: "verhoeven", name: "Dr. Elske Verhoeven", br: "ALIGN", at: "2025Q1", startsAt: "free", signing: 4e8,
    blurb: "The person regulators call first. Having her on staff is worth a hearing." },
];
/** Per person on your roster, by branch. */
/**
 * People are keys, not multipliers: in a race, time beats percentages.
 * ARCH/DATA: that branch's research unlocks EARLY_QUARTERS early and 30% cheaper, plus a small training gain.
 * SYS: a cut candidate arrives already evaluated (ship in two actions, not three), plus a serving gain.
 * ALIGN: counts as an alignment pillar toward a controlled crossing, plus hazard reduction.
 */
export const PERSON_EFFECT = {
  ARCH: { train: 1.06, techDisc: 0.7, early: 4 },
  DATA: { train: 1.06, techDisc: 0.7, early: 4 },
  SYS: { serve: 1.12, fleet: 1.04, techDisc: 0.7, preEvaluated: true },
  ALIGN: { hazard: -0.12, pillar: 1, techDisc: 0.7 },
} as const;
export const EARLY_QUARTERS = 4;
/** Quarters before you can try to poach the same person again after they say no. */
export const POACH_COOLDOWN = 6;

/* ---------------------------- siting ---------------------------- */
import type { SiteId } from "./types.ts";
export type SiteDef = {
  id: SiteId;
  name: string;
  at: string;
  costMult: number;
  leadAdd: number;
  /** Chance an order is held up by permitting; each hit adds 2 quarters. */
  permitRisk: number;
  blurb: string;
  tradeoff: string;
};
export const SITES: SiteDef[] = [
  { id: "east", name: "Established grid corridor", at: "2012Q4", costMult: 1.0, leadAdd: 0, permitRisk: 0.04,
    blurb: "Northern Virginia, roughly. Fiber everywhere, utilities that know the drill, queue positions that are all taken.",
    tradeoff: "Full price, standard queue, almost nothing goes wrong." },
  { id: "south", name: "Cheap-power state", at: "2012Q4", costMult: 0.74, leadAdd: 2, permitRisk: 0.22,
    blurb: "Texas, roughly. Gas is cheap, land is cheap, and the county commission is not sure it wants you.",
    tradeoff: "26% cheaper, two quarters slower, and one order in five gets stuck in permitting for another two." },
  { id: "onsite", name: "Behind the meter", at: "2024Q1", costMult: 1.55, leadAdd: -2, permitRisk: 0.08,
    blurb: "Your own turbines on your own land, skipping the utility entirely. The county still gets a vote on the emissions.",
    tradeoff: "55% more expensive, two quarters faster, and every order costs a little regulation and trust." },
  { id: "abroad", name: "Sovereign-partner campus", at: "2022Q3", costMult: 0.62, leadAdd: 0, permitRisk: 0.06,
    blurb: "A Gulf or Nordic partner builds it for you and asks for very little — for now.",
    tradeoff: "38% cheaper. Runs at 70% whenever export controls are active, and every campus is a leakage vector." },
];

/* ---------------------------- the record ---------------------------- */
/**
 * Estimated real frontier on this game's capability index, 2012–2026.
 * Anchors: AlexNet ~4.7e17 FLOP, GPT-3 ~3.1e23, GPT-4-class ~2e25, reasoning-era runs above that.
 * Provenance: estimate. The index is a game abstraction; the shape is what matters.
 */
export const HISTORICAL_FRONTIER: { at: string; cap: number; note?: string }[] = [
  { at: "2012Q4", cap: 8, note: "AlexNet" },
  { at: "2014Q1", cap: 15 },
  { at: "2016Q1", cap: 26, note: "AlphaGo" },
  { at: "2017Q2", cap: 30, note: "Transformer" },
  { at: "2018Q4", cap: 36, note: "BERT" },
  { at: "2019Q1", cap: 40, note: "GPT-2" },
  { at: "2020Q2", cap: 48, note: "GPT-3" },
  { at: "2022Q1", cap: 56, note: "Chinchilla / PaLM" },
  { at: "2023Q1", cap: 64, note: "GPT-4" },
  { at: "2024Q1", cap: 70 },
  { at: "2024Q3", cap: 74, note: "reasoning models" },
  { at: "2025Q1", cap: 77 },
  { at: "2026Q2", cap: 81, note: "end of the record" },
];

export const CONCEPTS = [
  { id: "scaling", term: "Scaling laws", provenance: "abstraction" as Provenance, source: "https://arxiv.org/abs/2001.08361",
    body: "Kaplan et al. (2020) found empirical power-law relationships for language-model loss across compute, model size, and data. That is not evidence for this game's capability formula, and it is not a guaranteed compute route to ASI. In THRESHOLD the relationship is a gameplay abstraction: capability = 7.9 × log10(1 + cumulative effective training compute) − 3.2. Every 10× in cumulative effective compute buys a fixed increment on that index. It is a teaching device, not a scientific claim." },
  { id: "flop", term: "FLOP and the training run", provenance: "estimate" as Provenance,
    body: "A training run's size is measured in floating-point operations. AlexNet (2012) used about 4.7e17 FLOP. GPT-3 (2020) used about 3.1e23. GPT-4-class runs are estimated near 2e25. Roughly eight orders of magnitude in twelve years — around half from better chips, half from buying far more of them." },
  { id: "chinchilla", term: "Compute-optimal training", provenance: "historical" as Provenance, source: "https://arxiv.org/abs/2203.15556",
    body: "Hoffmann et al. submitted Chinchilla on 29 March 2022. Headline finding: for a fixed compute budget under their setup, parameters and training tokens should scale together. It is not a universal rule for every deployment objective. In this game the research item becomes available in Q2 2022 as adoption, not as the publication date." },
  { id: "traininf", term: "Training vs inference", provenance: "abstraction" as Provenance,
    body: "Training is a capital expense that produces a capability. Inference is the ongoing cost of answering queries, and it is where revenue comes from. Every live chip is doing one or the other. A lab that trains everything earns nothing; a lab that serves everything stops advancing." },
  { id: "hbm", term: "HBM and advanced packaging", provenance: "estimate" as Provenance,
    body: "High-bandwidth memory stacks are bonded to the GPU die using advanced packaging (TSMC CoWoS). From roughly 2023 onward the shortage was often packaging and HBM, not raw wafers. The bottleneck is almost never the thing everyone is talking about." },
  { id: "interconnect", term: "Interconnect", provenance: "estimate" as Provenance,
    body: "A training run is one computation spread across tens of thousands of chips that must exchange gradients constantly. The network fabric — NVLink, InfiniBand, optics — determines whether a large cluster behaves like one machine or many. Owning chips you cannot network is owning inventory." },
  { id: "power", term: "The interconnect queue", provenance: "estimate" as Provenance,
    body: "You cannot simply buy electricity at scale. Connecting a large load to the grid requires a utility study and queue position, commonly three to five years in the US. This is why the binding constraint in the late 2020s is often energized megawatts. The exact chips-per-MW ratio in this game (700) is a scenario assumption." },
  { id: "distill", term: "Distillation", provenance: "estimate" as Provenance,
    body: "A small model trained on the outputs of a large one can capture much of its behavior at a fraction of the cost. A frontier lab's advantage leaks the moment it deploys. This is also how a fast follower stays close without matching your compute." },
  { id: "openweights", term: "Open weights", provenance: "historical" as Provenance,
    body: "Releasing model weights publicly collapses the price of every capability at or below that level. It does not hurt the leader's frontier position, but it destroys the revenue of everyone selling in the tier that just became free." },
  { id: "moe", term: "Mixture of experts", provenance: "historical" as Provenance,
    body: "Instead of running every parameter for every token, route each token to a small subset of specialist sub-networks. You get the capability of a very large model at the serving cost of a much smaller one." },
  { id: "ttc", term: "Test-time compute", provenance: "historical" as Provenance,
    body: "Rather than making the model bigger, let it think longer at inference. Demonstrated at scale in 2024. In this version the effect is abstracted as training and serving multipliers; a later version would charge reasoning per query." },
  { id: "rlhf", term: "RLHF", provenance: "historical" as Provenance,
    body: "Reinforcement learning from human feedback turns a raw text predictor into something that follows instructions. Little raw capability, enormous commercial value — the difference between a research artifact and a product." },
  { id: "export", term: "Export controls", provenance: "historical" as Provenance,
    body: "From October 2022 the US restricted sales of advanced accelerators and semiconductor equipment to China. In this game the action also cuts your own allocation and applies a permanent international revenue haircut — the tradeoffs the original copy promised." },
  { id: "dilution", term: "Dilution", provenance: "abstraction" as Provenance,
    body: "You raise capital by selling new shares. Your percentage falls; the company's value rises. Whether you come out ahead depends on whether the money compounds faster than you diluted." },
  { id: "multiple", term: "The revenue multiple", provenance: "abstraction" as Provenance,
    body: "A company's valuation is usually some multiple of its revenue, and that multiple is a sentiment reading, not a fact. It expands in booms and collapses in busts." },
  { id: "depreciation", term: "Depreciation", provenance: "estimate" as Provenance,
    body: "An accelerator is a wasting asset. It is typically depreciated over five to six years, but its competitive usefulness decays much faster. In this game 3.5% of the fleet retires each quarter and relative efficiency decays 1.8%." },
  { id: "overhang", term: "Compute overhang", provenance: "abstraction" as Provenance,
    body: "When algorithms improve faster than hardware, existing chips suddenly become capable of far more than they were built for. In this game every Architecture or Data result you fund diffuses to the rest of the field five quarters later — the rivals' installed base is retroactively upgraded by about half your gain, and the programme abroad closes a little of its lag. You cannot keep a result secret; the game's assumption is that a lab which does not publish cannot hire." },
  { id: "market", term: "The contested pool", provenance: "abstraction" as Provenance,
    body: "Each quarter roughly 60% of global chip, power and fabric supply is contested between you and the four named labs. Your allocation is the most you may reserve; every unit you take comes out of the same pool the rivals bid into afterwards, most aggressive first. Leave it on the table and HELIOS eats it. This is the mechanism by which your purchasing bends their curves." },
  { id: "talent", term: "Talent flow", provenance: "abstraction" as Provenance,
    body: "Researchers move toward whoever is winning. Headcount drifts a few percent toward the lab whose shipped model leads, and leaves in a lump after an incident. Eight named people matter more than the headcount: each accelerates their branch, cuts that branch's research cost, and can be poached — by you, from a rival, when you hold the frontier or pay enough; and from you, when you do not. Results leave with people. The names are fictional; the pattern is not." },
  { id: "siting", term: "Siting", provenance: "abstraction" as Provenance,
    body: "Megawatts are not fungible. Where you put a campus sets its price, its queue, and who can stop it. Cheap-power states are slow and politically uncertain; the established corridor is expensive and reliable; behind-the-meter turbines skip the utility and inherit the emissions fight; a sovereign partner abroad is cheapest of all and exposed to every export-control decision you lobby for. Once energized, a campus can be retrofitted for denser cooling, and two energized campuses can be linked — the link adds fabric, not a private highway for particular workloads. Costs and lead-time deltas are scenario assumptions." },
  { id: "record", term: "The record", provenance: "estimate" as Provenance,
    body: "The dotted line on the frontier chart is an estimate of where the real frontier sat, on this game's index, from AlexNet to mid-2026. It is built from published or estimated training-compute figures and the game's own capability formula, so it is only as good as both. Use it to ask one question: at each date, were you ahead of history, and by how much?" },
  { id: "fastfollow", term: "Fast follow", provenance: "abstraction" as Provenance,
    body: "A follower does not need to solve the problem, only to learn that it is solvable and roughly how. Published papers, distillation, departing staff, and theft all shorten the lag. Racing hard is also the fastest way to pull a pursuer forward. Leakage in this game only fires if you have actually released a frontier-adjacent model." },
  { id: "oversight", term: "Scalable oversight", provenance: "estimate" as Provenance,
    body: "How do you supervise a system that is better than you at the task you are supervising? Unsolved as of 2026. In this game both Scalable Oversight and Control & Containment are required for a controlled crossing, along with a hazard index below 45 at the moment of deployment." },
  { id: "capex", term: "Capex and the burn", provenance: "estimate" as Provenance,
    body: "Datacenter buildout is one of the most capital-intensive activities in the economy: roughly $10M per megawatt of built capacity before you buy a single chip. Revenue arrives years after the spend. That mismatch is why AI is a financing problem as much as a research problem." },
  { id: "release", term: "Research vs deployment", provenance: "abstraction" as Provenance,
    body: "Cumulative training produces research capability. Revenue, leakage, and the threshold crossing itself are driven by what you have actually released. You can be first to train a 90 and still lose the race if you refuse to ship it." },
];

export const BACKGROUNDS: Record<
  string,
  { id: "research" | "infra" | "enterprise"; name: string; tag: string; plus: string; minus: string }
> = {
  research: {
    id: "research", name: "Research founder", tag: "The lab",
    plus: "Eight extra researchers, a slightly stronger starting result, cheaper early research.",
    minus: "Thinner cash, no distribution, and you will have to raise or die.",
  },
  infra: {
    id: "infra", name: "Infrastructure operator", tag: "The substrate",
    plus: "20 MW already energized, more starting cash, a colocation habit.",
    minus: "Fewer researchers, lower ownership, and the models are not why you showed up.",
  },
  enterprise: {
    id: "enterprise", name: "Enterprise founder", tag: "The channel",
    plus: "A serving premium and enough cash to buy time. Customers exist on day one.",
    minus: "Mediocre research talent. You monetize other people's frontiers unless you catch up.",
  },
};

export const PLAYER_SHARE = { chips: 0.26, power: 0.28, fabric: 0.3 };
/** Share of global supply that is up for grabs between you and the named labs each quarter. */
export const CONTESTED_SHARE = { chips: 0.46, power: 0.5, fabric: 0.54 };
/** Quarters between funding an algorithmic result and the rest of the field reproducing it. */
export const DIFFUSION_LAG = 5;
/** Exponent applied to a diffused multiplier: rivals get algo^0.55 of what you got. */
export const DIFFUSION_POWER = 0.55;
export const EXPORT_SUPPLY_PENALTY = 0.85;
export const EXPORT_REVENUE_HAIRCUT = 0.22;
export const CHIPS_PER_MW = 700;
export const FLEET_RETIRE = 0.035;
export const FLEET_DECAY = 0.982;
export const CREDIT_APR_Q = 0.045;
export const EMERGENCY_RATE = 0.09;
export const MAX_EMERGENCY_RAISES = 2;
export const MAX_RAISES = 10;
export const RAISE_COOLDOWN = 3;
export const CAPITAL_WIN = 1e12;
export const THRESHOLD_CAP = 90;
export const CONTROLLED_RISK = 45;
export const BAD_RISK = 60;
export const SECONDARY_POINTS = 0.02;
export const ILLIQUIDITY = 0.82;

export function techById(id: string) {
  return TECH.find((n) => n.id === id);
}
export function ventureById(id: string) {
  return VENTURES.find((v) => v.id === id);
}
