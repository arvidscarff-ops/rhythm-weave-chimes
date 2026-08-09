import { describe, expect, it } from "vitest";
import { exactTransportSeconds } from "./liveTimelineAdapter";
import {
  createCompositionSnapshot,
  LEGACY_COMPOSITION_REVISION,
  orderedPhaseAlignedVoices,
} from "./compositionSnapshot";
import {
  createProductionCompositionSnapshot,
  voicesForEngine,
  type ProductionPhaseAlignedEngineId,
} from "./productionComposition";
import {
  createProductionRhythmAuthority,
  reconstructProductionInput,
} from "./productionRhythmBridge";

const BASE_INPUT = {
  id: "first-crossing",
  revision: 3,
  macroCycleDuration: exactTransportSeconds(30n),
  baseLaps: 10,
  orderedVoices: orderedPhaseAlignedVoices("proof", 3),
} as const;

describe("composition snapshot contract", () => {
  it("deep-freezes structural rhythm data and owns its macro duration", () => {
    const mutableDuration = { secondsNumerator: 30n, secondsDenominator: 1n };
    const mutableVoices = [
      { id: "one", phaseIndex: 0 },
      { id: "two", phaseIndex: 1 },
    ];
    const snapshot = createCompositionSnapshot({
      ...BASE_INPUT,
      macroCycleDuration: mutableDuration,
      orderedVoices: mutableVoices,
    });
    mutableDuration.secondsNumerator = 99n;
    mutableVoices[0].id = "mutated-source";

    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.macroCycleDuration)).toBe(true);
    expect(Object.isFrozen(snapshot.voices)).toBe(true);
    expect(Object.isFrozen(snapshot.voices[0])).toBe(true);
    expect(snapshot.macroCycleDuration).toEqual(exactTransportSeconds(30n));
    expect(snapshot.voices[0]).toEqual({ id: "one", eventsPerMacroCycle: 10 });
  });

  it("uses explicit numeric revisions, including the documented legacy default", () => {
    const legacy = createCompositionSnapshot({
      ...BASE_INPUT,
      revision: LEGACY_COMPOSITION_REVISION,
    });
    const revised = createCompositionSnapshot({ ...BASE_INPUT, revision: 2 });

    expect(legacy.revision).toBe(1);
    expect(revised.revision).toBe(2);
    expect(revised.voices).toEqual(legacy.voices);
  });

  it("derives event topology from every migrated engine's exported ordered voices", () => {
    const expectedCounts: Record<ProductionPhaseAlignedEngineId, number> = {
      stringNet: 12,
      pendulumFan: 8,
      spiralArp: 5,
      radialSweep: 9,
      mandalaMatrix: 12,
      metatronLattice: 25,
      fractalNebula: 50,
      radialResonator: 24,
      phaseAlignRings: 7,
      voidSheets: 7,
    };

    for (const engineId of Object.keys(expectedCounts) as ProductionPhaseAlignedEngineId[]) {
      const exportedVoices = voicesForEngine({ engineId, density: 5, noteCount: 7 });
      const snapshot = createProductionCompositionSnapshot({
        compositionId: `scene:${engineId}`,
        revision: 1,
        engineId,
        macroCycleDuration: 30,
        baseLaps: 10,
        density: 5,
        noteCount: 7,
      });

      expect(exportedVoices).toHaveLength(expectedCounts[engineId]);
      expect(snapshot.voices).toHaveLength(exportedVoices.length);
      expect(snapshot.voices.map((voice) => voice.eventsPerMacroCycle)).toEqual(
        exportedVoices.map((voice) => 10 + voice.phaseIndex),
      );
    }
  });

  it("reconstructs the same authoritative state from the same revision and position", () => {
    const snapshot = createCompositionSnapshot(BASE_INPUT);
    const first = createProductionRhythmAuthority(snapshot);
    const remounted = createProductionRhythmAuthority(snapshot);
    const position = exactTransportSeconds(91n, 10n);

    expect(reconstructProductionInput(remounted, position)).toEqual(
      reconstructProductionInput(first, position),
    );
  });
});
