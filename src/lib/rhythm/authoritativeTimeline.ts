/**
 * Exact musical event authority for the Reset reconciliation.
 *
 * Musical position is an exact rational number of macro-cycles. Events are
 * identified by integer voice indices and occur at exact
 * `voiceEventIndex / eventsPerMacroCycle` relationships. There is no musical
 * ticks-per-second value or arbitrary tick grid in this model.
 *
 * Floating-point normalized phases are derived for rendering only. They never
 * decide whether an event exists or where an event boundary lies.
 */

export type ExactMacroPosition = Readonly<{
  numerator: bigint;
  denominator: bigint;
}>;

export type RhythmVoiceDefinition = Readonly<{
  id: string;
  eventsPerMacroCycle: number;
}>;

export type RhythmCompositionDefinition = Readonly<{
  id: string;
  version: number;
  voices: readonly RhythmVoiceDefinition[];
}>;

export type ExactRhythmPhase = Readonly<{
  numerator: bigint;
  denominator: bigint;
  /** Derived projection for rendering/display only; never event authority. */
  normalizedForRendering: number;
}>;

export type RhythmVoiceSnapshot = Readonly<{
  id: string;
  voiceOrder: number;
  absoluteEventIndex: bigint;
  eventInMacroCycle: number;
  phase: ExactRhythmPhase;
  nextEventMacroPosition: ExactMacroPosition;
}>;

export type RhythmTimelineSnapshot = Readonly<{
  compositionId: string;
  compositionVersion: number;
  macroPosition: ExactMacroPosition;
  macroCycleIndex: bigint;
  macroPhase: ExactRhythmPhase;
  isPhaseZero: boolean;
  voices: readonly RhythmVoiceSnapshot[];
}>;

export type AuthoritativeRhythmEvent = Readonly<{
  id: string;
  compositionId: string;
  compositionVersion: number;
  macroPosition: ExactMacroPosition;
  macroCycleIndex: bigint;
  macroPhase: ExactRhythmPhase;
  voiceId: string;
  voiceOrder: number;
  voiceEventIndex: bigint;
  eventInMacroCycle: number;
  isPhaseZero: boolean;
}>;

export type AuthoritativeRhythmTimeline = Readonly<{
  definition: RhythmCompositionDefinition;
  snapshotAt(position: ExactMacroPosition): RhythmTimelineSnapshot;
  /** Enumerate every event in the exact half-open interval [start, end). */
  eventsBetween(
    start: ExactMacroPosition,
    end: ExactMacroPosition,
  ): readonly AuthoritativeRhythmEvent[];
}>;

/** Create a reduced, non-negative exact macro-cycle position. */
export function exactMacroPosition(numerator: bigint, denominator = 1n): ExactMacroPosition {
  if (numerator < 0n) throw new RangeError("Macro position must be non-negative.");
  if (denominator <= 0n) throw new RangeError("Macro position denominator must be positive.");
  const divisor = greatestCommonDivisor(numerator, denominator);
  return Object.freeze({
    numerator: numerator / divisor,
    denominator: denominator / divisor,
  });
}

