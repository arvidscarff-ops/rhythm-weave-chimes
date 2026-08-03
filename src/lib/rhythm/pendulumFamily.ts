import {
  REFERENCE_TICKS_PER_SECOND,
  type ReferenceComposition,
  type ReferenceVoiceDefinition,
} from "./referenceAuthority.ts";

/**
 * Reset R4.1 Pendulum Fan fixture.
 *
 * This independently authored PHASE prototype preserves the useful fan
 * geometry from the pre-Reset scene while replacing its accumulated-seconds
 * authority with the exact R3 tick/event model.
 *
 * The 28.8288-second duration is intentional: its integer microtick count is
 * divisible by every subdivision from 8 through 16, so all nine voices close
 * exactly without floating-point boundary detection.
 */
export const R4_PENDULUM_MACRO_TICKS = 28_828_800n;
export const R4_PENDULUM_TARGET_DISTANCE = 0.78;

const PROVISIONAL_REFERENCE_HZ = 432;
const SUBDIVISIONS = [8, 9, 10, 11, 12, 13, 14, 15, 16] as const;
const SEMITONE_OFFSETS = [-17, -12, -7, -3, 0, 4, 7, 12, 16] as const;

function provisionalFixtureFrequency(semitonesFromA4: number): number {
  return PROVISIONAL_REFERENCE_HZ * 2 ** (semitonesFromA4 / 12);
}

const voices: ReferenceVoiceDefinition[] = SUBDIVISIONS.map((subdivisions, index) => ({
  id: `pendulum-${subdivisions}`,
  subdivisions,
  frequencyHz: provisionalFixtureFrequency(SEMITONE_OFFSETS[index]),
  hue: 176 + index * 12,
}));

export const R4_PENDULUM_COMPOSITION: ReferenceComposition = {
  id: "r4-pendulum-fan",
  version: 1,
  macroCycleTicks: R4_PENDULUM_MACRO_TICKS,
  voices,
};

export type PendulumStrandDefinition = {
  voiceId: string;
  angle: number;
  order: number;
};

/**
 * Left-to-right visual order. The fastest voice remains on the left, matching
 * the useful ordering of the preserved Pendulum Fan scene.
 */
export const R4_PENDULUM_STRANDS: readonly PendulumStrandDefinition[] = [
  ...R4_PENDULUM_COMPOSITION.voices,
]
  .reverse()
  .map((voice, order, orderedVoices) => ({
    voiceId: voice.id,
    angle:
      ((order - (orderedVoices.length - 1) / 2) / (orderedVoices.length - 1)) * (Math.PI * 0.55),
    order,
  }));

export function pendulumDistanceAtPhase(phase: number): number {
  const wrappedPhase = ((phase % 1) + 1) % 1;
  return 0.5 + (R4_PENDULUM_TARGET_DISTANCE - 0.5) * Math.cos(wrappedPhase * Math.PI * 2);
}

export function pendulumMacroSeconds(): number {
  return Number(R4_PENDULUM_MACRO_TICKS) / Number(REFERENCE_TICKS_PER_SECOND);
}
