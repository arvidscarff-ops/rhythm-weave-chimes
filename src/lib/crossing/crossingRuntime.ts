/**
 * SYS-007 — First Crossing route runtime (PROTOTYPE).
 *
 * The single authoritative owner of one crossing's journey state:
 *
 *   origin → launch → transit → approach → arrival
 *
 * Architecture notes (intentional, non-obvious):
 * - This is deliberately NOT `engineClock`. Scene time is a wrapped rhythmic
 *   phase authority; a crossing is finite, non-wrapping route progress. Those
 *   are distinct concepts and must not share an authority.
 * - There is exactly ONE progress value. Graphics/audio/HUD/movement must all
 *   consume it; none of them may compute their own.
 * - The runtime owns no rAF loop and no timer. `sample()` pulls the current
 *   time from the injected `TimeSource` and recomputes state; consumers poll
 *   at whatever cadence suits them. Frame rate therefore cannot influence
 *   journey state — only elapsed monotonic time can.
 * - Events are emitted only when a `sample()` (or an explicit command)
 *   detects a material change.
 */

import { performanceTimeSource, type TimeSource } from "./timeSource";

export type CrossingPhase = "idle" | "launching" | "in_transit" | "approaching" | "arrived";

/**
 * Phase boundaries as normalized progress. Prototype defaults only — these are
 * NOT product canon and are parameterized on purpose.
 */
export type CrossingPhaseThresholds = {
  /** progress < launchUntil → "launching" */
  launchUntil: number;
  /** progress >= approachFrom → "approaching" */
  approachFrom: number;
  /** progress >= arriveAt → "arrived" */
  arriveAt: number;
};

export const DEFAULT_THRESHOLDS: CrossingPhaseThresholds = {
  launchUntil: 0.05,
  approachFrom: 0.9,
  arriveAt: 1,
};

/** Immutable snapshot handed to consumers. */
export type CrossingState = {
  id: string;
  originId: string;
  destinationId: string;
  phase: CrossingPhase;
  elapsedSeconds: number;
  durationSeconds: number;
  /** Authoritative normalized journey progress, clamped to [0, 1]. */
  progress: number;
  /**
   * Monotonic runtime seconds from the injected `TimeSource` — NOT an epoch
   * timestamp and NOT persistence-safe. Null until the run starts / arrives.
   */
  startedAtMonotonicSeconds: number | null;
  arrivedAtMonotonicSeconds: number | null;
  paused: boolean;
};

export type CrossingListener = {
  crossingStarted?: (s: CrossingState) => void;
  phaseChanged?: (phase: CrossingPhase, s: CrossingState) => void;
  progressChanged?: (progress: number, s: CrossingState) => void;
  crossingArrived?: (s: CrossingState) => void;
};

export type CrossingRuntimeOptions = {
  id: string;
  originId: string;
  destinationId: string;
  durationSeconds: number;
  timeSource?: TimeSource;
  thresholds?: Partial<CrossingPhaseThresholds>;
  /** Minimum progress delta before `progressChanged` is emitted. */
  progressEpsilon?: number;
};

