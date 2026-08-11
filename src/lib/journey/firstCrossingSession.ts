/**
 * SYS-008 — First Crossing session lifecycle foundation.
 *
 * This module owns finite, freeze-aware JOURNEY time for one crossing run.
 * It intentionally has no knowledge of musical position, Phase Zero, route
 * phases, audio scheduling, rendering, React, or child-system state.
 * `engineClock` remains the separate sole musical transport authority.
 */

export const FIRST_CROSSING_SESSION_SNAPSHOT_VERSION = 1 as const;

export type FirstCrossingSessionStatus =
  "not_started" | "running" | "paused" | "suspended" | "completed";

export type FirstCrossingSessionConfig = Readonly<{
  /** Unique identity for this crossing attempt. Supplied once by the caller. */
  runId: string;
  /** Stable identity of the authored route definition. */
  routeDefinitionId: string;
}>;

export type FirstCrossingSessionLifecycleSnapshot = Readonly<{
  started: boolean;
  completed: boolean;
  explicitlyPaused: boolean;
  backgroundSuspended: boolean;
  /** Active journey seconds only; hidden/paused wall time is never included. */
  activeElapsedSeconds: number;
}>;

export type FirstCrossingSessionSnapshotV1 = Readonly<{
  schemaVersion: typeof FIRST_CROSSING_SESSION_SNAPSHOT_VERSION;
  config: FirstCrossingSessionConfig;
  lifecycle: FirstCrossingSessionLifecycleSnapshot;
}>;

export type FirstCrossingSessionState = Readonly<{
  config: FirstCrossingSessionConfig;
  status: FirstCrossingSessionStatus;
  started: boolean;
  completed: boolean;
  explicitlyPaused: boolean;
  backgroundSuspended: boolean;
  activeElapsedSeconds: number;
}>;

/** Monotonic seconds with no epoch meaning. */
export type FirstCrossingTimeSource = () => number;

export type FirstCrossingSessionDependencies = Readonly<{
  timeSource?: FirstCrossingTimeSource;
}>;

export type FirstCrossingSession = Readonly<{
  readonly config: FirstCrossingSessionConfig;
  start(): FirstCrossingSessionState;
  pause(): FirstCrossingSessionState;
  resume(): FirstCrossingSessionState;
  suspendForBackground(): FirstCrossingSessionState;
  resumeFromBackground(): FirstCrossingSessionState;
  complete(): FirstCrossingSessionState;
  /** Settle active journey time through the supplied monotonic position. */
  sample(): FirstCrossingSessionState;
  /** Settle time and return a deeply immutable, JSON-serializable snapshot. */
  snapshot(): FirstCrossingSessionSnapshotV1;
}>;

type MutableLifecycle = {
  started: boolean;
  completed: boolean;
  explicitlyPaused: boolean;
  backgroundSuspended: boolean;
  activeElapsedSeconds: number;
};

const performanceJourneyTimeSource: FirstCrossingTimeSource = () => {
  if (typeof performance === "undefined") {
    throw new Error("FirstCrossingSession requires an injected monotonic TimeSource.");
  }
  return performance.now() / 1000;
};

function copyConfig(config: FirstCrossingSessionConfig): FirstCrossingSessionConfig {
  assertIdentifier(config.runId, "runId");
  assertIdentifier(config.routeDefinitionId, "routeDefinitionId");
  return Object.freeze({
    runId: config.runId,
    routeDefinitionId: config.routeDefinitionId,
  });
}

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`FirstCrossingSession ${field} must be a non-empty string.`);
  }
}

function assertBoolean(value: unknown, field: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    throw new Error(`FirstCrossingSession ${field} must be boolean.`);
  }
}