export function compareMacroPositions(left: ExactMacroPosition, right: ExactMacroPosition): number {
  const leftScaled = left.numerator * right.denominator;
  const rightScaled = right.numerator * left.denominator;
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

/**
 * Build an immutable, side-effect-free musical timeline.
 *
 * Voice array order is the deterministic tie-breaker for simultaneous events.
 */
export function createAuthoritativeRhythmTimeline(
  input: RhythmCompositionDefinition,
): AuthoritativeRhythmTimeline {
  const definition = validateAndFreezeDefinition(input);

  return Object.freeze({
    definition,

    snapshotAt(positionInput: ExactMacroPosition): RhythmTimelineSnapshot {
      const position = exactMacroPosition(positionInput.numerator, positionInput.denominator);
      const macroCycleIndex = position.numerator / position.denominator;
      const macroRemainder = position.numerator % position.denominator;
      const voiceSnapshots = definition.voices.map((voice, voiceOrder) => {
        const eventCount = BigInt(voice.eventsPerMacroCycle);
        const scaledPosition = position.numerator * eventCount;
        const absoluteEventIndex = scaledPosition / position.denominator;
        const voiceRemainder = scaledPosition % position.denominator;

        return Object.freeze({
          id: voice.id,
          voiceOrder,
          absoluteEventIndex,
          eventInMacroCycle: Number(absoluteEventIndex % eventCount),
          phase: exactPhase(voiceRemainder, position.denominator),
          nextEventMacroPosition: exactMacroPosition(absoluteEventIndex + 1n, eventCount),
        });
      });

      return Object.freeze({
        compositionId: definition.id,
        compositionVersion: definition.version,
        macroPosition: position,
        macroCycleIndex,
        macroPhase: exactPhase(macroRemainder, position.denominator),
        isPhaseZero: macroRemainder === 0n,
        voices: Object.freeze(voiceSnapshots),
      });
    },

    eventsBetween(
      startInput: ExactMacroPosition,
      endInput: ExactMacroPosition,
    ): readonly AuthoritativeRhythmEvent[] {
      const start = exactMacroPosition(startInput.numerator, startInput.denominator);
      const end = exactMacroPosition(endInput.numerator, endInput.denominator);
      if (compareMacroPositions(end, start) <= 0) return Object.freeze([]);

      const events: AuthoritativeRhythmEvent[] = [];
      definition.voices.forEach((voice, voiceOrder) => {
        const eventCount = BigInt(voice.eventsPerMacroCycle);
        const firstEventIndex = ceilDiv(start.numerator * eventCount, start.denominator);
        const endEventIndex = ceilDiv(end.numerator * eventCount, end.denominator);

        for (
          let voiceEventIndex = firstEventIndex;
          voiceEventIndex < endEventIndex;
          voiceEventIndex += 1n
        ) {
          const eventInMacroCycle = voiceEventIndex % eventCount;
          events.push(
            Object.freeze({
              id: eventIdentity(definition, voice.id, voiceEventIndex),
              compositionId: definition.id,
              compositionVersion: definition.version,
              macroPosition: exactMacroPosition(voiceEventIndex, eventCount),
              macroCycleIndex: voiceEventIndex / eventCount,
              macroPhase: exactPhase(eventInMacroCycle, eventCount),
              voiceId: voice.id,
              voiceOrder,
              voiceEventIndex,
              eventInMacroCycle: Number(eventInMacroCycle),
              isPhaseZero: eventInMacroCycle === 0n,
            }),
          );
        }
      });

      events.sort(
        (left, right) =>
          compareMacroPositions(left.macroPosition, right.macroPosition) ||
          left.voiceOrder - right.voiceOrder,
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
    return Object.freeze({
      id: voice.id,
      eventsPerMacroCycle: voice.eventsPerMacroCycle,
    });
  });

  return Object.freeze({
    id: input.id,
    version: input.version,
    voices: Object.freeze(voices),
  });
}

function exactPhase(numerator: bigint, denominator: bigint): ExactRhythmPhase {
  const reduced = exactMacroPosition(numerator, denominator);
  return Object.freeze({
    ...reduced,
    normalizedForRendering: rationalToRenderingNumber(reduced),
  });
}

function eventIdentity(
  definition: RhythmCompositionDefinition,
  voiceId: string,
  voiceEventIndex: bigint,
): string {
  return [
    "rhythm-event:v2",
    `${encodeURIComponent(definition.id)}@${definition.version}`,
    encodeURIComponent(voiceId),
    voiceEventIndex.toString(),
  ].join(":");
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left;
  let b = right;
  while (b !== 0n) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return a === 0n ? 1n : a;
}

function rationalToRenderingNumber(value: ExactMacroPosition): number {
  const precision = 1_000_000_000_000n;
  return Number((value.numerator * precision) / value.denominator) / Number(precision);
}
