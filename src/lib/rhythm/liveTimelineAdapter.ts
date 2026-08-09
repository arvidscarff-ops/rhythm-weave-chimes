import {
  createAuthoritativeRhythmTimeline,
  exactMacroPosition,
  type AuthoritativeRhythmEvent,
  type AuthoritativeRhythmTimeline,
  type ExactMacroPosition,
  type RhythmCompositionDefinition,
  type RhythmTimelineSnapshot,
} from "./authoritativeTimeline";

/**
 * Exact physical transport time in seconds.
 *
 * This is an adapter-boundary representation of supplied clock time, not a
 * musical tick grid. Its numerator/denominator preserve the supplied exact
 * value and never define musical event spacing or claim source-clock precision.
 */
export type ExactTransportSeconds = Readonly<{
  secondsNumerator: bigint;
  secondsDenominator: bigint;
}>;

export type TransportPositionInput = number | ExactTransportSeconds;

export type LiveTimelineAdapter = Readonly<{
  timeline: AuthoritativeRhythmTimeline;
  macroCycleDuration: ExactTransportSeconds;
  macroPositionAt(position: TransportPositionInput): ExactMacroPosition;
  snapshotAt(position: TransportPositionInput): RhythmTimelineSnapshot;
  eventsBetween(
    start: TransportPositionInput,
    end: TransportPositionInput,
  ): readonly AuthoritativeRhythmEvent[];
}>;

export type LiveTimelineAdapterDefinition = Readonly<{
  composition: RhythmCompositionDefinition;
  macroCycleDuration: TransportPositionInput;
}>;

/** Build a pure bridge from supplied physical transport time to musical state. */
export function createLiveTimelineAdapter(
  input: LiveTimelineAdapterDefinition,
): LiveTimelineAdapter {
  const timeline = createAuthoritativeRhythmTimeline(input.composition);
  const macroCycleDuration = normalizeTransportInput(input.macroCycleDuration);
  if (macroCycleDuration.secondsNumerator === 0n) {
    throw new RangeError("Macro-cycle duration must be positive.");
  }

  const macroPositionAt = (positionInput: TransportPositionInput): ExactMacroPosition => {
    const position = normalizeTransportInput(positionInput);
    return exactMacroPosition(
      position.secondsNumerator * macroCycleDuration.secondsDenominator,
      position.secondsDenominator * macroCycleDuration.secondsNumerator,
    );
  };

  return Object.freeze({
    timeline,
    macroCycleDuration,
    macroPositionAt,
    snapshotAt(position: TransportPositionInput): RhythmTimelineSnapshot {
      return timeline.snapshotAt(macroPositionAt(position));
    },
    eventsBetween(
      start: TransportPositionInput,
      end: TransportPositionInput,
    ): readonly AuthoritativeRhythmEvent[] {
      return timeline.eventsBetween(macroPositionAt(start), macroPositionAt(end));
    },
  });
}

/** Create reduced exact physical seconds from supplied source units. */
export function exactTransportSeconds(
  secondsNumerator: bigint,
  secondsDenominator = 1n,
): ExactTransportSeconds {
  if (secondsNumerator < 0n) throw new RangeError("Transport position must be non-negative.");
  if (secondsDenominator <= 0n) {
    throw new RangeError("Transport position denominator must be positive.");
  }
  const divisor = greatestCommonDivisor(secondsNumerator, secondsDenominator);
  return Object.freeze({
    secondsNumerator: secondsNumerator / divisor,
    secondsDenominator: secondsDenominator / divisor,
  });
}

/**
 * Preserve the shortest decimal representation exposed by a number-valued
 * transport. This does not manufacture a finer physical clock resolution.
 */
export function transportSecondsFromNumber(seconds: number): ExactTransportSeconds {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError("Transport seconds must be a finite non-negative number.");
  }

  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(seconds.toString());
  if (!match) throw new Error("Unable to represent supplied transport seconds exactly.");

  const whole = match[1];
  const fraction = match[2] ?? "";
  const exponent = Number(match[3] ?? 0) - fraction.length;
  let numerator = BigInt(`${whole}${fraction}`);
  let denominator = 1n;
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator = 10n ** BigInt(-exponent);
  return exactTransportSeconds(numerator, denominator);
}

export function normalizeTransportInput(input: TransportPositionInput): ExactTransportSeconds {
  return typeof input === "number"
    ? transportSecondsFromNumber(input)
    : exactTransportSeconds(input.secondsNumerator, input.secondsDenominator);
}

export function compareTransportSeconds(
  leftInput: TransportPositionInput,
  rightInput: TransportPositionInput,
): number {
  const left = normalizeTransportInput(leftInput);
  const right = normalizeTransportInput(rightInput);
  const leftScaled = left.secondsNumerator * right.secondsDenominator;
  const rightScaled = right.secondsNumerator * left.secondsDenominator;
  return leftScaled < rightScaled ? -1 : leftScaled > rightScaled ? 1 : 0;
}

export function addTransportSeconds(
  leftInput: TransportPositionInput,
  rightInput: TransportPositionInput,
): ExactTransportSeconds {
  const left = normalizeTransportInput(leftInput);
  const right = normalizeTransportInput(rightInput);
  return exactTransportSeconds(
    left.secondsNumerator * right.secondsDenominator +
      right.secondsNumerator * left.secondsDenominator,
    left.secondsDenominator * right.secondsDenominator,
  );
}

export function subtractTransportSeconds(
  leftInput: TransportPositionInput,
  rightInput: TransportPositionInput,
): ExactTransportSeconds {
  const left = normalizeTransportInput(leftInput);
  const right = normalizeTransportInput(rightInput);
  const numerator =
    left.secondsNumerator * right.secondsDenominator -
    right.secondsNumerator * left.secondsDenominator;
  if (numerator < 0n) throw new RangeError("Transport subtraction cannot produce negative time.");
  return exactTransportSeconds(numerator, left.secondsDenominator * right.secondsDenominator);
}

export function multiplyTransportSeconds(
  input: TransportPositionInput,
  multiplier: bigint,
): ExactTransportSeconds {
  if (multiplier < 0n) throw new RangeError("Transport multiplier must be non-negative.");
  const value = normalizeTransportInput(input);
  return exactTransportSeconds(value.secondsNumerator * multiplier, value.secondsDenominator);
}

/** Derived number projection for transport/audio APIs; never musical authority. */
export function transportSecondsToNumber(input: TransportPositionInput): number {
  const value = normalizeTransportInput(input);
  return Number(value.secondsNumerator) / Number(value.secondsDenominator);
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
