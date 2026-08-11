/**
 * SYS-007 — pure finite crossing lifecycle authority.
 *
 * The runtime consumes freeze-aware active journey time supplied by its caller.
 * It owns no clock, pause policy, browser lifecycle, loop, musical state, audio,
 * movement, rendering, or hidden side-effect emitter.
 */

export const CROSSING_RUNTIME_SNAPSHOT_VERSION = 1 as const;

export type CrossingPhase = "idle" | "launching" | "in_transit" | "approaching" | "arrived";

export type CrossingPhaseThresholds = Readonly<{
  /** End of launching; must be greater than zero. */
  launchUntil: number;
  /** Beginning of approach; must be after launchUntil and before arrival. */
  approachFrom: number;
  /** Route arrival boundary. Production First Crossing requires exactly 1. */
  arriveAt: 1;
}>;

/** Existing prototype values retained as explicit test/dev input, not product canon. */
export const PROVISIONAL_CROSSING_THRESHOLDS: CrossingPhaseThresholds = Object.freeze({
  launchUntil: 0.05,
  approachFrom: 0.9,
  arriveAt: 1,
});

export type CrossingRuntimeConfig = Readonly<{
  runId: string;
  routeDefinitionId: string;
  durationSeconds: number;
  thresholds: CrossingPhaseThresholds;
}>;

export type FrozenCrossingRuntimeConfig = Readonly<{
  runId: string;
  routeDefinitionId: string;
  durationSeconds: number;
  thresholds: CrossingPhaseThresholds;
}>;

export type CrossingTransitionId =
  "launch_started" | "transit_started" | "approach_started" | "arrived";

export type CrossingTransition = Readonly<{
  id: CrossingTransitionId;
  from: CrossingPhase;
  to: Exclude<CrossingPhase, "idle">;
  atProgress: number;
}>;

export type CrossingRuntimeSnapshotV1 = Readonly<{
  schemaVersion: typeof CROSSING_RUNTIME_SNAPSHOT_VERSION;
  config: FrozenCrossingRuntimeConfig;
  started: boolean;
  phase: CrossingPhase;
  elapsedSeconds: number;
  progress: number;
  arrived: boolean;
  consumedTransitionIds: readonly CrossingTransitionId[];
}>;

export type CrossingSampleResult = Readonly<{
  snapshot: CrossingRuntimeSnapshotV1;
  transitions: readonly CrossingTransition[];
}>;

export type CrossingRuntime = Readonly<{
  readonly config: FrozenCrossingRuntimeConfig;
  start(): CrossingSampleResult;
  sample(activeElapsedSeconds: number): CrossingSampleResult;
  peek(): CrossingRuntimeSnapshotV1;
  snapshot(): CrossingRuntimeSnapshotV1;
}>;

export type CrossingIdentityExpectation = Readonly<{
  runId: string;
  routeDefinitionId: string;
}>;

type MutableLifecycle = {
  started: boolean;
  phase: CrossingPhase;
  elapsedSeconds: number;
  arrived: boolean;
  consumedTransitionIds: CrossingTransitionId[];
};

function assertIdentifier(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Crossing runtime ${field} must be a non-empty string.`);
  }
}

function assertFiniteNonNegative(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Crossing runtime ${field} must be a finite non-negative number.`);
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Crossing runtime ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function freezeThresholds(source: CrossingPhaseThresholds): CrossingPhaseThresholds {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new Error("Crossing runtime thresholds must be supplied as an object.");
  }
  const { launchUntil, approachFrom, arriveAt } = source;
  if (
    !Number.isFinite(launchUntil) ||
    !Number.isFinite(approachFrom) ||
    !Number.isFinite(arriveAt)
  ) {
    throw new Error("Crossing runtime thresholds must all be finite.");
  }
  if (!(launchUntil > 0 && launchUntil < approachFrom && approachFrom < arriveAt)) {
    throw new Error(
      "Crossing runtime thresholds must satisfy 0 < launchUntil < approachFrom < arriveAt.",
    );
  }
  if (arriveAt !== 1) {
    throw new Error("Crossing runtime arriveAt must equal normalized route completion 1.");
  }
  return Object.freeze({ launchUntil, approachFrom, arriveAt });
}

