/**
 * Pure integer rhythm timeline for the Reset reconciliation.
 *
 * This module projects a caller-supplied musical position into exact cycle
 * state and deterministic events. It deliberately does not read a platform
 * clock, own transport state, schedule audio, or render geometry. The current
 * `engineClock` therefore remains the application's only live rhythm clock
 * until a later migration explicitly connects the two layers.
 *
 * Tick duration is intentionally caller-defined. This preserves the exact
 * integer relationships proven by R3 without prematurely resolving the
 * Project Bible's open production time-representation decision.
 */

export type RhythmTick = bigint;

export type RhythmVoiceDefinition = Readonly<{
  id: string;
  /** Number of evenly spaced event boundaries within one macro-cycle. */
  eventsPerMacroCycle: number;
}>;

export type RhythmCompositionDefinition = Readonly<{
  id: string;
  version: number;
  macroCycleTicks: RhythmTick;
  voices: readonly RhythmVoiceDefinition[];
}>;

/** Exact cycle position plus a normalized rendering-boundary projection. */
export type ExactRhythmPhase = Readonly<{
  cycleTick: RhythmTick;
  cycleLengthTicks: RhythmTick;
  normalized: number;
}>;

export type RhythmVoiceSnapshot = Readonly<{
  id: string;
  voiceOrder: number;
  phase: ExactRhythmPhase;
  eventIndex: bigint;
  nextEventTick: RhythmTick;
}>;

export type RhythmTimelineSnapshot = Readonly<{
  compositionId: string;
  compositionVersion: number;
  positionTick: RhythmTick;
  macroCycleIndex: bigint;
  macroPhase: ExactRhythmPhase;
  isPhaseZero: boolean;
  voices: readonly RhythmVoiceSnapshot[];
}>;

export type AuthoritativeRhythmEvent = Readonly<{
  id: string;
  compositionId: string;
  compositionVersion: number;
  tick: RhythmTick;
  macroCycleIndex: bigint;
  macroTick: RhythmTick;
  voiceId: string;
  voiceOrder: number;
  voiceEventIndex: bigint;
  eventInMacroCycle: number;
  isPhaseZero: boolean;
}>;

export type AuthoritativeRhythmTimeline = Readonly<{
  definition: RhythmCompositionDefinition;
  snapshotAt(positionTick: RhythmTick): RhythmTimelineSnapshot;
  /** Enumerate every event in the half-open interval [startTick, endTick). */
  eventsBetween(startTick: RhythmTick, endTick: RhythmTick): readonly AuthoritativeRhythmEvent[];
}>;

/**
 * Build an immutable, side-effect-free timeline projection.
 *
 * Voice array order is meaningful: it is the deterministic tie-breaker when
 * multiple voices share the same event tick.
 */
export function createAuthoritativeRhythmTimeline(
  input: RhythmCompositionDefinition,
): AuthoritativeRhythmTimeline {
  const definition = validateAndFreezeDefinition(input);
  const voices = definition.voices.map((voice, voiceOrder) => {
    const spacingTicks = definition.macroCycleTicks / BigInt(voice.eventsPerMacroCycle);
    return Object.freeze({ voice, voiceOrder, spacingTicks });
  });

  return Object.freeze({
    definition,

    snapshotAt(positionTick: RhythmTick): RhythmTimelineSnapshot {
      assertNonNegativeTick(positionTick, "positionTick");
      const macroTick = positionTick % definition.macroCycleTicks;
      const voiceSnapshots = voices.map(({ voice, voiceOrder, spacingTicks }) => {
        const voiceTick = positionTick % spacingTicks;
        const eventIndex = positionTick / spacingTicks;
        return Object.freeze({
          id: voice.id,
          voiceOrder,
          phase: exactPhase(voiceTick, spacingTicks),
          eventIndex,
          nextEventTick: (eventIndex + 1n) * spacingTicks,
        });
      });

      return Object.freeze({
        compositionId: definition.id,
        compositionVersion: definition.version,
        positionTick,
        macroCycleIndex: positionTick / definition.macroCycleTicks,
        macroPhase: exactPhase(macroTick, definition.macroCycleTicks),
        isPhaseZero: macroTick === 0n,
        voices: Object.freeze(voiceSnapshots),
      });
    },

    eventsBetween(startTick: RhythmTick, endTick: RhythmTick): readonly AuthoritativeRhythmEvent[] {
      assertNonNegativeTick(startTick, "startTick");
      assertNonNegativeTick(endTick, "endTick");
      if (endTick <= startTick) return Object.freeze([]);

      const events: AuthoritativeRhythmEvent[] = [];
      for (const { voice, voiceOrder, spacingTicks } of voices) {
        const firstEventIndex = ceilDiv(startTick, spacingTicks);
        const endEventIndex = ceilDiv(endTick, spacingTicks);

        for (
          let voiceEventIndex = firstEventIndex;
          voiceEventIndex < endEventIndex;
          voiceEventIndex += 1n
        ) {
          const tick = voiceEventIndex * spacingTicks;
          const macroTick = tick % definition.macroCycleTicks;
          events.push(
            Object.freeze({
              id: eventIdentity(definition, tick, voice.id, voiceEventIndex),
              compositionId: definition.id,
              compositionVersion: definition.version,
              tick,
              macroCycleIndex: tick / definition.macroCycleTicks,
              macroTick,
              voiceId: voice.id,
              voiceOrder,
              voiceEventIndex,
              eventInMacroCycle: Number(macroTick / spacingTicks),
              isPhaseZero: macroTick === 0n,
            }),
          );
        }
      }

      events.sort(
        (left, right) => compareTicks(left.tick, right.tick) || left.voiceOrder - right.voiceOrder,
      );
      return Object.freeze(events);
    },
  });
}

