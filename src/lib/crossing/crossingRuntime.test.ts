import { describe, expect, it } from "vitest";
import {
  createCrossingRuntime,
  CROSSING_RUNTIME_SNAPSHOT_VERSION,
  hydrateCrossingRuntime,
  phaseForProgress,
  PROVISIONAL_CROSSING_THRESHOLDS,
  type CrossingRuntimeConfig,
} from "./crossingRuntime";

function config(overrides: Partial<CrossingRuntimeConfig> = {}): CrossingRuntimeConfig {
  return {
    runId: "run-001",
    routeDefinitionId: "route-first-crossing",
    durationSeconds: 100,
    thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
    ...overrides,
  };
}

describe("SYS-007 production crossing configuration", () => {
  it("maps normalized progress to the configured lifecycle", () => {
    const thresholds = PROVISIONAL_CROSSING_THRESHOLDS;
    expect(phaseForProgress(0, thresholds)).toBe("launching");
    expect(phaseForProgress(0.049, thresholds)).toBe("launching");
    expect(phaseForProgress(0.05, thresholds)).toBe("in_transit");
    expect(phaseForProgress(0.899, thresholds)).toBe("in_transit");
    expect(phaseForProgress(0.9, thresholds)).toBe("approaching");
    expect(phaseForProgress(1, thresholds)).toBe("arrived");
  });

  it("rejects invalid identities, duration, and contradictory thresholds", () => {
    expect(() => createCrossingRuntime(config({ runId: "" }))).toThrow("runId");
    expect(() => createCrossingRuntime(config({ routeDefinitionId: " " }))).toThrow(
      "routeDefinitionId",
    );
    expect(() => createCrossingRuntime(config({ durationSeconds: 0 }))).toThrow("durationSeconds");
    expect(() =>
      createCrossingRuntime(
        config({ thresholds: { launchUntil: 0.9, approachFrom: 0.2, arriveAt: 1 } }),
      ),
    ).toThrow("must satisfy");
    expect(() =>
      createCrossingRuntime(
        config({ thresholds: { launchUntil: 0.1, approachFrom: 0.8, arriveAt: 0.9 as 1 } }),
      ),
    ).toThrow("arriveAt must equal");
  });

  it("copies and freezes immutable launch configuration", () => {
    const thresholds = { launchUntil: 0.1, approachFrom: 0.8, arriveAt: 1 as const };
    const source = {
      runId: "run-immutable",
      routeDefinitionId: "route-immutable",
      durationSeconds: 120,
      thresholds,
    };
    const runtime = createCrossingRuntime(source);

    source.durationSeconds = 12;
    thresholds.launchUntil = 0.2;

    expect(runtime.config.durationSeconds).toBe(120);
    expect(runtime.config.thresholds.launchUntil).toBe(0.1);
    expect(Object.isFrozen(runtime.config)).toBe(true);
    expect(Object.isFrozen(runtime.config.thresholds)).toBe(true);
    expect("setDuration" in runtime).toBe(false);
  });
});

