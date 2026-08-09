import {
  projectFrameSource,
  projectVoice,
  type TriggerFamilyAuthorityInput,
  type TriggerFamilyFrameSource,
} from "./triggerFamilyConsumer";

export const R4_PENDULUM_TARGET_DISTANCE = 0.78;

export type PendulumStrandDefinition = Readonly<{
  voiceId: string;
  hue: number;
  angle: number;
  order: number;
}>;

export type PendulumStrandState = PendulumStrandDefinition &
  Readonly<{
    phaseForRendering: number;
    distance: number;
    authoritativeEventIds: readonly string[];
    hasPhaseZeroEvent: boolean;
  }>;

export type PendulumFamilyFrame = Readonly<{
  source: TriggerFamilyFrameSource;
  strands: readonly PendulumStrandState[];
}>;

const PENDULUM_EVENT_COUNTS = [16, 15, 14, 13, 12, 11, 10, 9, 8] as const;

/** Fastest-to-slowest, left-to-right fan geometry preserved from Reset R4.1. */
export const R4_PENDULUM_STRANDS: readonly PendulumStrandDefinition[] = Object.freeze(
  PENDULUM_EVENT_COUNTS.map((eventCount, order, orderedVoices) =>
    Object.freeze({
      voiceId: `rate-${eventCount}`,
      hue: 176 + (orderedVoices.length - 1 - order) * 12,
      angle:
        ((order - (orderedVoices.length - 1) / 2) / (orderedVoices.length - 1)) * (Math.PI * 0.55),
      order,
    }),
  ),
);

export function pendulumDistanceAtPhase(phaseForRendering: number): number {
  const wrappedPhase = ((phaseForRendering % 1) + 1) % 1;
  return 0.5 + (R4_PENDULUM_TARGET_DISTANCE - 0.5) * Math.cos(wrappedPhase * Math.PI * 2);
}

/** Derive Pendulum geometry exclusively from injected authoritative state. */
export function derivePendulumFrame(input: TriggerFamilyAuthorityInput): PendulumFamilyFrame {
  const strands = R4_PENDULUM_STRANDS.map((definition) => {
    const voice = projectVoice(input, definition.voiceId);
    return Object.freeze({
      ...definition,
      phaseForRendering: voice.phaseForRendering,
      distance: pendulumDistanceAtPhase(voice.phaseForRendering),
      authoritativeEventIds: voice.authoritativeEventIds,
      hasPhaseZeroEvent: voice.hasPhaseZeroEvent,
    });
  });

  return Object.freeze({
    source: projectFrameSource(input.snapshot),
    strands: Object.freeze(strands),
  });
}
