/**
 * Phase engine — Prime-Ratio + Golden-Phi velocity distribution.
 *
 * Single source of truth for how every scene assigns per-note speed
 * coefficients and phase offsets. Replaces ad-hoc linear / Fibonacci
 * ratios across the engine so notes never share a rational period —
 * they phase out of unison the instant the t=0 Big Bang chord releases.
 *
 * Contract:
 *   - `speedCoeffs(N)`  → length-N array of unique coefficients in (0, 1],
 *      max == 1 so the caller's `BaseSpeed` keeps its meaning.
 *   - `phaseOffsets(N)` → length-N array in [0, 1), golden-ratio spaced.
 *   - `pathNormalizedSpeed(coeff, baseSpeed, pathLen)` → velocity in
 *      path-units/sec that makes a full traversal take
 *      `1 / (baseSpeed * coeff)` scene-seconds — the polyrhythmic ratio,
 *      not the geometry, sets the ignition cadence.
 *
 * All functions are pure and deterministic in `N`.
 */

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37] as const;
export const PHI = (1 + Math.sqrt(5)) / 2;
const INV_PHI_COMPLEMENT = 1 - 1 / PHI; // ≈ 0.381966 — 1-D golden angle.

/**
 * Per-note speed coefficients. Each note `i` gets `PRIMES[i % len] /
 * PRIMES[len-1]`, optionally jittered by a φ term so wrapping past
 * `PRIMES.length` still yields unique, irrational-ish values. The set
 * is then normalized so the max coefficient == 1.
 */
export function speedCoeffs(N: number): number[] {
  if (N <= 0) return [];
  const maxPrime = PRIMES[PRIMES.length - 1];
  const raw: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const p = PRIMES[i % PRIMES.length];
    const base = p / maxPrime;
    // φ-jitter ∈ (-0.035, +0.035) — small enough not to reorder primes
    // within the first lap, large enough to disambiguate wraps.
    const j = ((i * PHI) % 1) - 0.5;
    raw[i] = base * (1 + j * 0.07);
  }
  let max = -Infinity;
  for (const v of raw) if (v > max) max = v;
  if (max <= 0) return raw;
  return raw.map((v) => v / max);
}

/**
 * Golden-ratio 1-D distribution in [0, 1). Even, non-repeating —
 * guarantees notes traverse a shared shape in a staggered "wave"
 * rather than as a block.
 */
export function phaseOffsets(N: number): number[] {
  const out: number[] = new Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = (i * INV_PHI_COMPLEMENT) % 1;
  }
  return out;
}

/**
 * Convert a polyrhythmic ratio into a path-unit velocity. The intent:
 * a note with coefficient `c` completes one full path traversal every
 * `1 / (baseSpeed * c)` scene-seconds, regardless of `pathLen`. Use this
 * when path lengths vary between notes in the same scene so geometry
 * doesn't dictate cadence.
 */
export function pathNormalizedSpeed(coeff: number, baseSpeed: number, pathLen: number): number {
  return pathLen * baseSpeed * coeff;
}