describe("SYS-007 production crossing lifecycle", () => {
  it("starts once at zero in the launching phase", () => {
    const runtime = createCrossingRuntime(config());

    expect(runtime.peek()).toEqual(
      expect.objectContaining({
        started: false,
        phase: "idle",
        elapsedSeconds: 0,
        progress: 0,
      }),
    );
    expect(runtime.start()).toEqual(
      expect.objectContaining({
        snapshot: expect.objectContaining({ started: true, phase: "launching", progress: 0 }),
        transitions: [{ id: "launch_started", from: "idle", to: "launching", atProgress: 0 }],
      }),
    );
    expect(() => runtime.start()).toThrow("already-started");
  });

  it("derives finite monotonic progress only from supplied active time", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();

    expect(runtime.sample(25).snapshot.progress).toBe(0.25);
    expect(runtime.sample(50).snapshot.progress).toBe(0.5);
    expect(Number.isFinite(runtime.peek().progress)).toBe(true);
    expect(() => runtime.sample(Number.NaN)).toThrow("finite non-negative");
    expect(() => runtime.sample(Number.POSITIVE_INFINITY)).toThrow("finite non-negative");
  });

  it("enumerates every sparsely crossed threshold exactly once and in order", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();
    expect(runtime.sample(2).transitions).toEqual([]);

    const jumped = runtime.sample(91);
    expect(jumped.snapshot.phase).toBe("approaching");
    expect(jumped.transitions).toEqual([
      {
        id: "transit_started",
        from: "launching",
        to: "in_transit",
        atProgress: 0.05,
      },
      {
        id: "approach_started",
        from: "in_transit",
        to: "approaching",
        atProgress: 0.9,
      },
    ]);
    expect(runtime.sample(91).transitions).toEqual([]);
    expect(runtime.sample(99).transitions).toEqual([]);
  });

  it("enumerates the entire lifecycle when one sample jumps directly to arrival", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();

    expect(runtime.sample(100).transitions.map((transition) => transition.id)).toEqual([
      "transit_started",
      "approach_started",
      "arrived",
    ]);
  });

  it("arrives once, pins at one, and latches permanently", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();

    const arrival = runtime.sample(100);
    expect(arrival.snapshot).toEqual(
      expect.objectContaining({
        phase: "arrived",
        arrived: true,
        elapsedSeconds: 100,
        progress: 1,
      }),
    );
    expect(arrival.transitions.filter((transition) => transition.id === "arrived")).toHaveLength(1);
    expect(runtime.sample(1_000_000)).toEqual(
      expect.objectContaining({
        snapshot: expect.objectContaining({ phase: "arrived", arrived: true, progress: 1 }),
        transitions: [],
      }),
    );
  });

  it("rejects regressing supplied time without regressing state", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();
    runtime.sample(60);
    const before = runtime.peek();

    expect(() => runtime.sample(59)).toThrow("cannot regress");
    expect(runtime.peek()).toEqual(before);
  });

  it("has no production reset, scrub, pause, duration mutation, or listener API", () => {
    const runtime = createCrossingRuntime(config());
    expect("reset" in runtime).toBe(false);
    expect("scrubTo" in runtime).toBe(false);
    expect("pause" in runtime).toBe(false);
    expect("resume" in runtime).toBe(false);
    expect("setDuration" in runtime).toBe(false);
    expect("subscribe" in runtime).toBe(false);
  });
});

describe("SYS-007 production crossing snapshot and hydration", () => {
  it("preserves identity, immutable config, progress, and consumed transitions", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();
    runtime.sample(95);
    const serialized = JSON.parse(JSON.stringify(runtime.snapshot())) as unknown;
    const restored = hydrateCrossingRuntime(serialized, {
      runId: "run-001",
      routeDefinitionId: "route-first-crossing",
    });

    expect(restored.peek()).toEqual(runtime.peek());
    expect(restored.sample(95).transitions).toEqual([]);
    expect(restored.sample(100).transitions.map((transition) => transition.id)).toEqual([
      "arrived",
    ]);
  });

  it("hydrates an arrived run without repeating arrival", () => {
    const runtime = createCrossingRuntime(config());
    runtime.start();
    runtime.sample(500);

    const restored = hydrateCrossingRuntime(runtime.snapshot());
    expect(restored.peek()).toEqual(
      expect.objectContaining({ phase: "arrived", arrived: true, progress: 1 }),
    );
    expect(restored.sample(100).transitions).toEqual([]);
    expect(() => restored.start()).toThrow("already-started");
  });

  it("rejects conflicting expected run or route identity", () => {
    const runtime = createCrossingRuntime(config());
    const snapshot = runtime.snapshot();

    expect(() =>
      hydrateCrossingRuntime(snapshot, {
        runId: "another-run",
        routeDefinitionId: "route-first-crossing",
      }),
    ).toThrow("identity does not match");
  });

  it("rejects snapshots that could repeat or erase consumed transitions", () => {
    const invalid = {
      schemaVersion: CROSSING_RUNTIME_SNAPSHOT_VERSION,
      config: {
        runId: "run-001",
        routeDefinitionId: "route-first-crossing",
        durationSeconds: 100,
        thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
      },
      started: true,
      phase: "approaching",
      elapsedSeconds: 95,
      progress: 0.95,
      arrived: false,
      consumedTransitionIds: ["launch_started", "transit_started"],
    };

    expect(() => hydrateCrossingRuntime(invalid)).toThrow("consumed transitions");
  });

  it("keeps snapshots and transition results deeply immutable", () => {
    const runtime = createCrossingRuntime(config());
    const started = runtime.start();
    const snapshot = runtime.snapshot();

    expect(Object.isFrozen(started)).toBe(true);
    expect(Object.isFrozen(started.transitions)).toBe(true);
    expect(Object.isFrozen(started.transitions[0])).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.config)).toBe(true);
    expect(Object.isFrozen(snapshot.config.thresholds)).toBe(true);
    expect(Object.isFrozen(snapshot.consumedTransitionIds)).toBe(true);
  });
});
