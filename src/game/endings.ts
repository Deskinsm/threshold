import { HISTORICAL_FRONTIER, PEOPLE, REAL_HISTORY_ENDS, dateOf } from "./data.ts";
import { alignScore, derive, founderPaper, netWorthOf, valuationOf } from "./economy.ts";
import { money, mw, num } from "./format.ts";
import type { EndingId, GameState } from "./types.ts";

export type EndingView = {
  id: EndingId;
  kicker: string;
  title: string;
  color: "money" | "chip" | "power" | "risk" | "abroad" | "dim";
  body: string[];
};

export function endingView(s: GameState): EndingView {
  const d = derive(s);
  const nw = netWorthOf(s, d);
  const val = valuationOf(s, d);
  const date = dateOf(Math.min(s.t, 72));
  const lead = d.researchCap >= d.frontier - 0.05;
  const align = alignScore(s);
  const rival = s.rivals.find((r) => r.id === s.overActor);

  switch (s.over) {
    case "capital":
      return {
        id: "capital",
        kicker: `${date.label} — CAPITAL`,
        title: "The number is a multiple",
        color: "money",
        body: [
          `You crossed a trillion dollars of founder paper in ${date.label} — ${money(founderPaper(s, d))} as a claim on operations and assets, excluding idle cash. Personal net worth including cash is ${money(nw)}. There was no announcement because the number is a fact about a multiple, and the multiple is a fact about how a few thousand people currently feel.`,
          `The lab is worth ${money(val)} and you hold ${(s.ownership * 100).toFixed(2)}% of it after ${s.raises} rounds. Underneath it sits ${mw(s.mwSecured)} energized, ${num(s.chips)} accelerators, and ${s.ventures.length} operating ventures.`,
          lead
            ? "You also hold the research frontier, which is the only reason the multiple is what it is. Stop advancing and the number unwinds faster than it was built."
            : "You did not hold the frontier at the end. Someone else is setting the pace and you are monetizing the tier below it — a genuinely excellent business, and a different one from the lab you described in 2012.",
          `Deployed capability ${s.deployedCap.toFixed(1)} / research ${d.researchCap.toFixed(1)}. The threshold is still out there.`,
        ],
      };
    case "asi_controlled":
      return {
        id: "asi_controlled",
        kicker: `${date.label} — THE THRESHOLD`,
        title: "A crossing you can describe afterwards",
        color: "chip",
        body: [
          `You shipped a ${s.deployedCap.toFixed(1)} system in ${date.label} with Scalable Oversight and Control & Containment both funded. Alignment pillars ${align}/6. Hazard at the moment of deployment sat below the controlled line.`,
          `That is why there is a report to read rather than a reconstruction to assemble. The quarters spent on interpretability and oversight were quarters HELIOS spent on capacity.`,
          `Net worth ${money(nw)}. The programme abroad reached ${s.chinaCap.toFixed(1)}. It is still closing — a threshold is not a wall, and nothing about your having crossed it carefully obliges anyone else to.`,
        ],
      };
    case "asi_ambiguous":
      return {
        id: "asi_ambiguous",
        kicker: `${date.label} — THE THRESHOLD`,
        title: "You got there. Nobody can tell you what you got.",
        color: "power",
        body: [
          `Capability ${s.deployedCap.toFixed(1)} shipped in ${date.label}, ahead of the other named labs. You funded ${align} of six alignment pillars — enough to know roughly what you are looking at, not enough to know what you are looking at.`,
          hasMissingPillars(s)
            ? "Oversight or containment was not in place at deployment. The tests you have were designed by people less capable than the system."
            : "The system passes every test you designed. The tests were designed by people less capable than the system.",
          `Net worth ${money(nw)}; founder paper ${money(founderPaper(s, d))}. Both numbers are, at this point, roughly equally meaningful.`,
          "The quarter ends. The next one begins. The world does not resolve into a good outcome or a bad one on any schedule that fits inside a game.",
        ],
      };
    case "asi_bad":
      return {
        id: "asi_bad",
        kicker: `${date.label} — THE THRESHOLD`,
        title: "You won the race",
        color: "risk",
        body: [
          `You shipped at a hazard index of ${s.risk.toFixed(0)} with ${align} of six alignment pillars, after ${s.incidents} incidents, in ${date.label}.`,
          `The final run was scheduled against a competitor's announcement rather than against a readiness criterion.`,
          `You are worth ${money(nw)} — large, and not automatically the largest fortune that has ever existed — and you are, for the first time since 2012, not the most capable actor in your own building.`,
        ],
      };
    case "china":
      return {
        id: "china",
        kicker: `${date.label} — OVERTAKEN`,
        title: "The lag closed",
        color: "abroad",
        body: [
          `It was announced in a technical report in ${date.label}, in the flat register these things always use, and the capability claims were verifiable within a week.`,
          `The lag was ${s.exportControls ? "widened by your export controls and closed anyway" : "never widened, because you never spent a quarter on it"}. Independent work plus ${s.espionageEvents} leakage events from actual releases — not from a lab that was far behind and had shipped nothing.`,
          `You are worth ${money(nw)} and it is now a fact about a company that sells a service, in a world whose most capable system was built by someone with a different set of objectives.`,
        ],
      };
    case "rival":
      return {
        id: "rival",
        kicker: `${date.label} — OVERTAKEN`,
        title: rival ? `${rival.name} crossed first` : "Someone else shipped it",
        color: "abroad",
        body: [
          `${rival?.name ?? "A domestic lab"} deployed past 90 in ${date.label} while you were still at research ${d.researchCap.toFixed(1)} / deployed ${s.deployedCap.toFixed(1)}.`,
          rival?.id === "helios"
            ? "They did what the blurb said they would do: they bought the compute and shipped the run."
            : rival?.id === "aegis"
              ? "They were slower by policy until they were not. A safety lab that reaches the threshold first is a different political fact than a scaler doing it."
              : rival?.id === "commons"
                ? "They published it. The price of the tier is now zero, and the system is in the world."
                : "Distribution got there with a model good enough and a channel that was already everywhere.",
          `You are worth ${money(nw)}. The race had more than one named contender; the original version of this game forgot to check.`,
        ],
      };
    case "insolvent":
      return {
        id: "insolvent",
        kicker: `${date.label} — INSOLVENT`,
        title: "The burn outran the raise",
        color: "risk",
        body: [
          `Datacenter capex precedes revenue by years, and in ${date.label} you ran out of runway inside the gap. There was no silent overdraft.`,
          `The assets are real — ${num(s.chips)} accelerators and ${mw(s.mwSecured)} — and they will be bought by someone at a discount. Debt on the books: ${money(s.debt.principal)}.`,
          s.emergencyRaises > 0
            ? `You had already used emergency financing ${s.emergencyRaises} time(s). It does not loop.`
            : "You should have raised earlier. Almost everyone should have raised earlier.",
        ],
      };
    default:
      return {
        id: "timeout",
        kicker: `Q4 2030 — THE DECADE ENDS`,
        title: "The calendar ran out",
        color: "dim",
        body: [
          `No threshold, no trillion. Research capability ${d.researchCap.toFixed(1)} against a frontier of ${d.frontier.toFixed(1)}, deployed ${s.deployedCap.toFixed(1)}, personal net worth ${money(nw)}. Q4 2030 was played.`,
          lead
            ? "You held the research frontier to the end. Everything is in front of you and the compounding has not stopped — the calendar just ran out, which is not the same as losing."
            : "You did not hold the frontier at the end, and in this industry the gap between first and third is not a ranking, it is a difference in what you are allowed to charge.",
          `Longest bottleneck: ${s.longestBottleneck.kind} for ${s.longestBottleneck.quarters} quarters. Idle-chip quarters: ${s.idleChipQuarters}.`,
        ],
      };
  }
}

