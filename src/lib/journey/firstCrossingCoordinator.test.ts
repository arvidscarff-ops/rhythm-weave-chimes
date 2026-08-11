import { describe, expect, it } from "vitest";
import { PROVISIONAL_CROSSING_THRESHOLDS } from "../crossing/crossingRuntime";
import type {
  TransmissionDefinition,
  TransmissionRuntimeEvent,
} from "../transmissions/transmissionTypes";
import {
  createFirstCrossingCoordinator,
  hydrateFirstCrossingCoordinator,
  type FirstCrossingCoordinatorConfig,
} from "./firstCrossingCoordinator";
import type { FirstCrossingTimeSource } from "./firstCrossingSession";
import {
  installFirstCrossingVisibility,
  type FirstCrossingVisibilitySource,
} from "./firstCrossingVisibility";

function manualTime(start = 0) {
  let current = start;
  const source: FirstCrossingTimeSource = () => current;
  return {
    source,
    advance(seconds: number) {
      current += seconds;
    },
  };
}

const DEFINITIONS: readonly TransmissionDefinition[] = [
  {
    id: "early",
    label: "Early diagnostic transmission",
    windowStart: 0.1,
    windowEnd: 0.2,
    durationSeconds: 4,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  },
  {
    id: "middle",
    label: "Middle diagnostic transmission",
    windowStart: 0.4,
    windowEnd: 0.5,
    durationSeconds: 4,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  },
];

function config(
  overrides: Partial<FirstCrossingCoordinatorConfig> = {},
): FirstCrossingCoordinatorConfig {
  return {
    runId: "run-journey-1",
    routeDefinitionId: "route-first-crossing",
    durationSeconds: 100,
    thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
    transmissions: {
      definitionSetId: "journey-lab-v1",
      seed: "journey-seed",
      definitions: DEFINITIONS,
      admissionChance: 1,
      minGapSeconds: 0,
    },
    ...overrides,
  };
}

function harness(overrides: Partial<FirstCrossingCoordinatorConfig> = {}, startTime = 0) {
  const time = manualTime(startTime);
  const coordinator = createFirstCrossingCoordinator(config(overrides), {
    timeSource: time.source,
  });
  return { coordinator, time };
}

function stableEvents(events: readonly TransmissionRuntimeEvent[]) {
  return events.map(({ id, type, definitionId, episodeId }) => ({
    id,
    type,
    definitionId,
    episodeId,
  }));
}

describe("SYS-008 coordinator identity and start", () => {
  it("establishes one canonical child identity and starts every child once", () => {
    const { coordinator } = harness();
    const started = coordinator.start();

    expect(started.snapshot.identity).toEqual({
      runId: "run-journey-1",
      routeDefinitionId: "route-first-crossing",
    });
    expect(started.snapshot.session.config).toEqual(started.snapshot.identity);
    expect(started.snapshot.crossing.config).toEqual(
      expect.objectContaining(started.snapshot.identity),
    );
    expect(started.snapshot.transmissions.config).toEqual(
      expect.objectContaining(started.snapshot.identity),
    );
    expect(started.crossingTransitions.map(({ id }) => id)).toEqual(["launch_started"]);
    expect(started.movementDeltaSeconds).toBe(0);
    expect(() => coordinator.start()).toThrow("more than once");
  });

  it("keeps coordinator instances independent", () => {
    const first = harness({ runId: "run-a" });
    const second = harness({ runId: "run-b" });
    first.coordinator.start();
    second.coordinator.start();
    first.time.advance(20);
    second.time.advance(5);

    expect(first.coordinator.sample().snapshot.crossing.progress).toBe(0.2);
    expect(second.coordinator.sample().snapshot.crossing.progress).toBe(0.05);
  });

  it("introduces no clock, musical transport, movement state, or subscription API", () => {
    const { coordinator } = harness();
    expect("clock" in coordinator).toBe(false);
    expect("engineClock" in coordinator).toBe(false);
    expect("movementState" in coordinator).toBe(false);
    expect("subscribe" in coordinator).toBe(false);
  });
});

