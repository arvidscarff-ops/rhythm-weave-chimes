import { describe, expect, it } from "vitest";
import {
  createTransmissionRuntime,
  hydrateTransmissionRuntime,
  type TransmissionRuntimeConfig,
} from "./transmissionRuntime";
import type {
  TransmissionCrossingInput,
  TransmissionDefinition,
  TransmissionRuntimeEvent,
} from "./transmissionTypes";

const DEFINITIONS: readonly TransmissionDefinition[] = [
  {
    id: "a",
    label: "Transmission A",
    windowStart: 0.1,
    windowEnd: 0.25,
    durationSeconds: 4,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  },
  {
    id: "b",
    label: "Transmission B",
    windowStart: 0.35,
    windowEnd: 0.55,
    durationSeconds: 5,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  },
  {
    id: "c",
    label: "Transmission C",
    windowStart: 0.7,
    windowEnd: 0.88,
    durationSeconds: 3,
    weight: 1,
    priority: 0,
    oncePerCrossing: true,
  },
];

function config(overrides: Partial<TransmissionRuntimeConfig> = {}): TransmissionRuntimeConfig {
  return {
    runId: "run-1",
    routeDefinitionId: "route-first-crossing",
    definitionSetId: "transmissions-v1",
    seed: "seed-1",
    definitions: DEFINITIONS,
    admissionChance: 1,
    minGapSeconds: 0,
    ...overrides,
  };
}

function input(
  progress: number,
  activeElapsedSeconds = progress * 100,
  phase: TransmissionCrossingInput["phase"] = progress === 1 ? "arrived" : "in_transit",
): TransmissionCrossingInput {
  return {
    runId: "run-1",
    routeDefinitionId: "route-first-crossing",
    progress,
    phase,
    activeElapsedSeconds,
    transitions: phase === "arrived" ? [{ id: "arrived" }] : [],
  };
}

function eventTypes(events: readonly TransmissionRuntimeEvent[]) {
  return events.map((event) => `${event.type}:${event.definitionId}`);
}

describe("SYS-010 production configuration", () => {
  it("validates and deeply freezes definitions and run configuration", () => {
    const sourceDefinition = { ...DEFINITIONS[0] };
    const runtime = createTransmissionRuntime(
      config({ definitions: [sourceDefinition], admissionChance: 0.5, minGapSeconds: 2 }),
    );
    sourceDefinition.durationSeconds = 999;

    expect(runtime.config.definitions[0]?.durationSeconds).toBe(4);
    expect(Object.isFrozen(runtime.config)).toBe(true);
    expect(Object.isFrozen(runtime.config.definitions)).toBe(true);
    expect(Object.isFrozen(runtime.config.definitions[0])).toBe(true);
  });

  it("rejects duplicate IDs and malformed authored values", () => {
    expect(() =>
      createTransmissionRuntime(config({ definitions: [DEFINITIONS[0], DEFINITIONS[0]] })),
    ).toThrow("Duplicate");
    expect(() =>
      createTransmissionRuntime(config({ definitions: [{ ...DEFINITIONS[0], windowEnd: 0.1 }] })),
    ).toThrow("half-open window");
    expect(() =>
      createTransmissionRuntime(config({ definitions: [{ ...DEFINITIONS[0], weight: 0 }] })),
    ).toThrow("weight must be positive");
    expect(() =>
      createTransmissionRuntime(config({ definitions: [{ ...DEFINITIONS[0], priority: 1.5 }] })),
    ).toThrow("priority");
    expect(() => createTransmissionRuntime(config({ admissionChance: 1.1 }))).toThrow(
      "admissionChance",
    );
    expect(() => createTransmissionRuntime(config({ minGapSeconds: -1 }))).toThrow("minGapSeconds");
  });
});