/** Your research capability at the end of the record (Q2 2026) minus the estimated real frontier at that date. */
export function vsRecordAt(s: GameState) {
  const tEnd = REAL_HISTORY_ENDS;
  const point = s.history.find((h) => h.t === tEnd) ?? s.history[s.history.length - 1];
  const rec = HISTORICAL_FRONTIER.find((h) => h.at === "2026Q2")?.cap ?? 81;
  if (!point) return null;
  return { t: point.t, you: point.cap, record: rec, delta: point.cap - rec };
}

export type WorldOutcome = {
  label: "STABLE" | "CONTESTED" | "PRECARIOUS" | "UNCONTROLLED";
  color: "chip" | "power" | "risk" | "abroad";
  score: number;
  lines: string[];
};

/**
 * What the world got, scored separately from whether you won.
 * A capital victory with three incidents and a two-point lag abroad is a different world
 * than the same victory with six pillars and a wide margin. The endings are deliberately
 * unresolved about you; this is the part that is not about you.
 */
export function worldOutcome(s: GameState): WorldOutcome {
  const d = derive(s);
  const align = alignScore(s);
  const rec = s.crossing;
  const crossedBy = rec?.winner
    ? rec.winner === "china"
      ? "china"
      : rec.winner === "player"
        ? "player"
        : "rival"
    : s.over === "china"
      ? "china"
      : s.over === "rival"
        ? "rival"
        : s.over?.startsWith("asi")
          ? "player"
          : null;
  const top = Math.max(d.researchCap, s.deployedCap, s.chinaCap, ...s.rivals.map((r) => r.deployedCap));
  const lagAbroad = Math.max(0, top - s.chinaCap);
  const hazard = rec?.hazardAtOps ?? s.risk;
  const lines: string[] = [];
  let score = 50;

  if (crossedBy === "player") {
    score += align * 6 - s.incidents * 5 - Math.max(0, hazard - 40) * 0.5;
    const highest = !rec || rec.winnerCap >= Math.max(...(rec.contenders.map((c) => c.cap)), rec.winnerCap);
    lines.push(
      highest
        ? `The most capable deployed system in the scenario was yours, with ${align} of six alignment pillars and a hazard index of ${hazard.toFixed(0)} at the moment of the crossing.`
        : `Precedence awarded you the crossing at hazard ${hazard.toFixed(0)} with ${align} of six alignment pillars. A higher-capability contender was ineligible or not first under the documented rule.`,
    );
  } else if (crossedBy === "rival") {
    const r = s.rivals.find((x) => x.id === (rec?.winner ?? s.overActor));
    const safe = r?.id === "aegis";
    score += safe ? 18 : -14;
    const capNote = rec && rec.contenders.some((c) => c.cap > (rec.winnerCap ?? 0))
      ? "Precedence, not raw capability, selected this lab."
      : "It holds the most capable deployed system in the scenario.";
    lines.push(`${r?.name ?? "A domestic lab"} crossed first. ${safe ? "It is the lab that evaluates before it ships, which is the best version of losing." : "It is the lab that ships the moment a run finishes."} ${capNote}`);
  } else if (crossedBy === "china") {
    score -= 28;
    const playerHigher = rec?.contenders.some((c) => c.id === "player" && c.cap > (rec.winnerCap ?? 0));
    lines.push(
      playerHigher
        ? "Same-quarter precedence awarded the crossing to the state programme, which publishes technical reports and nothing else. A higher-capability system was in the room."
        : "The most capable deployed system in the scenario belongs to a state programme that publishes technical reports and nothing else.",
    );
  } else {
    score += Math.min(12, align * 2) - s.incidents * 3;
    lines.push(`Nobody crossed. The frontier ends at ${top.toFixed(1)}, held ${d.researchCap >= top - 0.05 ? "by you" : "by someone else"}, with ${align} of six pillars funded on your side.`);
  }

  if (lagAbroad < 3) {
    score -= 12;
    lines.push(`The programme abroad sits ${lagAbroad.toFixed(1)} points behind the top. Whatever restraint the leader exercises is optional for the follower.`);
  } else if (lagAbroad > 8) {
    score += 8;
    lines.push(`The lag abroad is ${lagAbroad.toFixed(1)} points — wide enough that the leader's choices, not the follower's, set the pace.`);
  } else {
    lines.push(`The lag abroad is ${lagAbroad.toFixed(1)} points.`);
  }

  score += (s.trust - 50) * 0.25 - Math.max(0, s.reg - 40) * 0.2;
  if (s.incidents >= 3) lines.push(`${s.incidents} incidents on your record. Each one cost the whole sector some of its room to move.`);
  if (s.talentFlow < -20) lines.push(`${Math.abs(s.talentFlow)} of your researchers left over the run. Where they went is where the next result comes from.`);
  if (s.papers.filter((p) => p.diffused).length >= 6) lines.push(`${s.papers.filter((p) => p.diffused).length} of your results are now everyone's. That is how a field advances, and how a follower does.`);

  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 70 ? "STABLE" : score >= 50 ? "CONTESTED" : score >= 30 ? "PRECARIOUS" : "UNCONTROLLED";
  const color = label === "STABLE" ? "chip" : label === "CONTESTED" ? "power" : label === "PRECARIOUS" ? "abroad" : "risk";
  return { label, color, score, lines };
}