function validateAndFreezeDefinition(
  input: RhythmCompositionDefinition,
): RhythmCompositionDefinition {
  if (input.id.trim().length === 0) {
    throw new Error("Rhythm composition requires a non-empty id.");
  }
  if (!Number.isSafeInteger(input.version) || input.version < 0) {
    throw new Error("Rhythm composition version must be a non-negative safe integer.");
  }
  if (input.macroCycleTicks <= 0n) {
    throw new Error("Rhythm composition requires a positive macro-cycle.");
  }
  if (input.voices.length === 0) {
    throw new Error("Rhythm composition requires at least one voice.");
  }

  const voiceIds = new Set<string>();
  const voices = input.voices.map((voice) => {
    if (voice.id.trim().length === 0) {
      throw new Error("Rhythm voices require non-empty ids.");
    }
    if (voiceIds.has(voice.id)) {
      throw new Error(`Rhythm voice id must be unique: ${voice.id}`);
    }
    voiceIds.add(voice.id);

    if (!Number.isSafeInteger(voice.eventsPerMacroCycle) || voice.eventsPerMacroCycle <= 0) {
      throw new Error(`Voice ${voice.id} requires a positive safe-integer event count.`);
    }
    if (input.macroCycleTicks % BigInt(voice.eventsPerMacroCycle) !== 0n) {
      throw new Error(`Voice ${voice.id} does not divide the macro-cycle exactly.`);
    }

    return Object.freeze({
      id: voice.id,
      eventsPerMacroCycle: voice.eventsPerMacroCycle,
    });
  });

  return Object.freeze({
    id: input.id,
    version: input.version,
    macroCycleTicks: input.macroCycleTicks,
    voices: Object.freeze(voices),
  });
}

function exactPhase(cycleTick: RhythmTick, cycleLengthTicks: RhythmTick): ExactRhythmPhase {
  return Object.freeze({
    cycleTick,
    cycleLengthTicks,
    normalized: ratioToNormalizedNumber(cycleTick, cycleLengthTicks),
  });
}

function eventIdentity(
  definition: RhythmCompositionDefinition,
  tick: RhythmTick,
  voiceId: string,
  voiceEventIndex: bigint,
): string {
  return [
    "rhythm-event:v1",
    `${encodeURIComponent(definition.id)}@${definition.version}`,
    tick.toString(),
    encodeURIComponent(voiceId),
    voiceEventIndex.toString(),
  ].join(":");
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

function compareTicks(left: RhythmTick, right: RhythmTick): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertNonNegativeTick(value: RhythmTick, name: string): void {
  if (value < 0n) throw new RangeError(`${name} must be non-negative.`);
}

function ratioToNormalizedNumber(numerator: bigint, denominator: bigint): number {
  // Keep the BigInt ratio canonical. This bounded projection is only for
  // consumers such as renderers that need a number in [0, 1).
  const precision = 1_000_000_000_000n;
  return Number((numerator * precision) / denominator) / Number(precision);
}