describe("SYS-010 cadence-independent eligibility", () => {
  function run(samples: readonly number[], seed = "cadence-seed") {
    const runtime = createTransmissionRuntime(config({ seed }));
    const events: TransmissionRuntimeEvent[] = [];
    for (const progress of samples) events.push(...runtime.update(input(progress)).events);
    return { events, snapshot: runtime.snapshot() };
  }

  it("produces identical results for dense and sparse polling of the same path", () => {
    const dense = run(Array.from({ length: 101 }, (_, index) => index / 100));
    const sparse = run([0, 0.3, 0.6, 0.9, 1]);

    const stableEventResult = (events: readonly TransmissionRuntimeEvent[]) =>
      events.map(({ id, type, definitionId, episodeId }) => ({
        id,
        type,
        definitionId,
        episodeId,
      }));
    expect(stableEventResult(sparse.events)).toEqual(stableEventResult(dense.events));
    expect(sparse.snapshot.playedTransmissionIds).toEqual(dense.snapshot.playedTransmissionIds);
    expect(
      sparse.snapshot.evaluatedEpisodes.map(({ episodeId, definitionId, admitted }) => ({
        episodeId,
        definitionId,
        admitted,
      })),
    ).toEqual(
      dense.snapshot.evaluatedEpisodes.map(({ episodeId, definitionId, admitted }) => ({
        episodeId,
        definitionId,
        admitted,
      })),
    );
  });

  it("evaluates and schedules a complete window crossed by one sparse update", () => {
    const runtime = createTransmissionRuntime(
      config({ definitions: [DEFINITIONS[0]], seed: "window-jump" }),
    );
    runtime.update(input(0));
    const result = runtime.update(input(0.3));

    expect(eventTypes(result.events)).toEqual([
      "transmissionAdmitted:a",
      "transmissionStarted:a",
      "transmissionCompleted:a",
    ]);
    expect(result.snapshot.evaluatedEpisodes).toHaveLength(1);
    expect(result.snapshot.playedTransmissionIds).toEqual(["a"]);
  });

  it("evaluates each episode once and emits nothing for repeated samples", () => {
    const runtime = createTransmissionRuntime(config({ definitions: [DEFINITIONS[0]] }));
    const first = runtime.update(input(0.15));
    const repeated = runtime.update(input(0.15));

    expect(first.events.some((event) => event.type === "transmissionAdmitted")).toBe(true);
    expect(repeated.events).toEqual([]);
    expect(runtime.snapshot().evaluatedEpisodes).toHaveLength(1);
  });

  it("does not allow a once-per-crossing definition to replay", () => {
    const runtime = createTransmissionRuntime(config({ definitions: [DEFINITIONS[0]] }));
    runtime.update(input(0.1));
    runtime.update(input(0.3));
    runtime.update(input(0.8));

    expect(runtime.snapshot().playedTransmissionIds).toEqual(["a"]);
    expect(runtime.snapshot().startedEpisodeIds).toHaveLength(1);
  });

  it("rejects progress regression instead of treating it as developer scrub", () => {
    const runtime = createTransmissionRuntime(config());
    runtime.update(input(0.5));
    const before = runtime.snapshot();

    expect(() => runtime.update(input(0.4))).toThrow("progress cannot regress");
    expect(runtime.snapshot()).toEqual(before);
  });
});

describe("SYS-010 priority, weighting, and active-time constraints", () => {
  const candidate = (id: string, priority: number, weight = 1): TransmissionDefinition => ({
    id,
    label: id,
    windowStart: 0.1,
    windowEnd: 0.9,
    durationSeconds: 2,
    weight,
    priority,
    oncePerCrossing: true,
  });

  it("selects the highest authored priority before applying weights", () => {
    const runtime = createTransmissionRuntime(
      config({ definitions: [candidate("low", 1, 1_000), candidate("high", 10, 1)] }),
    );
    const result = runtime.update(input(0.1));
    const started = result.events.find((event) => event.type === "transmissionStarted");

    expect(started?.definitionId).toBe("high");
  });

  it("makes deterministic seeded weighted choices inside one priority tier", () => {
    const definitions = [candidate("x", 5, 1), candidate("y", 5, 4)];
    const choose = (seed: string) => {
      const runtime = createTransmissionRuntime(config({ definitions, seed }));
      return runtime.update(input(0.1)).events.find((event) => event.type === "transmissionStarted")
        ?.definitionId;
    };

    expect(choose("same-seed")).toBe(choose("same-seed"));
    expect(["x", "y"]).toContain(choose("same-seed"));
  });

  it("measures duration and minimum gap only in supplied active journey time", () => {
    const runtime = createTransmissionRuntime(
      config({ definitions: [candidate("x", 1), candidate("y", 1)], minGapSeconds: 5 }),
    );
    runtime.update(input(0.1, 10));

    const frozen = runtime.update(input(0.1, 10));
    expect(frozen.events).toEqual([]);
    expect(frozen.snapshot.remainingSeconds).toBe(2);

    const completed = runtime.update(input(0.12, 12));
    expect(completed.events.map((event) => event.type)).toContain("transmissionCompleted");
    expect(completed.snapshot.current).toBeNull();

    expect(runtime.update(input(0.16, 16)).snapshot.current).toBeNull();
    const afterGap = runtime.update(input(0.17, 17));
    expect(afterGap.events.map((event) => event.type)).toContain("transmissionStarted");
  });

  it("rejects progress movement while active time is frozen", () => {
    const runtime = createTransmissionRuntime(config());
    runtime.update(input(0.1, 10));
    expect(() => runtime.update(input(0.2, 10))).toThrow("active time is frozen");
  });
});