describe("SYS-008 deterministic journey transaction", () => {
  it("advances crossing, transmissions, and movement from one active-time sample", () => {
    const active: TransmissionDefinition = {
      ...DEFINITIONS[0],
      windowStart: 0,
      windowEnd: 0.9,
      durationSeconds: 50,
    };
    const { coordinator, time } = harness({
      transmissions: {
        ...config().transmissions,
        definitions: [active],
      },
    });
    coordinator.start();
    time.advance(10);

    const result = coordinator.sample();
    expect(result.snapshot.session.lifecycle.activeElapsedSeconds).toBe(10);
    expect(result.snapshot.crossing.elapsedSeconds).toBe(10);
    expect(result.snapshot.transmissions.activeElapsedSeconds).toBe(10);
    expect(result.snapshot.transmissions.remainingSeconds).toBe(40);
    expect(result.movementDeltaSeconds).toBe(10);
  });

  it("preserves sparse crossing threshold order exactly once", () => {
    const { coordinator, time } = harness();
    coordinator.start();
    time.advance(91);

    expect(coordinator.sample().crossingTransitions.map(({ id }) => id)).toEqual([
      "transit_started",
      "approach_started",
    ]);
    expect(coordinator.sample().crossingTransitions).toEqual([]);
  });

  it("keeps transmission admission and event identity independent of polling cadence", () => {
    const dense = harness();
    const sparse = harness();
    dense.coordinator.start();
    sparse.coordinator.start();
    const denseEvents: TransmissionRuntimeEvent[] = [];
    const sparseEvents: TransmissionRuntimeEvent[] = [];

    for (let second = 1; second <= 60; second += 1) {
      dense.time.advance(1);
      denseEvents.push(...dense.coordinator.sample().transmissionEvents);
    }
    sparse.time.advance(60);
    sparseEvents.push(...sparse.coordinator.sample().transmissionEvents);

    expect(stableEvents(sparseEvents)).toEqual(stableEvents(denseEvents));
    expect(sparse.coordinator.snapshot().transmissions.playedTransmissionIds).toEqual(
      dense.coordinator.snapshot().transmissions.playedTransmissionIds,
    );
  });
});

describe("SYS-008 pause, background, and resume", () => {
  const activeDefinition: TransmissionDefinition = {
    ...DEFINITIONS[0],
    windowStart: 0,
    windowEnd: 0.9,
    durationSeconds: 50,
  };

  function activeHarness() {
    return harness({
      transmissions: {
        ...config().transmissions,
        definitions: [activeDefinition],
      },
    });
  }

  it("freezes every journey-side child and movement while explicitly paused", () => {
    const { coordinator, time } = activeHarness();
    coordinator.start();
    time.advance(10);
    coordinator.sample();
    coordinator.pause();
    const frozen = coordinator.snapshot();

    time.advance(10_000);
    const paused = coordinator.sample();
    expect(paused.snapshot).toEqual(frozen);
    expect(paused.movementDeltaSeconds).toBe(0);
    expect(paused.transmissionEvents).toEqual([]);

    coordinator.resume();
    time.advance(3);
    expect(coordinator.sample()).toEqual(expect.objectContaining({ movementDeltaSeconds: 3 }));
    expect(coordinator.snapshot().transmissions.remainingSeconds).toBe(37);
  });

  it("freezes through the visibility adapter and resumes without hidden catch-up", () => {
    let hidden = false;
    let listener: () => void = () => undefined;
    const source: FirstCrossingVisibilitySource = {
      get hidden() {
        return hidden;
      },
      addEventListener(_type, next) {
        listener = next;
      },
      removeEventListener() {
        listener = () => undefined;
      },
    };
    const { coordinator, time } = activeHarness();
    const cleanup = installFirstCrossingVisibility(source, coordinator);
    coordinator.start();
    time.advance(8);
    coordinator.sample();

    hidden = true;
    listener();
    const frozen = coordinator.snapshot();
    time.advance(50_000);
    expect(coordinator.sample()).toEqual(
      expect.objectContaining({ snapshot: frozen, movementDeltaSeconds: 0 }),
    );

    hidden = false;
    listener();
    expect(coordinator.sample().movementDeltaSeconds).toBe(0);
    time.advance(2);
    expect(coordinator.sample().movementDeltaSeconds).toBe(2);
    cleanup();
  });
});

