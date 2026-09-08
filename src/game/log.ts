import type { GameState, LogKind } from "./types.ts";

export function pushEvent(
  s: GameState,
  type: LogKind,
  text: string,
  extra?: { actor?: string; delta?: Record<string, number>; t?: number },
) {
  s.eventSeq += 1;
  s.events.push({
    id: s.eventSeq,
    t: extra?.t ?? s.t,
    type,
    actor: extra?.actor,
    text,
    delta: extra?.delta,
  });
}