export type StartOptions = {
  durationSeconds?: number;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

export function phaseForProgress(
  progress: number,
  thresholds: CrossingPhaseThresholds,
): Exclude<CrossingPhase, "idle"> {
  if (progress >= thresholds.arriveAt) return "arrived";
  if (progress >= thresholds.approachFrom) return "approaching";
  if (progress < thresholds.launchUntil) return "launching";
  return "in_transit";
}

export function createCrossingRuntime(opts: CrossingRuntimeOptions) {
  const time: TimeSource = opts.timeSource ?? performanceTimeSource;
  const thresholds: CrossingPhaseThresholds = { ...DEFAULT_THRESHOLDS, ...opts.thresholds };
  const epsilon = opts.progressEpsilon ?? 0.001;

  const listeners = new Set<CrossingListener>();

  let running = false;
  let paused = false;
  let phase: CrossingPhase = "idle";
  let durationSeconds = Math.max(0.001, opts.durationSeconds);
  let elapsedSeconds = 0;
  let startedAtMonotonicSeconds: number | null = null;
  let arrivedAtMonotonicSeconds: number | null = null;
  /** Per-run latch: arrival may be announced exactly once between resets. */
  let arrivalEmitted = false;
  /** Last monotonic reading folded into `elapsedSeconds`. */
  let lastTick = 0;
  let lastEmittedProgress = 0;

  function progressNow(): number {
    return clamp01(elapsedSeconds / durationSeconds);
  }

  function snapshot(): CrossingState {
    return Object.freeze({
      id: opts.id,
      originId: opts.originId,
      destinationId: opts.destinationId,
      phase,
      elapsedSeconds,
      durationSeconds,
      progress: progressNow(),
      startedAtMonotonicSeconds,
      arrivedAtMonotonicSeconds,
      paused,
    });
  }

  function emit<K extends keyof CrossingListener>(
    key: K,
    call: (l: NonNullable<CrossingListener[K]>) => void,
  ) {
    for (const l of Array.from(listeners)) {
      const fn = l[key];
      if (fn) call(fn as NonNullable<CrossingListener[K]>);
    }
  }

  /**
   * Fold elapsed time forward, then reconcile phase/progress and emit any
   * material changes. This is the ONLY place transitions happen, so scrubbing
   * and natural advancement share identical semantics by construction.
   */
  function reconcile(): CrossingState {
    if (running && !paused) {
      const now = time();
      const dt = Math.max(0, now - lastTick);
      lastTick = now;
      elapsedSeconds = Math.min(elapsedSeconds + dt, durationSeconds);
    } else {
      lastTick = time();
    }

    const nextPhase: CrossingPhase = running ? phaseForProgress(progressNow(), thresholds) : phase;
    const arriving = nextPhase === "arrived" && !arrivalEmitted;

    if (arriving) {
      // Arrival pins progress to exactly 1.0 so every consumer observes the
      // terminal value, regardless of sampling cadence.
      elapsedSeconds = durationSeconds;
      arrivedAtMonotonicSeconds = time();
    }

    const phaseChanged = nextPhase !== phase;
    phase = nextPhase;

    const p = progressNow();
    const state = snapshot();

    if (phaseChanged) emit("phaseChanged", (fn) => fn(phase, state));
    // Arrival bypasses epsilon suppression: the final 1.0 is always observable.
    if (arriving || Math.abs(p - lastEmittedProgress) >= epsilon) {
      lastEmittedProgress = p;
      emit("progressChanged", (fn) => fn(p, state));
    }
    if (arriving) {
      arrivalEmitted = true;
      emit("crossingArrived", (fn) => fn(state));
    }
    return state;
  }

  return {
    /** Recompute from the time source and emit material changes. */
    sample(): CrossingState {
      return reconcile();
    },

    /** Read state without advancing time or emitting. */
    peek(): CrossingState {
      return snapshot();
    },

    start(start?: StartOptions): CrossingState {
      if (typeof start?.durationSeconds === "number") {
        durationSeconds = Math.max(0.001, start.durationSeconds);
      }
      running = true;
      paused = false;
      elapsedSeconds = 0;
      arrivalEmitted = false;
      arrivedAtMonotonicSeconds = null;
      lastEmittedProgress = 0;
      lastTick = time();
      startedAtMonotonicSeconds = lastTick;
      phase = phaseForProgress(0, thresholds);
      const state = snapshot();
      emit("crossingStarted", (fn) => fn(state));
      emit("phaseChanged", (fn) => fn(phase, state));
      return state;
    },

    pause(): CrossingState {
      if (running && !paused) {
        reconcile();
        paused = true;
      }
      return snapshot();
    },

    resume(): CrossingState {
      if (running && paused) {
        paused = false;
        lastTick = time();
      }
      return snapshot();
    },

    reset(): CrossingState {
      running = false;
      paused = false;
      phase = "idle";
      elapsedSeconds = 0;
      startedAtMonotonicSeconds = null;
      arrivedAtMonotonicSeconds = null;
      arrivalEmitted = false;
      lastEmittedProgress = 0;
      lastTick = time();
      const state = snapshot();
      emit("phaseChanged", (fn) => fn(phase, state));
      return state;
    },

    /**
     * DEVELOPER-ONLY. Jumps the run to a normalized progress value and then
     * runs the exact same transition logic as natural advancement — so
     * scrubbing to 1.0 produces a genuine `arrived` phase and one
     * `crossingArrived` event. That equivalence is intentional: it keeps the
     * prototype honest about lifecycle behaviour. The arrival latch is
     * per-run, so scrubbing back below the arrival threshold and forward
     * again cannot announce arrival twice; only `start()`/`reset()` re-arms.
     */
    scrubTo(progress: number): CrossingState {
      if (!running) {
        running = true;
        startedAtMonotonicSeconds = time();
      }
      elapsedSeconds = clamp01(progress) * durationSeconds;
      lastTick = time();
      return reconcile();
    },

    setDuration(seconds: number): CrossingState {
      durationSeconds = Math.max(0.001, seconds);
      return reconcile();
    },

    subscribe(listener: CrossingListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get thresholds(): CrossingPhaseThresholds {
      return { ...thresholds };
    },
  };
}

export type CrossingRuntime = ReturnType<typeof createCrossingRuntime>;