describe("SYS-010 identity, arrival, and reconstruction", () => {
  it("rejects a crossing snapshot from another run or route", () => {
    const runtime = createTransmissionRuntime(config());
    expect(() => runtime.update({ ...input(0.1), runId: "wrong-run" })).toThrow(
      "identity does not match",
    );
    expect(() => runtime.update({ ...input(0.1), routeDefinitionId: "wrong-route" })).toThrow(
      "identity does not match",
    );
  });

  it("requests one arrival fade without ending or delaying the crossing", () => {
    const long: TransmissionDefinition = {
      ...DEFINITIONS[0],
      durationSeconds: 200,
      windowEnd: 0.99,
    };
    const runtime = createTransmissionRuntime(config({ definitions: [long] }));
    runtime.update(input(0.1, 10));

    const arrival = runtime.update(input(1, 100, "arrived"));
    expect(arrival.snapshot.arrived).toBe(true);
    expect(arrival.snapshot.current?.definitionId).toBe("a");
    expect(
      arrival.events.filter((event) => event.type === "transmissionArrivalFadeRequested"),
    ).toHaveLength(1);
    expect(runtime.update(input(1, 100, "arrived")).events).toEqual([]);
  });

  it("hydrates an active transmission without counting time away or emitting", () => {
    const long: TransmissionDefinition = { ...DEFINITIONS[0], durationSeconds: 20 };
    const runtime = createTransmissionRuntime(config({ definitions: [long] }));
    runtime.update(input(0.1, 10));
    runtime.update(input(0.15, 15));
    const before = runtime.snapshot();

    const restored = hydrateTransmissionRuntime(JSON.parse(JSON.stringify(before)), {
      runId: "run-1",
      routeDefinitionId: "route-first-crossing",
    });
    expect(restored.snapshot()).toEqual(before);
    expect(restored.update(input(0.15, 15)).events).toEqual([]);
    expect(restored.snapshot().remainingSeconds).toBe(15);
  });

  it("does not retroactively admit anything merely because state was hydrated", () => {
    const runtime = createTransmissionRuntime(config());
    runtime.update(input(0.6));
    const restored = hydrateTransmissionRuntime(runtime.snapshot());

    expect(restored.snapshot().evaluatedEpisodes).toEqual(runtime.snapshot().evaluatedEpisodes);
    expect(restored.update(input(0.6)).events).toEqual([]);
  });

  it("preserves arrival fade and consumed episode state through hydration", () => {
    const long: TransmissionDefinition = {
      ...DEFINITIONS[0],
      durationSeconds: 200,
      windowEnd: 0.99,
    };
    const runtime = createTransmissionRuntime(config({ definitions: [long] }));
    runtime.update(input(0.1, 10));
    runtime.update(input(1, 100, "arrived"));

    const restored = hydrateTransmissionRuntime(runtime.snapshot());
    expect(restored.snapshot()).toEqual(runtime.snapshot());
    expect(restored.update(input(1, 100, "arrived")).events).toEqual([]);
  });

  it("rejects snapshot hydration under another expected identity", () => {
    const runtime = createTransmissionRuntime(config());
    expect(() =>
      hydrateTransmissionRuntime(runtime.snapshot(), {
        runId: "another-run",
        routeDefinitionId: "route-first-crossing",
      }),
    ).toThrow("identity does not match");
  });

  it("exposes no private clock, callbacks, reset, or scrub API", () => {
    const runtime = createTransmissionRuntime(config());
    expect("sample" in runtime).toBe(false);
    expect("subscribe" in runtime).toBe(false);
    expect("reset" in runtime).toBe(false);
    expect("scrubTo" in runtime).toBe(false);
    expect("startCrossing" in runtime).toBe(false);
  });
});
