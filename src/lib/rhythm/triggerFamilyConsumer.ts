import type {
  AuthoritativeRhythmEvent,
  ExactMacroPosition,
  RhythmTimelineSnapshot,
} from "./authoritativeTimeline";

/**
 * The complete authority a Trigger Engine family is allowed to consume.
 *
 * Families receive immutable musical state and events. They do not receive a
 * clock, transport, scheduler, audio context, or callback that could create a
 * musical event.
 */
export type TriggerFamilyAuthorityInput = Readonly<{
  snapshot: RhythmTimelineSnapshot;
  events: readonly AuthoritativeRhythmEvent[];
}>;

export type TriggerFamilyFrameSource = Readonly<{
  compositionId: string;
  compositionVersion: number;
  macroPosition: ExactMacroPosition;
  macroCycleIndex: bigint;
  isPhaseZero: boolean;
}>;

export type TriggerFamilyVoiceProjection = Readonly<{
  voiceId: string;
  phaseForRendering: number;
  authoritativeEventIds: readonly string[];
  hasPhaseZeroEvent: boolean;
}>;

export function projectFrameSource(snapshot: RhythmTimelineSnapshot): TriggerFamilyFrameSource {
  return Object.freeze({
    compositionId: snapshot.compositionId,
    compositionVersion: snapshot.compositionVersion,
    macroPosition: snapshot.macroPosition,
    macroCycleIndex: snapshot.macroCycleIndex,
    isPhaseZero: snapshot.isPhaseZero,
  });
}

/**
 * Project one authoritative voice into rendering-only state.
 *
 * Event identity and order are copied from the injected authority unchanged.
 * Geometry has no API through which it can add an event.
 */
export function projectVoice(
  input: TriggerFamilyAuthorityInput,
  voiceId: string,
): TriggerFamilyVoiceProjection {
  const voice = input.snapshot.voices.find((candidate) => candidate.id === voiceId);
  if (!voice) {
    throw new Error(`Trigger family requires missing authoritative voice: ${voiceId}`);
  }

  const matchingEvents = input.events.filter(
    (event) =>
      event.compositionId === input.snapshot.compositionId &&
      event.compositionVersion === input.snapshot.compositionVersion &&
      event.voiceId === voiceId,
  );

  return Object.freeze({
    voiceId,
    phaseForRendering: voice.phase.normalizedForRendering,
    authoritativeEventIds: Object.freeze(matchingEvents.map((event) => event.id)),
    hasPhaseZeroEvent: matchingEvents.some((event) => event.isPhaseZero),
  });
}
