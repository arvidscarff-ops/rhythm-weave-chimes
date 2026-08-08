/**
 * Tiny injectable seeded randomness for SYS-010.
 *
 * Same philosophy as SYS-007's `timeSource`: one small boundary so scheduling
 * logic never touches `Math.random()` and tests are exactly reproducible.
 */

export type RandomSource = () => number;

/** FNV-1a style string hash → 32-bit seed. */
export function hashSeed(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, sufficient for prototype reproducibility. */
export function createSeededRandom(seed: number | string): RandomSource {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Stable per-decision value derived from (seed, key) rather than drawn from a
 * mutable stream. This is what makes admission independent of how often
 * `update()` is called: a roll is a pure function of the decision's identity,
 * so re-asking the same question always yields the same answer.
 */
export function stableUnitRoll(seed: string, key: string): number {
  return createSeededRandom(`${seed}::${key}`)();
}
