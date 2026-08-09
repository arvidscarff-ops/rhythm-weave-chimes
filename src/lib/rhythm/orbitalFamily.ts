import {
  projectFrameSource,
  projectVoice,
  type TriggerFamilyAuthorityInput,
  type TriggerFamilyFrameSource,
} from "./triggerFamilyConsumer";

export type OrbitalPoint = Readonly<{ x: number; y: number }>;

export type OrbitalVoiceGeometry = Readonly<{
  voiceId: string;
  hue: number;
  radius: number;
  direction: 1 | -1;
  order: number;
}>;

export type OrbitalVoiceState = OrbitalVoiceGeometry &
  Readonly<{
    phaseForRendering: number;
    point: OrbitalPoint;
    authoritativeEventIds: readonly string[];
    hasPhaseZeroEvent: boolean;
  }>;

export type OrbitalFamilyFrame = Readonly<{
  source: TriggerFamilyFrameSource;
  voices: readonly OrbitalVoiceState[];
}>;

const ORBITAL_EVENT_COUNTS = [3, 4, 5, 6, 8, 10, 12, 15] as const;
const ORBITAL_RADII = [0.34, 0.5, 0.66, 0.82] as const;

/** Four restrained rings with alternating direction, preserved from R4.2. */
export const R4_ORBITAL_GEOMETRY: readonly OrbitalVoiceGeometry[] = Object.freeze(
  ORBITAL_EVENT_COUNTS.map((eventCount, order) =>
    Object.freeze({
      voiceId: `rate-${eventCount}`,
      hue: 188 + order * 11,
      radius: ORBITAL_RADII[order % ORBITAL_RADII.length],
      direction: order % 2 === 0 ? (1 as const) : (-1 as const),
      order,
    }),
  ),
);

export function orbitalPointAtPhase(
  geometry: Pick<OrbitalVoiceGeometry, "radius" | "direction">,
  phaseForRendering: number,
): OrbitalPoint {
  const wrappedPhase = ((phaseForRendering % 1) + 1) % 1;
  const angle = -Math.PI / 2 + geometry.direction * wrappedPhase * Math.PI * 2;
  return Object.freeze({
    x: Math.cos(angle) * geometry.radius,
    y: Math.sin(angle) * geometry.radius,
  });
}

/** Derive Orbital geometry exclusively from injected authoritative state. */
export function deriveOrbitalFrame(input: TriggerFamilyAuthorityInput): OrbitalFamilyFrame {
  const voices = R4_ORBITAL_GEOMETRY.map((definition) => {
    const voice = projectVoice(input, definition.voiceId);
    return Object.freeze({
      ...definition,
      phaseForRendering: voice.phaseForRendering,
      point: orbitalPointAtPhase(definition, voice.phaseForRendering),
      authoritativeEventIds: voice.authoritativeEventIds,
      hasPhaseZeroEvent: voice.hasPhaseZeroEvent,
    });
  });

  return Object.freeze({
    source: projectFrameSource(input.snapshot),
    voices: Object.freeze(voices),
  });
}
