import type { CompositionSnapshot } from "./compositionSnapshot";
import {
  PRODUCTION_PHASE_ALIGNED_ENGINE_IDS,
  productionEngineIdFromSnapshot,
  type ProductionPhaseAlignedEngineId,
} from "./productionComposition";
import type { CompositionRevisionSession } from "./productionRhythmBridge";
import {
  compareTransportSeconds,
  normalizeTransportInput,
  subtractTransportSeconds,
  transportSecondsToNumber,
  type TransportPositionInput,
} from "./liveTimelineAdapter";

export type RootGatewayTopologyControl = "density" | "note-count" | "fixed";

export type RootGatewayEnginePresentation = Readonly<{
  id: ProductionPhaseAlignedEngineId;
  label: string;
  short: string;
  topologyControl: RootGatewayTopologyControl;
}>;

const ENGINE_PRESENTATION_BY_ID: Readonly<
  Record<ProductionPhaseAlignedEngineId, RootGatewayEnginePresentation>
> = Object.freeze({
  stringNet: Object.freeze({
    id: "stringNet",
    label: "String Network",
    short: "STR",
    topologyControl: "density",
  }),
  pendulumFan: Object.freeze({
    id: "pendulumFan",
    label: "Pendulum Fan",
    short: "PEN",
    topologyControl: "density",
  }),
  spiralArp: Object.freeze({
    id: "spiralArp",
    label: "Spiral Arpeggiator",
    short: "SPI",
    topologyControl: "density",
  }),
  radialSweep: Object.freeze({
    id: "radialSweep",
    label: "Radial Sweep",
    short: "RAD",
    topologyControl: "density",
  }),
  mandalaMatrix: Object.freeze({
    id: "mandalaMatrix",
    label: "Mandala Matrix",
    short: "MND",
    topologyControl: "density",
  }),
  metatronLattice: Object.freeze({
    id: "metatronLattice",
    label: "Metatron Lattice",
    short: "MTN",
    topologyControl: "fixed",
  }),
  fractalNebula: Object.freeze({
    id: "fractalNebula",
    label: "Fractal Nebula",
    short: "NEB",
    topologyControl: "fixed",
  }),
  radialResonator: Object.freeze({
    id: "radialResonator",
    label: "Radial Resonator",
    short: "RES",
    topologyControl: "fixed",
  }),
  phaseAlignRings: Object.freeze({
    id: "phaseAlignRings",
    label: "Phase-Align Rings",
    short: "PHZ",
    topologyControl: "note-count",
  }),
  voidSheets: Object.freeze({
    id: "voidSheets",
    label: "Void Sheets",
    short: "VOD",
    topologyControl: "note-count",
  }),
});

/** The root gateway exposes only engines that consume the production authority. */
export const ROOT_GATEWAY_ENGINES: readonly RootGatewayEnginePresentation[] = Object.freeze(
  PRODUCTION_PHASE_ALIGNED_ENGINE_IDS.map((id) => ENGINE_PRESENTATION_BY_ID[id]),
);

export function rootGatewayEnginePresentation(
  engineId: ProductionPhaseAlignedEngineId,
): RootGatewayEnginePresentation {
  return ENGINE_PRESENTATION_BY_ID[engineId];
}

export type RootGatewayStructuralState = Readonly<{
  engineId: ProductionPhaseAlignedEngineId;
  label: string;
  short: string;
  revision: number;
  voiceCount: number;
  baseLaps: number;
  macroCycleSeconds: number;
  density: number;
  configuredNoteCount: number;
}>;

export type RootGatewayPendingState = RootGatewayStructuralState &
  Readonly<{
    musicalSecondsUntilActivation: number;
  }>;

export type RootGatewayRuntimePresentation = Readonly<{
  active: RootGatewayStructuralState;
  pending: RootGatewayPendingState | null;
}>;

export type RootGatewayCompositionConfig = Readonly<{
  density: number;
  noteCount: number;
}>;

function structuralState(
  snapshot: CompositionSnapshot,
  configForRevision: (revision: number) => RootGatewayCompositionConfig | undefined,
): RootGatewayStructuralState {
  const engineId = productionEngineIdFromSnapshot(snapshot);
  const presentation = rootGatewayEnginePresentation(engineId);
  const config = configForRevision(snapshot.revision);
  if (!config)
    throw new Error(`Missing root gateway configuration for revision ${snapshot.revision}.`);
  return Object.freeze({
    engineId,
    label: presentation.label,
    short: presentation.short,
    revision: snapshot.revision,
    voiceCount: snapshot.voices.length,
    baseLaps: snapshot.baseLaps,
    macroCycleSeconds: transportSecondsToNumber(snapshot.macroCycleDuration),
    density: config.density,
    configuredNoteCount: config.noteCount,
  });
}

/**
 * Pure UI projection of the authoritative revision session. The supplied
 * transport position is read-only and is used only for approximate feedback;
 * it never advances or activates the musical session.
 */
export function presentRootGatewayRuntime(
  session: CompositionRevisionSession,
  suppliedPositionInput: TransportPositionInput,
  configForRevision: (revision: number) => RootGatewayCompositionConfig | undefined,
): RootGatewayRuntimePresentation {
  const suppliedPosition = normalizeTransportInput(suppliedPositionInput);
  const active = structuralState(session.active.composition, configForRevision);
  const pending = session.pending;
  if (!pending) return Object.freeze({ active, pending: null });

  const remaining =
    compareTransportSeconds(suppliedPosition, pending.activatesAt) >= 0
      ? 0
      : transportSecondsToNumber(subtractTransportSeconds(pending.activatesAt, suppliedPosition));
  return Object.freeze({
    active,
    pending: Object.freeze({
      ...structuralState(pending.authority.composition, configForRevision),
      musicalSecondsUntilActivation: remaining,
    }),
  });
}
