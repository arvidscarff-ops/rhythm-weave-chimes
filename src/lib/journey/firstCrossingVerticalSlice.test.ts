import { describe, expect, it } from "vitest";
import { PROVISIONAL_CROSSING_THRESHOLDS } from "../crossing/crossingRuntime";
import {
  createMovementState,
  DEFAULT_MOVEMENT_PARAMS,
  stepMovement,
} from "../movement/movementModel";
import {
  advanceCompositionRevisionSession,
  createCompositionRevisionSession,
  reconstructProductionInput,
} from "../rhythm/productionRhythmBridge";
import { SAMPLE_TRANSMISSIONS } from "../transmissions/sampleTransmissions";
import type { TransmissionDefinition } from "../transmissions/transmissionTypes";
import { coordinatorConfigFromFirstCrossingBinding } from "./firstCrossingBindingCoordinator";
import { resolveProvisionalFirstCrossingBinding } from "./firstCrossingBindingFixture";
import {
  createFirstCrossingCoordinator,
  type FirstCrossingCoordinator,
} from "./firstCrossingCoordinator";
import { coordinateFirstCrossingLifecycle } from "./firstCrossingLifecycle";
import { createFirstCrossingRunSnapshot, hydrateFirstCrossingRun } from "./firstCrossingRun";

const binding = resolveProvisionalFirstCrossingBinding();

function createHarness(
  runId: string,
  definitions: readonly TransmissionDefinition[] = SAMPLE_TRANSMISSIONS,
) {
  let wallSeconds = 0;
  const coordinator = createFirstCrossingCoordinator(
    coordinatorConfigFromFirstCrossingBinding(binding, runId, {
      thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
      transmissions: {
        definitionSetId: binding.transmissionSet?.id ?? "journey-lab-transmissions-v1",
        seed: `vertical-slice:${runId}`,
        definitions,
        admissionChance: 1,
        minGapSeconds: 0,
      },
    }),
    { timeSource: () => wallSeconds },
  );
  return {
    coordinator,
    advance(seconds: number) {
      wallSeconds += seconds;
      return coordinator.sample();
    },
    setWall(seconds: number) {
      wallSeconds = seconds;
    },
    wall: () => wallSeconds,
  };
}

