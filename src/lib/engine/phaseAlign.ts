/**
 * Phase-Alignment macro-cycle rule — canonical rhythm law.
 *
 * The single mathematical rule every trigger engine obeys. For a scene
 * with `N` active notes, base laps `B`, macro-cycle duration `D`
 * seconds:
 *
 *   laps_i     = B + i                    // i-th note's laps per cycle
 *   progress_i = ((t mod D) / D) * laps_i mod 1
 *   trigger_i  when progress_i wraps from → 0
 *
 * At `t = k·D` for any integer k, every `progress_i = 0` simultaneously
 * — every note fires on the same frame, the emergent "Big Bang" chord.
 * Between boundaries the notes phase into complex polyrhythm and snap
 * back to unison. This is not an approximation; it is exact because
 * every `laps_i` is an integer.
 *
 * Contract for engine authors:
 *   - Cadence MUST derive from `crossings(i, B, D, t0, t1)`.
 *   - Positions MUST derive from `progress(t, i, B, D)`.
 *   - No per-voice cooldowns, no `Math.random()`, no velocity from
 *     geometry length (which would desync integer laps).
 *
 * Pure module; no engineClock coupling. Callers pass scene-time in.
 */

export function lapsFor(i: number, B: number): number {
  return Math.max(1, Math.floor(B) + Math.max(0, Math.floor(i)));
}

/**
 * Normalized progress ∈ [0, 1) for voice `i` at scene-time `t`.
 * `t = 0` → 0 (Big Bang anchor). Wraps at every trigger.
 */
export function progress(t: number, i: number, B: number, D: number): number {
  if (D <= 0) return 0;
  const laps = lapsFor(i, B);
  const tt = ((t % D) + D) % D;
  const raw = (tt / D) * laps;
  return raw - Math.floor(raw);
}

/**
 * Enumerate every trigger scene-time for voice `i` in `[t0, t1)`, in
 * ascending order. Handles multiple wraps per window for fast notes.
 *
 * Wraps occur at `t = k / speed` for integer `k ≥ 0`, where
 * `speed = laps / D`. Includes `t = 0` so the first play-frame emits
 * the Big Bang chord.
 */
export function crossings(
  i: number,
  B: number,
  D: number,
  t0: number,
  t1: number,
  out?: number[],
): number[] {
  const arr = out ?? [];
  if (D <= 0 || t1 <= t0) return arr;
  const laps = lapsFor(i, B);
  const speed = laps / D; // laps per second
  const u0 = t0 * speed;
  const u1 = t1 * speed;
  const kLo = Math.ceil(u0);
  const kHi = Math.floor(u1);
  for (let k = kLo; k <= kHi; k++) {
    const t = k / speed;
    if (t >= t0 && t < t1) arr.push(t);
  }
  return arr;
}

/**
 * Convenience — turn a cycle spec (`baseLaps`, `macroCycleSeconds`,
 * `noteCount`) into a compact tuple. All engines resolve this from
 * `SceneGlobals` so the shape is identical everywhere.
 */
export type PhaseCycle = { B: number; D: number; N: number };

export function resolveCycle(g: {
  baseLaps?: number;
  macroCycleSeconds?: number;
  noteCount?: number;
}, fallbackN: number): PhaseCycle {
  return {
    B: Math.max(1, Math.floor(g.baseLaps ?? 10)),
    D: Math.max(0.1, g.macroCycleSeconds ?? 30),
    N: Math.max(4, Math.min(24, Math.floor(g.noteCount ?? fallbackN))),
  };
}

/** Scene-time position within the current macro-cycle, in [0, D). */
export function cyclePhase(t: number, D: number): number {
  if (D <= 0) return 0;
  return ((t % D) + D) % D;
}

/** How far through the current macro-cycle we are, in [0, 1). */
export function cycleFraction(t: number, D: number): number {
  return cyclePhase(t, D) / D;
}