/**
 * SYS-008 — First Crossing journey-side composition root.
 *
 * This coordinator composes one freeze-aware journey lifecycle, finite route
 * progress, deterministic transmissions, and an ephemeral movement delta. It
 * owns no clock of its own and has no knowledge of engineClock, musical time,
 * Phase Zero, audio, rendering, React, or persistent movement state.
 */

import {
  createCrossingRuntime,
  hydrateCrossingRuntime,
  type CrossingPhaseThresholds,
  type CrossingRuntime,
  type CrossingRuntimeSnapshotV1,
  type CrossingTransition,
} from "../crossing/crossingRuntime";
import {
  createTransmissionRuntime,
  hydrateTransmissionRuntime,
  type TransmissionRuntime,
  type TransmissionRuntimeConfig,
  type TransmissionRuntimeSnapshotV1,
} from "../transmissions/transmissionRuntime";
import type { TransmissionRuntimeEvent } from "../transmissions/transmissionTypes";
import {
  createFirstCrossingSession,
  hydrateFirstCrossingSession,
  type FirstCrossingSession,
  type FirstCrossingSessionDependencies,
  type FirstCrossingSessionSnapshotV1,
  type FirstCrossingSessionState,
} from "./firstCrossingSession";

export const FIRST_CROSSING_COORDINATOR_SNAPSHOT_VERSION = 1 as const;

export type FirstCrossingIdentity = Readonly<{
  runId: string;
  routeDefinitionId: string;
}>;

export type FirstCrossingCoordinatorConfig = Readonly<{
  runId: string;
  routeDefinitionId: string;
  durationSeconds: number;
  thresholds: CrossingPhaseThresholds;
  transmissions: Omit<TransmissionRuntimeConfig, "runId" | "routeDefinitionId">;
}>;

export type FirstCrossingCoordinatorDependencies = FirstCrossingSessionDependencies;

export type FirstCrossingCoordinatorSnapshotV1 = Readonly<{
  schemaVersion: typeof FIRST_CROSSING_COORDINATOR_SNAPSHOT_VERSION;
  identity: FirstCrossingIdentity;
  session: FirstCrossingSessionSnapshotV1;
  crossing: CrossingRuntimeSnapshotV1;
  transmissions: TransmissionRuntimeSnapshotV1;
}>;

export type FirstCrossingCoordinatorResult = Readonly<{
  snapshot: FirstCrossingCoordinatorSnapshotV1;
  crossingTransitions: readonly CrossingTransition[];
  transmissionEvents: readonly TransmissionRuntimeEvent[];
  /** Ephemeral active journey delta accepted by the finite route runtime. */
  movementDeltaSeconds: number;
}>;

export type FirstCrossingCoordinator = Readonly<{
  readonly identity: FirstCrossingIdentity;
  start(): FirstCrossingCoordinatorResult;
  sample(): FirstCrossingCoordinatorResult;
  pause(): FirstCrossingCoordinatorResult;
  resume(): FirstCrossingCoordinatorResult;
  suspendForBackground(): FirstCrossingCoordinatorResult;
  resumeFromBackground(): FirstCrossingCoordinatorResult;
  /** Side-effect-free accepted-state snapshot. */
  snapshot(): FirstCrossingCoordinatorSnapshotV1;
}>;

