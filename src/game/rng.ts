import type { GameState } from "./types.ts";

/** Mulberry32. Advances state.rng and returns [0, 1). */
export function nextRand(s: GameState): number {
  let z = (s.rng + 0x6d2b79f5) >>> 0;
  s.rng = z;
  let t = Math.imul(z ^ (z >>> 15), 1 | z);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) >>> 0;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function chance(s: GameState, p: number) {
  return nextRand(s) < p;
}