function hasMissingPillars(s: GameState) {
  return !s.tech.includes("oversight") || !s.tech.includes("control");
}

export function debriefFacts(s: GameState) {
  const d = derive(s);
  return {
    date: dateOf(Math.min(s.t, 72)).label,
    nw: netWorthOf(s, d),
    paper: founderPaper(s, d),
    val: valuationOf(s, d),
    ownership: s.ownership,
    raises: s.raises,
    researchCap: d.researchCap,
    deployed: s.deployedCap,
    frontier: d.frontier,
    cumEff: s.cumEff,
    chips: s.chips,
    mw: s.mwSecured,
    align: alignScore(s),
    incidents: s.incidents,
    china: s.chinaCap,
    leaks: s.espionageEvents,
    longestBottleneck: s.longestBottleneck,
    idleChipQuarters: s.idleChipQuarters,
    background: s.background,
    ventures: s.ventures.length,
    tech: s.tech.length,
    talentFlow: s.talentFlow,
    roster: PEOPLE.filter((p) => s.people[p.id]?.where === "you").map((p) => p.name),
    vsRecord: vsRecordAt(s),
    diffused: s.papers.filter((p) => p.diffused).length,
    seed: s.seed,
    crossingReason: s.crossing?.reason ?? null,
    hazardAtCrossing: s.crossing?.hazardAtOps ?? null,
  };
}
