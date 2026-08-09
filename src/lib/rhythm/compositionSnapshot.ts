import { lapsFor } from "@/lib/engine/phaseAlign";
import type { RhythmCompositionDefinition, RhythmVoiceDefinition } from "./authoritativeTimeline";
import {
  exactTransportSeconds,
  normalizeTransportInput,
  type ExactTransportSeconds,
  type TransportPositionInput,
} from "./liveTimelineAdapter";

/** Ordered input exported by a migrated Phase-Alignment engine. */
export type PhaseAlignedVoiceDefinition = Readonly<{
  id: string;
  phaseIndex: number;
}>;

export type CompositionSnapshot = Readonly<{
  id: string;
  revision: number;
  macroCycleDuration: ExactTransportSeconds;
  baseLaps: number;
  voices: readonly RhythmVoiceDefinition[];
}>;

export type CompositionSnapshotInput = Readonly<{
  id: string;
  revision: number;
  macroCycleDuration: TransportPositionInput;
  baseLaps: number;
  orderedVoices: readonly PhaseAlignedVoiceDefinition[];
}>;

/** Explicit bridge value for stored scenes that predate numeric revisions. */
export const LEGACY_COMPOSITION_REVISION = 1;

export function orderedPhaseAlignedVoices(
  engineId: string,
  phaseIndices: number | readonly number[],
): readonly PhaseAlignedVoiceDefinition[] {
  const indices =
    typeof phaseIndices === "number"
      ? Array.from({ length: phaseIndices }, (_, index) => index)
      : [...phaseIndices];
  return Object.freeze(
    indices.map((phaseIndex, order) => {
      if (!Number.isSafeInteger(phaseIndex) || phaseIndex < 0) {
        throw new RangeError("Phase-aligned voice indices must be non-negative safe integers.");
      }
      return Object.freeze({ id: `${engineId}:voice:${order}`, phaseIndex });
    }),
  );
}

/**
 * Capture all structural rhythm inputs once. Backdrop/default values may feed
 * this constructor, but cannot alter the returned snapshot afterwards.
 */
export function createCompositionSnapshot(input: CompositionSnapshotInput): CompositionSnapshot {
  if (input.id.trim().length === 0) throw new Error("Composition snapshot requires an id.");
  if (!Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw new Error("Composition revision must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(input.baseLaps) || input.baseLaps <= 0) {
    throw new Error("Composition base laps must be a positive safe integer.");
  }
  if (input.orderedVoices.length === 0) {
    throw new Error("Composition snapshot requires at least one ordered voice.");
  }

  const duration = normalizeTransportInput(input.macroCycleDuration);
  if (duration.secondsNumerator === 0n) {
    throw new Error("Composition macro-cycle duration must be positive.");
  }
  const ids = new Set<string>();
  const voices = input.orderedVoices.map((voice) => {
    if (voice.id.trim().length === 0 || ids.has(voice.id)) {
      throw new Error(`Composition voice ids must be non-empty and unique: ${voice.id}`);
    }
    ids.add(voice.id);
    return Object.freeze({
      id: voice.id,
      eventsPerMacroCycle: lapsFor(voice.phaseIndex, input.baseLaps),
    });
  });

  return Object.freeze({
    id: input.id,
    revision: input.revision,
    macroCycleDuration: exactTransportSeconds(
      duration.secondsNumerator,
      duration.secondsDenominator,
    ),
    baseLaps: input.baseLaps,
    voices: Object.freeze(voices),
  });
}

export function compositionTimelineDefinition(
  snapshot: CompositionSnapshot,
): RhythmCompositionDefinition {
  return Object.freeze({
    id: snapshot.id,
    version: snapshot.revision,
    voices: snapshot.voices,
  });
}