function assertElapsed(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(
      "FirstCrossingSession activeElapsedSeconds must be a finite non-negative number.",
    );
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`FirstCrossingSession ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function validateSnapshot(snapshot: unknown): {
  config: FirstCrossingSessionConfig;
  lifecycle: MutableLifecycle;
} {
  const root = asRecord(snapshot, "snapshot");
  if (root.schemaVersion !== FIRST_CROSSING_SESSION_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported FirstCrossingSession snapshot version: ${String(root.schemaVersion)}.`,
    );
  }

  const configRecord = asRecord(root.config, "snapshot.config");
  const config = copyConfig({
    runId: configRecord.runId as string,
    routeDefinitionId: configRecord.routeDefinitionId as string,
  });

  const lifecycleRecord = asRecord(root.lifecycle, "snapshot.lifecycle");
  assertBoolean(lifecycleRecord.started, "snapshot.lifecycle.started");
  assertBoolean(lifecycleRecord.completed, "snapshot.lifecycle.completed");
  assertBoolean(lifecycleRecord.explicitlyPaused, "snapshot.lifecycle.explicitlyPaused");
  assertBoolean(lifecycleRecord.backgroundSuspended, "snapshot.lifecycle.backgroundSuspended");
  assertElapsed(lifecycleRecord.activeElapsedSeconds);

  if (lifecycleRecord.completed && !lifecycleRecord.started) {
    throw new Error("A completed FirstCrossingSession snapshot must also be started.");
  }
  if (
    lifecycleRecord.completed &&
    (lifecycleRecord.explicitlyPaused || lifecycleRecord.backgroundSuspended)
  ) {
    throw new Error("A completed FirstCrossingSession snapshot cannot retain freeze gates.");
  }
  if (!lifecycleRecord.started && lifecycleRecord.activeElapsedSeconds !== 0) {
    throw new Error("A not-started FirstCrossingSession snapshot cannot contain active time.");
  }
  if (!lifecycleRecord.started && lifecycleRecord.explicitlyPaused) {
    throw new Error("A not-started FirstCrossingSession snapshot cannot be explicitly paused.");
  }

  return {
    config,
    lifecycle: {
      started: lifecycleRecord.started,
      completed: lifecycleRecord.completed,
      explicitlyPaused: lifecycleRecord.explicitlyPaused,
      backgroundSuspended: lifecycleRecord.backgroundSuspended,
      activeElapsedSeconds: lifecycleRecord.activeElapsedSeconds,
    },
  };
}

function statusFor(lifecycle: MutableLifecycle): FirstCrossingSessionStatus {
  if (lifecycle.completed) return "completed";
  if (!lifecycle.started) return "not_started";
  if (lifecycle.explicitlyPaused) return "paused";
  if (lifecycle.backgroundSuspended) return "suspended";
  return "running";
}