function freezeConfig(source: CrossingRuntimeConfig): FrozenCrossingRuntimeConfig {
  assertIdentifier(source.runId, "runId");
  assertIdentifier(source.routeDefinitionId, "routeDefinitionId");
  if (!Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0) {
    throw new Error("Crossing runtime durationSeconds must be finite and greater than zero.");
  }
  return Object.freeze({
    runId: source.runId,
    routeDefinitionId: source.routeDefinitionId,
    durationSeconds: source.durationSeconds,
    thresholds: freezeThresholds(source.thresholds),
  });
}

function progressFor(elapsedSeconds: number, durationSeconds: number): number {
  return Math.min(elapsedSeconds / durationSeconds, 1);
}

export function phaseForProgress(
  progress: number,
  thresholds: CrossingPhaseThresholds,
): Exclude<CrossingPhase, "idle"> {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new Error("Crossing progress must be finite and within [0, 1].");
  }
  if (progress >= thresholds.arriveAt) return "arrived";
  if (progress >= thresholds.approachFrom) return "approaching";
  if (progress >= thresholds.launchUntil) return "in_transit";
  return "launching";
}

function transitionFor(
  id: CrossingTransitionId,
  thresholds: CrossingPhaseThresholds,
): CrossingTransition {
  switch (id) {
    case "launch_started":
      return Object.freeze({ id, from: "idle", to: "launching", atProgress: 0 });
    case "transit_started":
      return Object.freeze({
        id,
        from: "launching",
        to: "in_transit",
        atProgress: thresholds.launchUntil,
      });
    case "approach_started":
      return Object.freeze({
        id,
        from: "in_transit",
        to: "approaching",
        atProgress: thresholds.approachFrom,
      });
    case "arrived":
      return Object.freeze({
        id,
        from: "approaching",
        to: "arrived",
        atProgress: thresholds.arriveAt,
      });
  }
}

function requiredTransitionIds(
  started: boolean,
  progress: number,
  thresholds: CrossingPhaseThresholds,
): CrossingTransitionId[] {
  if (!started) return [];
  const ids: CrossingTransitionId[] = ["launch_started"];
  if (progress >= thresholds.launchUntil) ids.push("transit_started");
  if (progress >= thresholds.approachFrom) ids.push("approach_started");
  if (progress >= thresholds.arriveAt) ids.push("arrived");
  return ids;
}

function phaseFromConsumed(ids: readonly CrossingTransitionId[]): CrossingPhase {
  const last = ids.at(-1);
  switch (last) {
    case "launch_started":
      return "launching";
    case "transit_started":
      return "in_transit";
    case "approach_started":
      return "approaching";
    case "arrived":
      return "arrived";
    default:
      return "idle";
  }
}