describe("SYS-011 integrated First Crossing contract", () => {
  it("uses one resolved binding while keeping fresh run identity outside authored data", () => {
    const first = createHarness("run-a").coordinator;
    const second = createHarness("run-b").coordinator;

    expect(first.identity.routeDefinitionId).toBe(binding.route.definition.id);
    expect(second.identity.routeDefinitionId).toBe(binding.route.definition.id);
    expect(first.identity.runId).not.toBe(second.identity.runId);
    expect(binding.authored).not.toHaveProperty("runId");
    expect(binding.compositionSnapshot.id).toBe(binding.authored.composition.compositionId);
    expect(binding.compositionSnapshot.revision).toBe(binding.authored.composition.revision);
  });

  it("restores only through the exact binding revision and emits no historical events", () => {
    const source = createHarness("restore-run");
    source.coordinator.start();
    source.advance(24);
    const saved = createFirstCrossingRunSnapshot(binding, source.coordinator.snapshot());
    const serialized = JSON.parse(JSON.stringify(saved));
    let restoreWall = 24;

    const restored = hydrateFirstCrossingRun(
      serialized,
      (reference) =>
        reference.id === binding.authored.id && reference.revision === binding.authored.revision
          ? binding
          : undefined,
      { timeSource: () => restoreWall },
    );

    expect(restored.snapshot.bindingRef).toEqual({
      id: binding.authored.id,
      revision: binding.authored.revision,
    });
    const firstSample = restored.coordinator.sample();
    expect(firstSample.crossingTransitions).toEqual([]);
    expect(firstSample.transmissionEvents).toEqual([]);
    expect(firstSample.movementDeltaSeconds).toBe(0);

    const wrongRevision = {
      ...serialized,
      bindingRef: { ...serialized.bindingRef, revision: serialized.bindingRef.revision + 1 },
    };
    expect(() => hydrateFirstCrossingRun(wrongRevision, () => undefined)).toThrow(
      /binding .* is unavailable/i,
    );
    restoreWall += 1;
  });

  it("freezes journey and musical authorities together without merging them", () => {
    const harness = createHarness("lifecycle-run");
    harness.coordinator.start();
    let musicalSeconds = 0;
    let musicalPaused = false;
    let musicalSuspended = false;
    const musicalTransport = {
      pause() {
        musicalPaused = true;
      },
      resume() {
        musicalPaused = false;
      },
      suspendForBackground() {
        musicalSuspended = true;
      },
      resumeFromBackground() {
        musicalSuspended = false;
      },
    };
    const lifecycle = coordinateFirstCrossingLifecycle(harness.coordinator, musicalTransport);
    const advanceBoth = (seconds: number) => {
      harness.setWall(harness.wall() + seconds);
      if (!musicalPaused && !musicalSuspended) musicalSeconds += seconds;
      return harness.coordinator.sample();
    };

    advanceBoth(5);
    lifecycle.pause();
    const pausedJourney = harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds;
    const pausedMusic = musicalSeconds;
    advanceBoth(40);
    expect(harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds).toBe(
      pausedJourney,
    );
    expect(musicalSeconds).toBe(pausedMusic);

    lifecycle.resume();
    advanceBoth(2);
    expect(harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds).toBe(
      pausedJourney + 2,
    );
    expect(musicalSeconds).toBe(pausedMusic + 2);

    lifecycle.suspendForBackground();
    const suspendedJourney = harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds;
    const suspendedMusic = musicalSeconds;
    advanceBoth(80);
    expect(harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds).toBe(
      suspendedJourney,
    );
    expect(musicalSeconds).toBe(suspendedMusic);
    lifecycle.resumeFromBackground();
    advanceBoth(1);
    expect(harness.coordinator.snapshot().session.lifecycle.activeElapsedSeconds).toBe(
      suspendedJourney + 1,
    );
    expect(musicalSeconds).toBe(suspendedMusic + 1);
  });

  it("keeps finite crossing progress independent from exact musical position", () => {
    const harness = createHarness("independent-authorities");
    harness.coordinator.start();
    const compositionSession = createCompositionRevisionSession(binding.compositionSnapshot, 0);
    const before = reconstructProductionInput(compositionSession.active, 17);
    const journey = harness.advance(42);
    const after = reconstructProductionInput(compositionSession.active, 17);

    expect(journey.snapshot.crossing.progress).toBeCloseTo(0.7);
    expect(before.snapshot).toEqual(after.snapshot);
    expect(before.snapshot.macroPhase.normalizedForRendering).toBeCloseTo(17 / 30);
    expect(journey.snapshot.crossing.progress).not.toBeCloseTo(
      before.snapshot.macroPhase.normalizedForRendering,
    );
  });

  it("feeds stable authoritative events to presentation without movement creating events", () => {
    const musicalSession = createCompositionRevisionSession(binding.compositionSnapshot, 0);
    const advanced = advanceCompositionRevisionSession(musicalSession, 0, 3);
    const eventIds = advanced.input.events.map((event) => event.id);
    const movementBefore = createMovementState(DEFAULT_MOVEMENT_PARAMS);
    const movementAfter = stepMovement(
      movementBefore,
      { steerX: 1, steerY: -0.5 },
      3,
      DEFAULT_MOVEMENT_PARAMS,
    );
    const repeated = advanceCompositionRevisionSession(musicalSession, 0, 3);

    expect(eventIds.length).toBeGreaterThan(0);
    expect(new Set(eventIds).size).toBe(eventIds.length);
    expect(repeated.input.events.map((event) => event.id)).toEqual(eventIds);
    expect(movementAfter.position).not.toEqual(movementBefore.position);
    expect(repeated.input.events.map((event) => event.id)).toEqual(eventIds);
  });

  it("enumerates sparse lifecycle thresholds once and arrives away from Phase Zero", () => {
    const harness = createHarness("sparse-arrival");
    harness.coordinator.start();
    const arrival = harness.advance(60);
    const musicAtArrival = reconstructProductionInput(
      createCompositionRevisionSession(binding.compositionSnapshot, 0).active,
      17,
    );

    expect(arrival.crossingTransitions.map((transition) => transition.id)).toEqual([
      "transit_started",
      "approach_started",
      "arrived",
    ]);
    expect(arrival.snapshot.crossing.arrived).toBe(true);
    expect(arrival.snapshot.session.lifecycle.completed).toBe(true);
    expect(musicAtArrival.snapshot.isPhaseZero).toBe(false);
    const afterArrival = harness.advance(120);
    expect(afterArrival.movementDeltaSeconds).toBe(0);
    expect(afterArrival.crossingTransitions).toEqual([]);
    expect(afterArrival.snapshot.crossing.elapsedSeconds).toBe(60);
  });

  it("sends the active-transmission fade request to arrival presentation state", () => {
    const arrivalTransmission: TransmissionDefinition = {
      id: "dev-arrival",
      label: "Arrival placeholder",
      windowStart: 0.95,
      windowEnd: 0.999,
      durationSeconds: 20,
      weight: 1,
      priority: 1,
      oncePerCrossing: true,
    };
    const harness = createHarness("arrival-fade", [arrivalTransmission]);
    harness.coordinator.start();
    const arrival = harness.advance(60);

    expect(arrival.snapshot.crossing.arrived).toBe(true);
    expect(arrival.transmissionEvents.map((event) => event.type)).toContain(
      "transmissionArrivalFadeRequested",
    );
    expect(arrival.snapshot.transmissions.arrivalFadeRequestedForStartEventId).not.toBeNull();
  });
});