type CoordinatorChildren = Readonly<{
  session: FirstCrossingSession;
  crossing: CrossingRuntime;
  transmissions: TransmissionRuntime;
}>;

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`FirstCrossingCoordinator ${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function freezeIdentity(runId: string, routeDefinitionId: string): FirstCrossingIdentity {
  if (typeof runId !== "string" || runId.trim().length === 0) {
    throw new Error("FirstCrossingCoordinator runId must be a non-empty string.");
  }
  if (typeof routeDefinitionId !== "string" || routeDefinitionId.trim().length === 0) {
    throw new Error("FirstCrossingCoordinator routeDefinitionId must be a non-empty string.");
  }
  return Object.freeze({ runId, routeDefinitionId });
}

function assertIdentity(
  actual: Readonly<{ runId: string; routeDefinitionId: string }>,
  expected: FirstCrossingIdentity,
  owner: string,
): void {
  if (actual.runId !== expected.runId || actual.routeDefinitionId !== expected.routeDefinitionId) {
    throw new Error(`FirstCrossingCoordinator ${owner} identity is inconsistent.`);
  }
}

function assertCoherentChildren(
  identity: FirstCrossingIdentity,
  session: FirstCrossingSessionSnapshotV1,
  crossing: CrossingRuntimeSnapshotV1,
  transmissions: TransmissionRuntimeSnapshotV1,
): void {
  assertIdentity(session.config, identity, "session");
  assertIdentity(crossing.config, identity, "crossing");
  assertIdentity(transmissions.config, identity, "transmission");

  if (session.lifecycle.started !== crossing.started) {
    throw new Error("FirstCrossingCoordinator child start state is inconsistent.");
  }
  if (session.lifecycle.completed !== crossing.arrived) {
    throw new Error("FirstCrossingCoordinator child completion state is inconsistent.");
  }
  if (session.lifecycle.activeElapsedSeconds !== crossing.elapsedSeconds) {
    throw new Error("FirstCrossingCoordinator child active journey time is inconsistent.");
  }
  if (transmissions.hasAcceptedUpdate !== crossing.started) {
    throw new Error("FirstCrossingCoordinator transmission initialization is inconsistent.");
  }
  if (transmissions.hasAcceptedUpdate) {
    if (
      transmissions.activeElapsedSeconds !== crossing.elapsedSeconds ||
      transmissions.previousProgress !== crossing.progress ||
      transmissions.crossingPhase !== crossing.phase ||
      transmissions.arrived !== crossing.arrived
    ) {
      throw new Error("FirstCrossingCoordinator transmission crossing state is inconsistent.");
    }
  }
}

function createCoordinatorFromChildren(
  identity: FirstCrossingIdentity,
  children: CoordinatorChildren,
): FirstCrossingCoordinator {
  const { session, crossing, transmissions } = children;
  let acceptedSnapshot: FirstCrossingCoordinatorSnapshotV1;

  function composeSnapshot(): FirstCrossingCoordinatorSnapshotV1 {
    const sessionSnapshot = session.peekSnapshot();
    const crossingSnapshot = crossing.snapshot();
    const transmissionSnapshot = transmissions.snapshot();
    assertCoherentChildren(identity, sessionSnapshot, crossingSnapshot, transmissionSnapshot);
    return Object.freeze({
      schemaVersion: FIRST_CROSSING_COORDINATOR_SNAPSHOT_VERSION,
      identity,
      session: sessionSnapshot,
      crossing: crossingSnapshot,
      transmissions: transmissionSnapshot,
    });
  }

  function result(
    crossingTransitions: readonly CrossingTransition[] = [],
    transmissionEvents: readonly TransmissionRuntimeEvent[] = [],
    movementDeltaSeconds = 0,
  ): FirstCrossingCoordinatorResult {
    acceptedSnapshot = composeSnapshot();
    return Object.freeze({
      snapshot: acceptedSnapshot,
      crossingTransitions: Object.freeze([...crossingTransitions]),
      transmissionEvents: Object.freeze([...transmissionEvents]),
      movementDeltaSeconds,
    });
  }

  function updateTransmissions(
    crossingSnapshot: CrossingRuntimeSnapshotV1,
    crossingTransitions: readonly CrossingTransition[],
  ) {
    return transmissions.update({
      runId: identity.runId,
      routeDefinitionId: identity.routeDefinitionId,
      progress: crossingSnapshot.progress,
      phase: crossingSnapshot.phase,
      activeElapsedSeconds: crossingSnapshot.elapsedSeconds,
      transitions: crossingTransitions.map(({ id }) => Object.freeze({ id })),
    });
  }

  function reconcile(sessionState: FirstCrossingSessionState): FirstCrossingCoordinatorResult {
    if (!sessionState.started) {
      throw new Error("FirstCrossingCoordinator must start before it can be sampled.");
    }
    const previousCrossingElapsed = crossing.peek().elapsedSeconds;
    const crossingResult = crossing.sample(sessionState.activeElapsedSeconds);
    const transmissionResult = updateTransmissions(
      crossingResult.snapshot,
      crossingResult.transitions,
    );
    const movementDeltaSeconds = crossingResult.snapshot.elapsedSeconds - previousCrossingElapsed;

    if (crossingResult.snapshot.arrived) {
      session.completeAt(crossingResult.snapshot.elapsedSeconds);
    }

    return result(crossingResult.transitions, transmissionResult.events, movementDeltaSeconds);
  }

  function mergeResults(
    first: FirstCrossingCoordinatorResult,
    second: FirstCrossingCoordinatorResult,
  ): FirstCrossingCoordinatorResult {
    return Object.freeze({
      snapshot: second.snapshot,
      crossingTransitions: Object.freeze([
        ...first.crossingTransitions,
        ...second.crossingTransitions,
      ]),
      transmissionEvents: Object.freeze([
        ...first.transmissionEvents,
        ...second.transmissionEvents,
      ]),
      movementDeltaSeconds: first.movementDeltaSeconds + second.movementDeltaSeconds,
    });
  }

  function sampleCoordinator(): FirstCrossingCoordinatorResult {
    const sessionState = session.peek();
    if (!sessionState.started) {
      throw new Error("FirstCrossingCoordinator must start before it can be sampled.");
    }
    if (sessionState.completed) return result();
    return reconcile(session.sampleThrough(crossing.config.durationSeconds));
  }

  acceptedSnapshot = composeSnapshot();

  return Object.freeze({
    identity,

    start(): FirstCrossingCoordinatorResult {
      const sessionState = session.start();
      const crossingResult = crossing.start();
      const transmissionResult = updateTransmissions(
        crossingResult.snapshot,
        crossingResult.transitions,
      );
      if (sessionState.activeElapsedSeconds !== 0) {
        throw new Error("FirstCrossingCoordinator must start at zero active journey time.");
      }
      return result(crossingResult.transitions, transmissionResult.events, 0);
    },

    sample: sampleCoordinator,

    pause(): FirstCrossingCoordinatorResult {
      const advanced = sampleCoordinator();
      if (advanced.snapshot.session.lifecycle.completed) return advanced;
      return mergeResults(advanced, reconcile(session.pause()));
    },

    resume(): FirstCrossingCoordinatorResult {
      if (session.peek().completed) return result();
      session.resume();
      return result();
    },

    suspendForBackground(): FirstCrossingCoordinatorResult {
      if (!session.peek().started) {
        session.suspendForBackground();
        return result();
      }
      const advanced = sampleCoordinator();
      if (advanced.snapshot.session.lifecycle.completed) return advanced;
      return mergeResults(advanced, reconcile(session.suspendForBackground()));
    },

    resumeFromBackground(): FirstCrossingCoordinatorResult {
      session.resumeFromBackground();
      return result();
    },

    snapshot(): FirstCrossingCoordinatorSnapshotV1 {
      return acceptedSnapshot;
    },
  });
}

export function createFirstCrossingCoordinator(
  config: FirstCrossingCoordinatorConfig,
  dependencies: FirstCrossingCoordinatorDependencies = {},
): FirstCrossingCoordinator {
  const identity = freezeIdentity(config.runId, config.routeDefinitionId);
  const session = createFirstCrossingSession(identity, dependencies);
  const crossing = createCrossingRuntime({
    ...identity,
    durationSeconds: config.durationSeconds,
    thresholds: config.thresholds,
  });
  const transmissions = createTransmissionRuntime({
    ...config.transmissions,
    ...identity,
  });
  return createCoordinatorFromChildren(identity, { session, crossing, transmissions });
}

export function hydrateFirstCrossingCoordinator(
  snapshot: unknown,
  dependencies: FirstCrossingCoordinatorDependencies = {},
): FirstCrossingCoordinator {
  const root = asRecord(snapshot, "snapshot");
  if (root.schemaVersion !== FIRST_CROSSING_COORDINATOR_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported FirstCrossingCoordinator snapshot version: ${String(root.schemaVersion)}.`,
    );
  }
  const identityRecord = asRecord(root.identity, "snapshot.identity");
  const identity = freezeIdentity(
    identityRecord.runId as string,
    identityRecord.routeDefinitionId as string,
  );
  const session = hydrateFirstCrossingSession(root.session, dependencies);
  assertIdentity(session.config, identity, "hydrated session");
  const crossing = hydrateCrossingRuntime(root.crossing, identity);
  const transmissions = hydrateTransmissionRuntime(root.transmissions, identity);
  return createCoordinatorFromChildren(identity, { session, crossing, transmissions });
}
