import { describe, expect, it } from "vitest";
import { PROVISIONAL_CROSSING_THRESHOLDS } from "../crossing/crossingRuntime";
import { createFirstCrossingCoordinator } from "./firstCrossingCoordinator";
import {
  defineFirstCrossingBinding,
  resolveFirstCrossingBinding,
  validateFirstCrossingBinding,
} from "./firstCrossingBinding";
import { coordinatorConfigFromFirstCrossingBinding } from "./firstCrossingBindingCoordinator";
import {
  PROVISIONAL_FIRST_CROSSING_BINDING,
  PROVISIONAL_FIRST_CROSSING_RESOLVERS,
  PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID,
  resolveProvisionalFirstCrossingBinding,
} from "./firstCrossingBindingFixture";
import type { FirstCrossingTimeSource } from "./firstCrossingSession";

function authoredBinding(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: "first-crossing-development-proof",
    revision: 1,
    label: "First Crossing development proof",
    status: "provisional",
    routeDefinitionId: "route-first-crossing",
    composition: {
      compositionId: "first-crossing:phase-align-rings",
      revision: 1,
      engineId: "phaseAlignRings",
      macroCycleDuration: 30,
      baseLaps: 10,
      density: 5,
      noteCount: 8,
    },
    triggerEnginePresentation: {
      id: "phaseAlignRings",
      revision: 1,
      status: "provisional",
    },
    sound: {
      pack: { id: "moss", revision: 1, status: "provisional" },
      scale: { id: "__fallback", revision: 1, status: "provisional" },
    },
    environment: {
      id: "first-crossing-extreme-altitude-clouds",
      revision: 1,
      status: "provisional",
    },
    transmissionSet: {
      id: PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID,
      revision: 1,
      status: "provisional",
    },
    ...overrides,
  };
}

function runtimePolicy(runId: string) {
  return {
    thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
    transmissions: {
      definitionSetId: PROVISIONAL_FIRST_CROSSING_TRANSMISSION_SET_ID,
      seed: `binding-test:${runId}`,
      definitions: [],
      admissionChance: 1,
      minGapSeconds: 0,
    },
  } as const;
}

function manualTime() {
  let now = 0;
  const source: FirstCrossingTimeSource = () => now;
  return {
    source,
    advance(seconds: number) {
      now += seconds;
    },
  };
}

describe("SYS-009 immutable authored binding", () => {
  it("is detached, deeply immutable, and explicitly versioned", () => {
    const source = authoredBinding();
    const composition = source.composition as Record<string, unknown>;
    const binding = defineFirstCrossingBinding(source);
    composition.baseLaps = 99;
    source.revision = 2;

    expect(binding.revision).toBe(1);
    expect(binding.composition.baseLaps).toBe(10);
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.composition)).toBe(true);
    expect(Object.isFrozen(binding.composition.macroCycleDuration)).toBe(true);
    expect(Object.isFrozen(binding.sound)).toBe(true);
    expect(Object.isFrozen(binding.sound.pack)).toBe(true);
  });

  it("keeps authored route identity distinct from runtime run identity", () => {
    const withRunId = authoredBinding({ runId: "must-not-leak" });
    const issues = validateFirstCrossingBinding(withRunId);

    expect(issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "binding.runId" })]),
    );
    expect(() => defineFirstCrossingBinding(withRunId)).toThrow("run identity");
    expect("runId" in PROVISIONAL_FIRST_CROSSING_BINDING).toBe(false);
  });

  it("resolves the same authored revision to the same CompositionSnapshot", () => {
    const first = resolveProvisionalFirstCrossingBinding();
    const second = resolveProvisionalFirstCrossingBinding();

    expect(first.compositionSnapshot).toEqual(second.compositionSnapshot);
    expect(first.compositionSnapshot.id).toBe("first-crossing:phase-align-rings");
    expect(first.compositionSnapshot.revision).toBe(1);
  });

  it("retains CompositionSnapshot as the only resolved structural music authority", () => {
    const resolved = resolveProvisionalFirstCrossingBinding();

    expect(resolved.compositionSnapshot.voices.length).toBe(8);
    expect(resolved.authored.composition.engineId).toBe("phaseAlignRings");
    expect("events" in resolved.authored).toBe(false);
    expect("phaseZero" in resolved.authored).toBe(false);
    expect("musicalTime" in resolved.authored).toBe(false);
  });

  it("cannot mutate resolved macro timing through caller-owned binding input", () => {
    const source = authoredBinding();
    const composition = source.composition as Record<string, unknown>;
    const resolved = resolveFirstCrossingBinding(source, PROVISIONAL_FIRST_CROSSING_RESOLVERS);
    composition.macroCycleDuration = 99;

    expect(resolved.authored.composition.macroCycleDuration).toEqual({
      secondsNumerator: 30n,
      secondsDenominator: 1n,
    });
    expect(resolved.compositionSnapshot.macroCycleDuration).toEqual({
      secondsNumerator: 30n,
      secondsDenominator: 1n,
    });
  });

  it("fails closed on broken route, content, and presentation references", () => {
    expect(() =>
      resolveFirstCrossingBinding(
        authoredBinding({ routeDefinitionId: "route-missing" }),
        PROVISIONAL_FIRST_CROSSING_RESOLVERS,
      ),
    ).toThrow("cannot resolve route");

    const brokenSound = authoredBinding();
    brokenSound.sound = {
      pack: { id: "missing-pack", revision: 1, status: "provisional" },
      scale: { id: "__fallback", revision: 1, status: "provisional" },
    };
    expect(() =>
      resolveFirstCrossingBinding(brokenSound, PROVISIONAL_FIRST_CROSSING_RESOLVERS),
    ).toThrow("cannot resolve sound-pack");

    const incompatible = authoredBinding({
      composition: {
        ...(authoredBinding().composition as Record<string, unknown>),
        engineId: "stringNet",
      },
    });
    expect(() =>
      resolveFirstCrossingBinding(incompatible, PROVISIONAL_FIRST_CROSSING_RESOLVERS),
    ).toThrow("cannot present composition engine");
  });

  it("requires development selections to remain explicitly provisional", () => {
    const promotedEnvironment = authoredBinding({
      environment: {
        id: "first-crossing-extreme-altitude-clouds",
        revision: 1,
        status: "accepted",
      },
    });
    expect(() =>
      resolveFirstCrossingBinding(promotedEnvironment, PROVISIONAL_FIRST_CROSSING_RESOLVERS),
    ).toThrow("must remain explicitly provisional");

    const resolved = resolveProvisionalFirstCrossingBinding();
    expect(resolved.authored.status).toBe("provisional");
    expect(resolved.authored.triggerEnginePresentation.status).toBe("provisional");
    expect(resolved.environment.source).toBe("development");
    expect(resolved.transmissionSet?.source).toBe("development");
  });

  it("leaves a previously resolved revision unchanged when a new revision is authored", () => {
    const first = resolveProvisionalFirstCrossingBinding();
    const second = resolveFirstCrossingBinding(
      authoredBinding({
        revision: 2,
        composition: {
          ...(authoredBinding().composition as Record<string, unknown>),
          revision: 2,
          baseLaps: 12,
        },
      }),
      PROVISIONAL_FIRST_CROSSING_RESOLVERS,
    );

    expect(first.authored.revision).toBe(1);
    expect(first.compositionSnapshot.baseLaps).toBe(10);
    expect(second.authored.revision).toBe(2);
    expect(second.compositionSnapshot.baseLaps).toBe(12);
  });
});

