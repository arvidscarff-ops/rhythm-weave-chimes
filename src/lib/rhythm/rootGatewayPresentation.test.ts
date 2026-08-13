import { describe, expect, it } from "vitest";
import {
  advanceCompositionRevisionSession,
  createCompositionRevisionSession,
  queueCompositionRevision,
} from "./productionRhythmBridge";
import {
  createProductionCompositionSnapshot,
  productionEngineIdFromSnapshot,
  type ProductionPhaseAlignedEngineId,
} from "./productionComposition";
import {
  ROOT_GATEWAY_ENGINES,
  presentRootGatewayRuntime,
  rootGatewayEnginePresentation,
} from "./rootGatewayPresentation";

const config = (density: number, noteCount: number) => Object.freeze({ density, noteCount });

function composition(
  revision: number,
  engineId: ProductionPhaseAlignedEngineId,
  density = 5,
  noteCount = 8,
) {
  return createProductionCompositionSnapshot({
    compositionId: "root-gateway-test",
    revision,
    engineId,
    macroCycleDuration: 10,
    baseLaps: 4,
    density,
    noteCount,
  });
}

describe("root gateway authoritative presentation", () => {
  it("exposes every selectable root engine through the production composition authority", () => {
    expect(ROOT_GATEWAY_ENGINES).toHaveLength(10);
    for (const engine of ROOT_GATEWAY_ENGINES) {
      const initial = createCompositionRevisionSession(composition(1, "stringNet"));
      const snapshot = composition(2, engine.id);
      const queued = queueCompositionRevision(initial, snapshot, 2);
      const before = presentRootGatewayRuntime(queued, 3, (revision) => config(revision, 8));
      const activated = advanceCompositionRevisionSession(queued, 9, 11);

      expect(productionEngineIdFromSnapshot(snapshot)).toBe(engine.id);
      expect(snapshot.voices.length).toBeGreaterThan(0);
      expect(before.active.engineId).toBe("stringNet");
      expect(before.pending?.engineId).toBe(engine.id);
      expect(productionEngineIdFromSnapshot(activated.session.active.composition)).toBe(engine.id);
      expect(activated.input.events.some((event) => event.compositionRevision === 2)).toBe(true);
    }
    expect(ROOT_GATEWAY_ENGINES.some((engine) => engine.id === ("custom" as never))).toBe(false);
  });

  it("reports the active revision and requested revision separately before Phase Zero", () => {
    const configs = new Map([
      [1, config(5, 8)],
      [2, config(7, 12)],
    ]);
    const queued = queueCompositionRevision(
      createCompositionRevisionSession(composition(1, "stringNet")),
      composition(2, "phaseAlignRings", 7, 12),
      2,
    );
    const presentation = presentRootGatewayRuntime(queued, 4, (revision) => configs.get(revision));

    expect(presentation.active).toMatchObject({
      engineId: "stringNet",
      revision: 1,
      voiceCount: 12,
    });
    expect(presentation.pending).toMatchObject({
      engineId: "phaseAlignRings",
      revision: 2,
      voiceCount: 12,
      musicalSecondsUntilActivation: 6,
    });
  });

  it("switches the authoritative readout at the exact boundary with the same revision as events", () => {
    const configs = new Map([
      [1, config(5, 8)],
      [2, config(6, 8)],
    ]);
    const queued = queueCompositionRevision(
      createCompositionRevisionSession(composition(1, "stringNet")),
      composition(2, "spiralArp", 6),
      3,
    );
    const before = presentRootGatewayRuntime(queued, 9, (revision) => configs.get(revision));
    const advanced = advanceCompositionRevisionSession(queued, 9, 11);
    const atBoundary = presentRootGatewayRuntime(advanced.session, 10, (revision) =>
      configs.get(revision),
    );

    expect(before.active.engineId).toBe("stringNet");
    expect(before.pending?.engineId).toBe("spiralArp");
    expect(atBoundary.active.engineId).toBe("spiralArp");
    expect(atBoundary.active.revision).toBe(2);
    expect(atBoundary.active.voiceCount).toBe(5);
    expect(atBoundary.pending).toBeNull();
    expect(advanced.input.composition.revision).toBe(2);
    const activatedEvents = advanced.input.events.filter(
      (event) => event.compositionRevision === 2,
    );
    expect(activatedEvents.length).toBeGreaterThan(0);
    expect(activatedEvents.every((event) => event.authoritativeEvent.isPhaseZero)).toBe(true);
  });

  it("replaces repeated pending requests deterministically without mutating the active revision", () => {
    const configs = new Map([
      [1, config(5, 8)],
      [2, config(6, 8)],
      [3, config(9, 8)],
    ]);
    const initial = createCompositionRevisionSession(composition(1, "stringNet"));
    const firstRequest = queueCompositionRevision(initial, composition(2, "pendulumFan", 6), 2);
    const repeatedRequest = queueCompositionRevision(
      firstRequest,
      composition(3, "radialSweep", 9),
      3,
    );
    const before = presentRootGatewayRuntime(repeatedRequest, 3, (revision) =>
      configs.get(revision),
    );
    const activated = advanceCompositionRevisionSession(repeatedRequest, 9, 10);

    expect(before.active.engineId).toBe("stringNet");
    expect(before.pending?.engineId).toBe("radialSweep");
    expect(before.pending?.revision).toBe(3);
    expect(activated.session.active.composition.revision).toBe(3);
    expect(productionEngineIdFromSnapshot(activated.session.active.composition)).toBe(
      "radialSweep",
    );
  });

  it("classifies topology controls without fabricating universal note semantics", () => {
    expect(rootGatewayEnginePresentation("stringNet").topologyControl).toBe("density");
    expect(rootGatewayEnginePresentation("spiralArp").topologyControl).toBe("density");
    expect(rootGatewayEnginePresentation("metatronLattice").topologyControl).toBe("fixed");
    expect(rootGatewayEnginePresentation("phaseAlignRings").topologyControl).toBe("note-count");
    expect(rootGatewayEnginePresentation("voidSheets").topologyControl).toBe("note-count");
    expect(composition(1, "phaseAlignRings", 5, 8).voices).toHaveLength(8);
    expect(composition(1, "phaseAlignRings", 5, 12).voices).toHaveLength(12);
    expect(composition(1, "voidSheets", 5, 8).voices).toHaveLength(8);
    expect(composition(1, "voidSheets", 5, 12).voices).toHaveLength(12);
    expect(composition(1, "spiralArp", 4).voices).toHaveLength(4);
    expect(composition(1, "spiralArp", 8).voices).toHaveLength(6);
  });
});
