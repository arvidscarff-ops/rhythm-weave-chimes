import {
  REFERENCE_TICKS_PER_SECOND,
  type ReferenceComposition,
  type ReferenceVoiceDefinition,
} from "./referenceAuthority.ts";

/**
 * Reset R4.2 Orbital Sweep candidate.
 *
 * This transforms the useful fixed-gate behavior of the pre-Reset Radial
 * Sweep into a restrained four-orbit system. Events occur at the exact north
 * gate; rendered contact is only their geometric expression.
 */
export const R4_ORBITAL_MACRO_TICKS = 24n * REFERENCE_TICKS_PER_SECOND;

const PROVISIONAL_REFERENCE_HZ = 432;
const SUBDIVISIONS = [3, 4, 5, 6, 8, 10, 12, 15] as const;
const SEMITONE_OFFSETS = [-19, -12, -7, -2, 2, 5, 9, 14] as const;
const RADII = [0.34, 0.5, 0.66, 0.82] as const;

function provisionalFixtureFrequency(semitonesFromA4: number): number {
  return PROVISIONAL_REFERENCE_HZ * 2 ** (semitonesFromA4 / 12);
}

const voices: ReferenceVoiceDefinition[] = SUBDIVISIONS.map((subdivisions, index) => ({
  id: `orbital-${subdivisions}`,
  subdivisions,
  frequencyHz: provisionalFixtureFrequency(SEMITONE_OFFSETS[index]),
  hue: 188 + index * 11,
}));

export const R4_ORBITAL_COMPOSITION: ReferenceComposition = {
  id: "r4-orbital-sweep",
  version: 1,
  macroCycleTicks: R4_ORBITAL_MACRO_TICKS,
  voices,
};

export type OrbitalVoiceGeometry = {
  voiceId: string;
  radius: number;
  direction: 1 | -1;
  order: number;
};

export const R4_ORBITAL_GEOMETRY: readonly OrbitalVoiceGeometry[] =
  R4_ORBITAL_COMPOSITION.voices.map((voice, order) => ({
    voiceId: voice.id,
    radius: RADII[order % RADII.length],
    direction: order % 2 === 0 ? 1 : -1,
    order,
  }));

export function orbitalPointAtPhase(
  geometry: Pick<OrbitalVoiceGeometry, "radius" | "direction">,
  phase: number,
): { x: number; y: number } {
  const wrappedPhase = ((phase % 1) + 1) % 1;
  const angle = -Math.PI / 2 + geometry.direction * wrappedPhase * Math.PI * 2;
  return {
    x: Math.cos(angle) * geometry.radius,
    y: Math.sin(angle) * geometry.radius,
  };
}

export function orbitalMacroSeconds(): number {
  return Number(R4_ORBITAL_MACRO_TICKS) / Number(REFERENCE_TICKS_PER_SECOND);
}
