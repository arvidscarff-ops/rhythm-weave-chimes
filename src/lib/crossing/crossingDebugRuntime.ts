/**
 * SYS-007 LEGACY DEBUG ADAPTER.
 *
 * Preserves the original prototype clock, listener, reset, duration mutation,
 * and scrub controls for isolated `/dev/*` comparison surfaces only. It is not
 * the production crossing authority and must not be imported by product code.
 * Production code uses the pure, supplied-time API in `crossingRuntime.ts`.
 */

import { performanceTimeSource, type TimeSource } from "./timeSource";

export type DebugCrossingPhase = "idle" | "launching" | "in_transit" | "approaching" | "arrived";

export type DebugCrossingPhaseThresholds = {
  launchUntil: number;
  approachFrom: number;
  arriveAt: number;
};

export const DEBUG_DEFAULT_THRESHOLDS: DebugCrossingPhaseThresholds = {
  launchUntil: 0.05,
  approachFrom: 0.9,
  arriveAt: 1,
};

export type DebugCrossingState = {
  id: string;
  originId: string;
  destinationId: string;
  phase: DebugCrossingPhase;
  elapsedSeconds: number;
  durationSeconds: number;
  progress: number;
  startedAtMonotonicSeconds: number | null;
  arrivedAtMonotonicSeconds: number | null;
  paused: boolean;
};

export type DebugCrossingListener = {
  crossingStarted?: (state: DebugCrossingState) => void;
  phaseChanged?: (phase: DebugCrossingPhase, state: DebugCrossingState) => void;
  progressChanged?: (progress: number, state: DebugCrossingState) => void;
  crossingArrived?: (state: DebugCrossingState) => void;
};

export type DebugCrossingRuntimeOptions = {
  id: string;
  originId: string;
  destinationId: string;
  durationSeconds: number;
  timeSource?: TimeSource;
  thresholds?: Partial<DebugCrossingPhaseThresholds>;
  progressEpsilon?: number;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

function debugPhaseForProgress(
  progress: number,
  thresholds: DebugCrossingPhaseThresholds,
): Exclude<DebugCrossingPhase, "idle"> {
  if (progress >= thresholds.arriveAt) return "arrived";
  if (progress >= thresholds.approachFrom) return "approaching";
  if (progress < thresholds.launchUntil) return "launching";
  return "in_transit";
}

export function createCrossingDebugRuntime(options: DebugCrossingRuntimeOptions) {
  const time = options.timeSource ?? performanceTimeSource;
  const thresholds = { ...DEBUG_DEFAULT_THRESHOLDS, ...options.thresholds };
  const epsilon = options.progressEpsilon ?? 0.001;
  const listeners = new Set<DebugCrossingListener>();

  let running = false;
  let paused = false;
  let phase: DebugCrossingPhase = "idle";
  let durationSeconds = Math.max(0.001, options.durationSeconds);
  let elapsedSeconds = 0;
  let startedAtMonotonicSeconds: number | null = null;
  let arrivedAtMonotonicSeconds: number | null = null;
  let arrivalEmitted = false;
  let lastTick = 0;
  let lastEmittedProgress = 0;

  function progressNow(): number {
    return clamp01(elapsedSeconds / durationSeconds);
  }

  function snapshot(): DebugCrossingState {
    return Object.freeze({
      id: options.id,
      originId: options.originId,
      destinationId: options.destinationId,
      phase,
      elapsedSeconds,
      durationSeconds,
      progress: progressNow(),
      startedAtMonotonicSeconds,
      arrivedAtMonotonicSeconds,
      paused,
    });
  }

  function emit<K extends keyof DebugCrossingListener>(
    key: K,
    call: (listener: NonNullable<DebugCrossingListener[K]>) => void,
  ) {
    for (const listener of Array.from(listeners)) {
      const handler = listener[key];
      if (handler) call(handler as NonNullable<DebugCrossingListener[K]>);
    }
  }

  function reconcile(): DebugCrossingState {
    if (running && !paused) {
      const now = time();
      const delta = Math.max(0, now - lastTick);
      lastTick = now;
      elapsedSeconds = Math.min(elapsedSeconds + delta, durationSeconds);
    } else {
      lastTick = time();
    }

    const nextPhase = running ? debugPhaseForProgress(progressNow(), thresholds) : phase;
    const arriving = nextPhase === "arrived" && !arrivalEmitted;

    if (arriving) {
      elapsedSeconds = durationSeconds;
      arrivedAtMonotonicSeconds = time();
    }

    const changed = nextPhase !== phase;
    phase = nextPhase;
    const progress = progressNow();
    const state = snapshot();

    if (changed) emit("phaseChanged", (handler) => handler(phase, state));
    if (arriving || Math.abs(progress - lastEmittedProgress) >= epsilon) {
      lastEmittedProgress = progress;
      emit("progressChanged", (handler) => handler(progress, state));
    }
    if (arriving) {
      arrivalEmitted = true;
      emit("crossingArrived", (handler) => handler(state));
    }
    return state;
  }

  return {
    sample: reconcile,
    peek: snapshot,

    start(start?: { durationSeconds?: number }): DebugCrossingState {
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
      phase = debugPhaseForProgress(0, thresholds);
      const state = snapshot();
      emit("crossingStarted", (handler) => handler(state));
      emit("phaseChanged", (handler) => handler(phase, state));
      return state;
    },

    pause(): DebugCrossingState {
      if (running && !paused) {
        reconcile();
        paused = true;
      }
      return snapshot();
    },

    resume(): DebugCrossingState {
      if (running && paused) {
        paused = false;
        lastTick = time();
      }
      return snapshot();
    },

    reset(): DebugCrossingState {
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
      emit("phaseChanged", (handler) => handler(phase, state));
      return state;
    },

    scrubTo(progress: number): DebugCrossingState {
      if (!running) {
        running = true;
        startedAtMonotonicSeconds = time();
      }
      elapsedSeconds = clamp01(progress) * durationSeconds;
      lastTick = time();
      return reconcile();
    },

    setDuration(seconds: number): DebugCrossingState {
      durationSeconds = Math.max(0.001, seconds);
      return reconcile();
    },

    subscribe(listener: DebugCrossingListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get thresholds(): DebugCrossingPhaseThresholds {
      return { ...thresholds };
    },
  };
}

export type CrossingDebugRuntime = ReturnType<typeof createCrossingDebugRuntime>;