function createSession(
  sourceConfig: FirstCrossingSessionConfig,
  initialLifecycle: MutableLifecycle,
  dependencies: FirstCrossingSessionDependencies,
): FirstCrossingSession {
  const config = copyConfig(sourceConfig);
  const timeSource = dependencies.timeSource ?? performanceJourneyTimeSource;
  const lifecycle: MutableLifecycle = { ...initialLifecycle };

  let lastObservedTimeSeconds: number | null = null;
  let activeSinceSeconds: number | null = null;

  function readMonotonicTime(): number {
    const value = timeSource();
    if (!Number.isFinite(value)) {
      throw new Error("FirstCrossingSession TimeSource must return a finite number.");
    }
    if (lastObservedTimeSeconds !== null && value < lastObservedTimeSeconds) {
      throw new Error("FirstCrossingSession TimeSource must be monotonic.");
    }
    lastObservedTimeSeconds = value;
    return value;
  }

  function isActivelyRunning(): boolean {
    return (
      lifecycle.started &&
      !lifecycle.completed &&
      !lifecycle.explicitlyPaused &&
      !lifecycle.backgroundSuspended
    );
  }

  function beginActiveWindow(): void {
    if (isActivelyRunning() && activeSinceSeconds === null) {
      // This sample is a new baseline. Frozen time before it is not counted.
      activeSinceSeconds = readMonotonicTime();
    }
  }

  function settleActiveTime(keepWindowOpen: boolean): void {
    if (activeSinceSeconds === null) return;
    const now = readMonotonicTime();
    lifecycle.activeElapsedSeconds += now - activeSinceSeconds;
    activeSinceSeconds = keepWindowOpen ? now : null;
  }

  function state(): FirstCrossingSessionState {
    return Object.freeze({
      config,
      status: statusFor(lifecycle),
      started: lifecycle.started,
      completed: lifecycle.completed,
      explicitlyPaused: lifecycle.explicitlyPaused,
      backgroundSuspended: lifecycle.backgroundSuspended,
      activeElapsedSeconds: lifecycle.activeElapsedSeconds,
    });
  }

  function snapshot(): FirstCrossingSessionSnapshotV1 {
    settleActiveTime(true);
    return Object.freeze({
      schemaVersion: FIRST_CROSSING_SESSION_SNAPSHOT_VERSION,
      config,
      lifecycle: Object.freeze({
        started: lifecycle.started,
        completed: lifecycle.completed,
        explicitlyPaused: lifecycle.explicitlyPaused,
        backgroundSuspended: lifecycle.backgroundSuspended,
        activeElapsedSeconds: lifecycle.activeElapsedSeconds,
      }),
    });
  }

  // Hydrating a running session establishes "now" as its new baseline. Time
  // spent away from the application is never inferred from wall-clock data.
  beginActiveWindow();

  return Object.freeze({
    config,

    start(): FirstCrossingSessionState {
      if (lifecycle.started) {
        throw new Error("FirstCrossingSession cannot be started more than once.");
      }
      lifecycle.started = true;
      beginActiveWindow();
      return state();
    },

    pause(): FirstCrossingSessionState {
      if (!lifecycle.started || lifecycle.completed) {
        throw new Error("Only an active FirstCrossingSession can be paused.");
      }
      if (lifecycle.explicitlyPaused) return state();
      settleActiveTime(false);
      lifecycle.explicitlyPaused = true;
      return state();
    },

    resume(): FirstCrossingSessionState {
      if (!lifecycle.started || lifecycle.completed) {
        throw new Error("Only an active FirstCrossingSession can be resumed.");
      }
      if (!lifecycle.explicitlyPaused) return state();
      lifecycle.explicitlyPaused = false;
      beginActiveWindow();
      return state();
    },

    suspendForBackground(): FirstCrossingSessionState {
      if (lifecycle.completed) return state();
      if (lifecycle.backgroundSuspended) return state();
      settleActiveTime(false);
      lifecycle.backgroundSuspended = true;
      return state();
    },

    resumeFromBackground(): FirstCrossingSessionState {
      if (lifecycle.completed) return state();
      if (!lifecycle.backgroundSuspended) return state();
      lifecycle.backgroundSuspended = false;
      beginActiveWindow();
      return state();
    },

    complete(): FirstCrossingSessionState {
      if (!lifecycle.started) {
        throw new Error("A FirstCrossingSession must start before it can complete.");
      }
      if (lifecycle.completed) return state();
      settleActiveTime(false);
      lifecycle.completed = true;
      lifecycle.explicitlyPaused = false;
      lifecycle.backgroundSuspended = false;
      return state();
    },

    sample(): FirstCrossingSessionState {
      settleActiveTime(true);
      return state();
    },

    snapshot,
  });
}

/**
 * Create a new, not-started session. Callers must supply the already-unique
 * run ID; ID generation is deliberately outside lifecycle/reconstruction.
 */
export function createFirstCrossingSession(
  config: FirstCrossingSessionConfig,
  dependencies: FirstCrossingSessionDependencies = {},
): FirstCrossingSession {
  return createSession(
    config,
    {
      started: false,
      completed: false,
      explicitlyPaused: false,
      backgroundSuspended: false,
      activeElapsedSeconds: 0,
    },
    dependencies,
  );
}

/**
 * Hydrate without consulting wall-clock time or generating identity. If the
 * snapshot was running, the injected monotonic "now" becomes a fresh baseline.
 */
export function hydrateFirstCrossingSession(
  snapshot: unknown,
  dependencies: FirstCrossingSessionDependencies = {},
): FirstCrossingSession {
  const validated = validateSnapshot(snapshot);
  return createSession(validated.config, validated.lifecycle, dependencies);
}