describe("SYS-008 exact arrival boundary", () => {
  const arrivalDefinition: TransmissionDefinition = {
    id: "arrival-active",
    label: "Arrival-active diagnostic transmission",
    windowStart: 0.9,
    windowEnd: 0.99,
    durationSeconds: 100,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  };

  it("caps sparse overshoot, freezes completion, and requests one arrival fade", () => {
    const { coordinator, time } = harness({
      durationSeconds: 10,
      transmissions: {
        ...config().transmissions,
        definitions: [arrivalDefinition],
      },
    });
    coordinator.start();
    time.advance(9);
    coordinator.sample();
    time.advance(3);

    const arrival = coordinator.sample();
    expect(arrival.snapshot.session.lifecycle).toEqual(
      expect.objectContaining({ completed: true, activeElapsedSeconds: 10 }),
    );
    expect(arrival.snapshot.crossing).toEqual(
      expect.objectContaining({ arrived: true, elapsedSeconds: 10, progress: 1 }),
    );
    expect(arrival.snapshot.transmissions.activeElapsedSeconds).toBe(10);
    expect(arrival.movementDeltaSeconds).toBe(1);
    expect(
      arrival.transmissionEvents.filter(({ type }) => type === "transmissionArrivalFadeRequested"),
    ).toHaveLength(1);
    expect(arrival.snapshot.transmissions.current?.definitionId).toBe("arrival-active");

    time.advance(1_000);
    const repeated = coordinator.sample();
    expect(repeated.movementDeltaSeconds).toBe(0);
    expect(repeated.crossingTransitions).toEqual([]);
    expect(repeated.transmissionEvents).toEqual([]);
    expect(repeated.snapshot).toEqual(arrival.snapshot);
  });
});

describe("SYS-008 snapshot and hydration", () => {
  it("hydrates child snapshots without events or movement catch-up", () => {
    const original = harness();
    original.coordinator.start();
    original.time.advance(45);
    original.coordinator.sample();
    const snapshot = JSON.parse(JSON.stringify(original.coordinator.snapshot())) as unknown;

    const restoreTime = manualTime(9_000_000);
    const restored = hydrateFirstCrossingCoordinator(snapshot, {
      timeSource: restoreTime.source,
    });
    expect(restored.snapshot()).toEqual(original.coordinator.snapshot());
    expect(restored.sample()).toEqual(
      expect.objectContaining({
        crossingTransitions: [],
        transmissionEvents: [],
        movementDeltaSeconds: 0,
      }),
    );

    restoreTime.advance(5);
    expect(restored.sample().movementDeltaSeconds).toBe(5);
  });

  it("rejects mismatched or incoherent child snapshots", () => {
    const { coordinator } = harness();
    coordinator.start();
    const mismatched = JSON.parse(JSON.stringify(coordinator.snapshot()));
    mismatched.crossing.config.runId = "another-run";
    expect(() => hydrateFirstCrossingCoordinator(mismatched)).toThrow("identity");

    const incoherent = JSON.parse(JSON.stringify(coordinator.snapshot()));
    incoherent.session.lifecycle.activeElapsedSeconds = 1;
    expect(() => hydrateFirstCrossingCoordinator(incoherent)).toThrow("active journey time");
  });

  it("preserves an arrived/completed run without replaying arrival", () => {
    const original = harness({ durationSeconds: 10 });
    original.coordinator.start();
    original.time.advance(20);
    original.coordinator.sample();

    const restored = hydrateFirstCrossingCoordinator(original.coordinator.snapshot(), {
      timeSource: manualTime(99_999).source,
    });
    expect(restored.sample()).toEqual(
      expect.objectContaining({
        crossingTransitions: [],
        transmissionEvents: [],
        movementDeltaSeconds: 0,
      }),
    );
    expect(restored.snapshot().session.lifecycle.completed).toBe(true);
  });
});
