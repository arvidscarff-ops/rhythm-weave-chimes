import { fractalNebulaVoiceDefinitions } from "@/lib/scenes/fractalNebula";
import { mandalaMatrixVoiceDefinitions } from "@/lib/scenes/mandalaMatrix";
import { metatronLatticeVoiceDefinitions } from "@/lib/scenes/metatronLattice";
import { pendulumFanVoiceDefinitions } from "@/lib/scenes/pendulumFan";
import { phaseAlignRingsVoiceDefinitions } from "@/lib/scenes/phaseAlignRings";
import { radialResonatorVoiceDefinitions } from "@/lib/scenes/radialResonator";
import { radialSweepVoiceDefinitions } from "@/lib/scenes/radialSweep";
import { spiralArpVoiceDefinitions } from "@/lib/scenes/spiralArp";
import { stringNetworkVoiceDefinitions } from "@/lib/scenes/stringNetwork";
import { voidSheetsVoiceDefinitions } from "@/lib/scenes/voidSheets";
import {
  createCompositionSnapshot,
  type CompositionSnapshot,
  type PhaseAlignedVoiceDefinition,
} from "./compositionSnapshot";
import type { TransportPositionInput } from "./liveTimelineAdapter";

export type ProductionPhaseAlignedEngineId =
  | "stringNet"
  | "pendulumFan"
  | "spiralArp"
  | "radialSweep"
  | "mandalaMatrix"
  | "metatronLattice"
  | "fractalNebula"
  | "radialResonator"
  | "phaseAlignRings"
  | "voidSheets";

export type ProductionCompositionInput = Readonly<{
  compositionId: string;
  revision: number;
  engineId: ProductionPhaseAlignedEngineId;
  macroCycleDuration: TransportPositionInput;
  baseLaps: number;
  density: number;
  noteCount: number;
}>;

/**
 * Construct the initial production bridge from the voice definitions exported
 * by the migrated Phase-Alignment engines themselves.
 *
 * Legacy Wheel/Pendulum/Bars and custom axis-intersection blueprints are
 * deliberately outside this bridge. String Network's Nexus contact is also
 * absent: its visual proximity effect is not an authoritative musical voice.
 */
export function createProductionCompositionSnapshot(
  input: ProductionCompositionInput,
): CompositionSnapshot {
  return createCompositionSnapshot({
    id: input.compositionId,
    revision: input.revision,
    macroCycleDuration: input.macroCycleDuration,
    baseLaps: Math.max(1, Math.floor(input.baseLaps)),
    orderedVoices: voicesForEngine(input),
  });
}

export function voicesForEngine(
  input: Pick<ProductionCompositionInput, "engineId" | "density" | "noteCount">,
): readonly PhaseAlignedVoiceDefinition[] {
  switch (input.engineId) {
    case "stringNet":
      return stringNetworkVoiceDefinitions(input.density);
    case "pendulumFan":
      return pendulumFanVoiceDefinitions(input.density);
    case "spiralArp":
      return spiralArpVoiceDefinitions(input.density);
    case "radialSweep":
      return radialSweepVoiceDefinitions(input.density);
    case "mandalaMatrix":
      return mandalaMatrixVoiceDefinitions(input.density);
    case "metatronLattice":
      return metatronLatticeVoiceDefinitions();
    case "fractalNebula":
      return fractalNebulaVoiceDefinitions();
    case "radialResonator":
      return radialResonatorVoiceDefinitions();
    case "phaseAlignRings":
      return phaseAlignRingsVoiceDefinitions(input.noteCount);
    case "voidSheets":
      return voidSheetsVoiceDefinitions(input.noteCount);
  }
}