describe("SYS-009 to SYS-008 boundary", () => {
  it("configures a fresh coordinator without placing authored binding state inside it", () => {
    const resolved = resolveProvisionalFirstCrossingBinding();
    const config = coordinatorConfigFromFirstCrossingBinding(
      resolved,
      "runtime-run-a",
      runtimePolicy("runtime-run-a"),
    );
    const coordinator = createFirstCrossingCoordinator(config);

    expect(coordinator.identity).toEqual({
      runId: "runtime-run-a",
      routeDefinitionId: resolved.authored.routeDefinitionId,
    });
    expect("binding" in coordinator.snapshot()).toBe(false);
    expect("composition" in coordinator.snapshot()).toBe(false);
    expect("bindingId" in coordinator.snapshot().session).toBe(false);
  });

  it("allows multiple runtime runs to share one authored binding", () => {
    const resolved = resolveProvisionalFirstCrossingBinding();
    const firstTime = manualTime();
    const secondTime = manualTime();
    const first = createFirstCrossingCoordinator(
      coordinatorConfigFromFirstCrossingBinding(resolved, "run-one", runtimePolicy("run-one")),
      { timeSource: firstTime.source },
    );
    const second = createFirstCrossingCoordinator(
      coordinatorConfigFromFirstCrossingBinding(resolved, "run-two", runtimePolicy("run-two")),
      { timeSource: secondTime.source },
    );
    first.start();
    second.start();
    firstTime.advance(10);
    secondTime.advance(5);

    expect(first.sample().snapshot.identity.runId).toBe("run-one");
    expect(second.sample().snapshot.identity.runId).toBe("run-two");
    expect(first.snapshot().identity.routeDefinitionId).toBe(
      second.snapshot().identity.routeDefinitionId,
    );
  });

  it("introduces no clock, journey state, scheduler, movement, rendering, or audio owner", () => {
    const resolved = resolveProvisionalFirstCrossingBinding();
    const forbidden = [
      "engineClock",
      "clock",
      "timeSource",
      "journeyTime",
      "crossingProgress",
      "scheduler",
      "movement",
      "renderer",
      "audioContext",
      "play",
    ];

    for (const key of forbidden) {
      expect(key in resolved.authored).toBe(false);
      expect(key in resolved).toBe(false);
    }
  });

  it("keeps crystallization absent and rejects it as an unknown production field", () => {
    const resolved = resolveProvisionalFirstCrossingBinding();
    expect("crystallization" in resolved.authored).toBe(false);
    expect("crystallization" in resolved).toBe(false);
    expect(() =>
      defineFirstCrossingBinding(authoredBinding({ crystallization: { enabled: true } })),
    ).toThrow("not part of the binding contract");
  });
});