function sameTransitionIds(a: readonly unknown[], b: readonly CrossingTransitionId[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function createRuntime(
  sourceConfig: CrossingRuntimeConfig,
  initialLifecycle: MutableLifecycle,
): CrossingRuntime {
  const config = freezeConfig(sourceConfig);
  const lifecycle: MutableLifecycle = {
    ...initialLifecycle,
    consumedTransitionIds: [...initialLifecycle.consumedTransitionIds],
  };

  function currentSnapshot(): CrossingRuntimeSnapshotV1 {
    const progress = progressFor(lifecycle.elapsedSeconds, config.durationSeconds);
    return Object.freeze({
      schemaVersion: CROSSING_RUNTIME_SNAPSHOT_VERSION,
      config,
      started: lifecycle.started,
      phase: lifecycle.phase,
      elapsedSeconds: lifecycle.elapsedSeconds,
      progress,
      arrived: lifecycle.arrived,
      consumedTransitionIds: Object.freeze([...lifecycle.consumedTransitionIds]),
    });
  }

  function result(transitions: CrossingTransition[]): CrossingSampleResult {
    return Object.freeze({
      snapshot: currentSnapshot(),
      transitions: Object.freeze(transitions),
    });
  }

  return Object.freeze({
    config,

    start(): CrossingSampleResult {
      if (lifecycle.started) {
        throw new Error("Crossing runtime cannot start an already-started run.");
      }
      lifecycle.started = true;
      lifecycle.phase = "launching";
      lifecycle.consumedTransitionIds.push("launch_started");
      return result([transitionFor("launch_started", config.thresholds)]);
    },

    sample(activeElapsedSeconds: number): CrossingSampleResult {
      if (!lifecycle.started) {
        throw new Error("Crossing runtime must start before it can be sampled.");
      }
      assertFiniteNonNegative(activeElapsedSeconds, "activeElapsedSeconds");
      const nextElapsed = Math.min(activeElapsedSeconds, config.durationSeconds);
      if (nextElapsed < lifecycle.elapsedSeconds) {
        throw new Error("Crossing runtime activeElapsedSeconds cannot regress.");
      }

      lifecycle.elapsedSeconds = nextElapsed;
      const progress = progressFor(nextElapsed, config.durationSeconds);
      const requiredIds = requiredTransitionIds(true, progress, config.thresholds);
      const transitions: CrossingTransition[] = [];

      for (const id of requiredIds) {
        if (!lifecycle.consumedTransitionIds.includes(id)) {
          lifecycle.consumedTransitionIds.push(id);
          transitions.push(transitionFor(id, config.thresholds));
        }
      }

      lifecycle.phase = phaseFromConsumed(lifecycle.consumedTransitionIds);
      lifecycle.arrived = lifecycle.consumedTransitionIds.includes("arrived");
      return result(transitions);
    },

    peek: currentSnapshot,
    snapshot: currentSnapshot,
  });
}

export function createCrossingRuntime(config: CrossingRuntimeConfig): CrossingRuntime {
  return createRuntime(config, {
    started: false,
    phase: "idle",
    elapsedSeconds: 0,
    arrived: false,
    consumedTransitionIds: [],
  });
}

function validateSnapshot(
  snapshot: unknown,
  expectedIdentity?: CrossingIdentityExpectation,
): { config: FrozenCrossingRuntimeConfig; lifecycle: MutableLifecycle } {
  const root = asRecord(snapshot, "snapshot");
  if (root.schemaVersion !== CROSSING_RUNTIME_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported crossing runtime snapshot version: ${String(root.schemaVersion)}.`,
    );
  }

  const configRecord = asRecord(root.config, "snapshot.config");
  const thresholdsRecord = asRecord(configRecord.thresholds, "snapshot.config.thresholds");
  const config = freezeConfig({
    runId: configRecord.runId as string,
    routeDefinitionId: configRecord.routeDefinitionId as string,
    durationSeconds: configRecord.durationSeconds as number,
    thresholds: {
      launchUntil: thresholdsRecord.launchUntil as number,
      approachFrom: thresholdsRecord.approachFrom as number,
      arriveAt: thresholdsRecord.arriveAt as 1,
    },
  });

  if (
    expectedIdentity &&
    (config.runId !== expectedIdentity.runId ||
      config.routeDefinitionId !== expectedIdentity.routeDefinitionId)
  ) {
    throw new Error(
      "Crossing runtime snapshot identity does not match the expected run and route.",
    );
  }

  if (typeof root.started !== "boolean" || typeof root.arrived !== "boolean") {
    throw new Error("Crossing runtime snapshot lifecycle flags must be boolean.");
  }
  assertFiniteNonNegative(root.elapsedSeconds, "snapshot.elapsedSeconds");
  if (root.elapsedSeconds > config.durationSeconds) {
    throw new Error("Crossing runtime snapshot elapsedSeconds cannot exceed durationSeconds.");
  }
  if (!Array.isArray(root.consumedTransitionIds)) {
    throw new Error("Crossing runtime snapshot consumedTransitionIds must be an array.");
  }

  const progress = progressFor(root.elapsedSeconds, config.durationSeconds);
  const expectedIds = requiredTransitionIds(root.started, progress, config.thresholds);
  const expectedPhase: CrossingPhase = phaseFromConsumed(expectedIds);
  const expectedArrived = expectedPhase === "arrived";

  if (root.progress !== progress) {
    throw new Error("Crossing runtime snapshot progress is inconsistent with elapsed time.");
  }
  if (root.phase !== expectedPhase || root.arrived !== expectedArrived) {
    throw new Error("Crossing runtime snapshot phase or arrival latch is inconsistent.");
  }
  if (!sameTransitionIds(root.consumedTransitionIds, expectedIds)) {
    throw new Error("Crossing runtime snapshot consumed transitions are inconsistent.");
  }

  return {
    config,
    lifecycle: {
      started: root.started,
      phase: expectedPhase,
      elapsedSeconds: root.elapsedSeconds,
      arrived: expectedArrived,
      consumedTransitionIds: expectedIds,
    },
  };
}

export function hydrateCrossingRuntime(
  snapshot: unknown,
  expectedIdentity?: CrossingIdentityExpectation,
): CrossingRuntime {
  const validated = validateSnapshot(snapshot, expectedIdentity);
  return createRuntime(validated.config, validated.lifecycle);
}
