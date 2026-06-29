/**
 * Phase engine — global clock singleton.
 *
 * The single source of truth for scene time. Every scene's geometry and
 * every audio trigger derives its position from `engineClock.t()`. Nothing
 * else in the engine is permitted to maintain its own incrementing clock.
 *
 * Time integration model
 * ----------------------
 * - A monotonic raw timeline `R` is read from `performance.now()` (ms → s).
 * - Scene time `t` integrates `dR * speed` while not paused, so `speed`
 *   changes never produce a discontinuity in `t`.
 * - `resetPhaseZero()` records the current `t` as the new origin; scenes
 *   then read `t = 0` and snap every node to its trigger position — the
 *   universal "Big Bang" chord.
 *
 * The audio scheduler (Step 5) will additionally translate between scene
 * time and `AudioContext.currentTime` via `sceneToAudioTime` /
 * `audioToSceneTime`. Until that lands, those helpers still answer
 * correctly for "right now" callers.
 */

let audioCtx: AudioContext | null = null;
let speed = 1;
/**
 * Default to paused so the scene rests in its Big Bang formation until the
 * user clicks Play. Nothing moves, nothing fires.
 */
let paused = true;

/** Last raw timeline sample, seconds (from performance.now() / 1000). */
let lastRaw = nowRaw();
/** Accumulated scene time, seconds, BEFORE phase-zero offset. */
let accumulated = 0;
/** Scene-time value of the most recent Phase Zero reset. */
let phaseZeroAt = 0;

function nowRaw(): number {
  if (typeof performance !== "undefined") return performance.now() / 1000;
  return Date.now() / 1000;
}

/** Advance the integrator. Safe to call many times per frame (idempotent). */
function tick(): void {
  const now = nowRaw();
  const dRaw = Math.max(0, now - lastRaw);
  lastRaw = now;
  if (!paused) accumulated += dRaw * speed;
}

export const engineClock = {
  /** Attach the audio context once it exists (for audio-time mapping). */
  attachAudio(ctx: AudioContext): void {
    audioCtx = ctx;
  },

  /** Reset raw sampler — call when resuming from a long pause/tab-hide. */
  resync(): void {
    lastRaw = nowRaw();
  },

  pause(): void {
    tick();
    paused = true;
  },

  resume(): void {
    lastRaw = nowRaw();
    paused = false;
  },

  isPaused(): boolean {
    return paused;
  },

  /** Set global speed multiplier (0 .. 2). Continuous in `t`. */
  setSpeed(x: number): void {
    tick();
    speed = Math.max(0, x);
  },

  getSpeed(): number {
    return speed;
  },

  /**
   * Snap origin to "now". Every scene's `sample(t = 0)` returns nodes at
   * their trigger positions, and the scheduler emits the Big Bang chord.
   */
  resetPhaseZero(): void {
    tick();
    phaseZeroAt = accumulated;
  },

  /** Scene time in seconds, monotonic, modulated by `speed`. */
  t(): number {
    tick();
    return accumulated - phaseZeroAt;
  },

  /** Convert a future scene-time value to an `AudioContext.currentTime`. */
  sceneToAudioTime(sceneT: number): number {
    const now = engineClock.t();
    const audioNow = audioCtx ? audioCtx.currentTime : 0;
    // Audio clock advances in real seconds; scene-time advances at `speed`.
    // For "right now" (sceneT ≈ now) this collapses to audioNow.
    const dScene = sceneT - now;
    const dAudio = speed > 0 ? dScene / speed : dScene;
    return audioNow + dAudio;
  },

  audioToSceneTime(audioT: number): number {
    const audioNow = audioCtx ? audioCtx.currentTime : 0;
    const dAudio = audioT - audioNow;
    return engineClock.t() + dAudio * speed;
  },
};