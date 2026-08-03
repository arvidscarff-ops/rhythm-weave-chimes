import {
  REFERENCE_TICKS_PER_SECOND,
  type ReferenceComposition,
  type ReferenceVoiceDefinition,
} from "./referenceAuthority.ts";

/**
 * Reset R4.3 Resonant String Network candidate.
 *
 * Each voice travels along one fixed quadratic string and returns to its
 * designated trigger anchor at phase zero. String crossings are visual
 * relationships only and never create musical events.
 */
export const R4_STRING_NETWORK_MACRO_TICKS = 24n * REFERENCE_TICKS_PER_SECOND;

const PROVISIONAL_REFERENCE_HZ = 432;
const SUBDIVISIONS = [4, 5, 6, 8, 10, 12] as const;
const SEMITONE_OFFSETS = [-17, -12, -7, -2, 3, 8] as const;

function provisionalFixtureFrequency(semitonesFromA4: number): number {
  return PROVISIONAL_REFERENCE_HZ * 2 ** (semitonesFromA4 / 12);
}

const voices: ReferenceVoiceDefinition[] = SUBDIVISIONS.map((subdivisions, index) => ({
  id: `string-${subdivisions}`,
  subdivisions,
  frequencyHz: provisionalFixtureFrequency(SEMITONE_OFFSETS[index]),
  hue: 176 + index * 18,
}));

export const R4_STRING_NETWORK_COMPOSITION: ReferenceComposition = {
  id: "r4-resonant-string-network",
  version: 1,
  macroCycleTicks: R4_STRING_NETWORK_MACRO_TICKS,
  voices,
};

export type StringNetworkPoint = {
  x: number;
  y: number;
};

export type StringVoiceGeometry = {
  voiceId: string;
  from: StringNetworkPoint;
  to: StringNetworkPoint;
  bow: number;
  order: number;
};

const ANCHORS = {
  northwest: { x: -0.72, y: -0.4 },
  north: { x: -0.08, y: -0.76 },
  northeast: { x: 0.7, y: -0.34 },
  southeast: { x: 0.66, y: 0.5 },
  south: { x: 0.04, y: 0.76 },
  southwest: { x: -0.68, y: 0.46 },
} as const;

const STRING_PATHS = [
  { from: ANCHORS.northwest, to: ANCHORS.southeast, bow: -0.14 },
  { from: ANCHORS.north, to: ANCHORS.southwest, bow: 0.18 },
  { from: ANCHORS.northeast, to: ANCHORS.south, bow: -0.16 },
  { from: ANCHORS.southeast, to: ANCHORS.north, bow: 0.12 },
  { from: ANCHORS.south, to: ANCHORS.northwest, bow: -0.2 },
  { from: ANCHORS.southwest, to: ANCHORS.northeast, bow: 0.15 },
] as const;

export const R4_STRING_NETWORK_GEOMETRY: readonly StringVoiceGeometry[] =
  R4_STRING_NETWORK_COMPOSITION.voices.map((voice, order) => ({
    voiceId: voice.id,
    ...STRING_PATHS[order],
    order,
  }));

export function stringControlPoint(
  geometry: Pick<StringVoiceGeometry, "from" | "to" | "bow">,
): StringNetworkPoint {
  const dx = geometry.to.x - geometry.from.x;
  const dy = geometry.to.y - geometry.from.y;
  return {
    x: (geometry.from.x + geometry.to.x) * 0.5 - dy * geometry.bow,
    y: (geometry.from.y + geometry.to.y) * 0.5 + dx * geometry.bow,
  };
}

export function stringPointAtPhase(
  geometry: Pick<StringVoiceGeometry, "from" | "to" | "bow">,
  phase: number,
): StringNetworkPoint {
  const wrappedPhase = ((phase % 1) + 1) % 1;
  const travel = (1 - Math.cos(wrappedPhase * Math.PI * 2)) * 0.5;
  const inverse = 1 - travel;
  const control = stringControlPoint(geometry);

  return {
    x:
      inverse * inverse * geometry.from.x +
      2 * inverse * travel * control.x +
      travel * travel * geometry.to.x,
    y:
      inverse * inverse * geometry.from.y +
      2 * inverse * travel * control.y +
      travel * travel * geometry.to.y,
  };
}

export function stringNetworkMacroSeconds(): number {
  return Number(R4_STRING_NETWORK_MACRO_TICKS) / Number(REFERENCE_TICKS_PER_SECOND);
}
