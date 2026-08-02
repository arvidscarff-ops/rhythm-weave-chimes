/**
 * Reset R3 reference rhythm authority.
 *
 * This is a deliberately narrow proof of PHASE's accepted timing invariants,
 * not a selection of the unresolved production time/audio architecture. It
 * uses integer microticks so the reference fixture can prove exact boundaries,
 * deterministic event identity, frame-rate independence, and reconstruction.
 */

export type MusicalTick = bigint;

export const REFERENCE_TICKS_PER_SECOND = 1_000_000n;

export type ReferenceVoiceDefinition = {
  id: string;
  subdivisions: number;
  frequencyHz: number;
  hue: number;
};

export type ReferenceComposition = {
  id: string;
  version: number;
  macroCycleTicks: MusicalTick;
  voices: readonly ReferenceVoiceDefinition[];
};

export type ReferenceRhythmEvent = {
  id: string;
  compositionId: string;
  compositionVersion: number;
  tick: MusicalTick;
  macroCycleIndex: bigint;
  voiceId: string;
  voiceEventIndex: bigint;
  eventInMacro: number;
  isPhaseZero: boolean;
  frequencyHz: number;
  hue: number;
};

export type ReferenceVoiceSnapshot = {
  id: string;
  phase: number;
  eventIndex: bigint;
  nextEventTick: MusicalTick;
  frequencyHz: number;
  hue: number;
};

export type ReferenceRhythmSnapshot = {
  positionTick: MusicalTick;
  macroCycleIndex: bigint;
  macroPhase: number;
  isPhaseZero: boolean;
  voices: ReferenceVoiceSnapshot[];
};

/**
 * Fixed R3 verification fixture.
 *
 * The 12-second macro-cycle divides exactly into 4, 5, and 6 events. The
 * frequencies use the documented provisional A4=432 Hz engineering
 * interpretation only for this fixture; they do not resolve temperament.
 */
export const R3_REFERENCE_COMPOSITION: ReferenceComposition = {
  id: "r3-one-crossing",
  version: 1,
  macroCycleTicks: 12n * REFERENCE_TICKS_PER_SECOND,
  voices: [
    { id: "low", subdivisions: 4, frequencyHz: 128.43, hue: 188 },
    { id: "middle", subdivisions: 5, frequencyHz: 192.43, hue: 214 },
    { id: "high", subdivisions: 6, frequencyHz: 288.33, hue: 257 },
  ],
};

export type TickSource = () => MusicalTick;

export function performanceTickSource(): MusicalTick {
  const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
  return BigInt(Math.round(nowMs * 1_000));
}

export class ReferenceTransport {
  private readonly source: TickSource;
  private anchorSourceTick: MusicalTick;
  private anchorPositionTick = 0n;
  private playing = false;

  constructor(source: TickSource = performanceTickSource) {
    this.source = source;
    this.anchorSourceTick = source();
  }

  isPlaying(): boolean {
    return this.playing;
  }

  positionTick(): MusicalTick {
    if (!this.playing) return this.anchorPositionTick;
    return this.anchorPositionTick + nonNegative(this.source() - this.anchorSourceTick);
  }

  play(): void {
    if (this.playing) return;
    this.anchorSourceTick = this.source();
    this.playing = true;
  }

  pause(): void {
    if (!this.playing) return;
    this.anchorPositionTick = this.positionTick();
    this.anchorSourceTick = this.source();
    this.playing = false;
  }

  resetPhaseZero(): void {
    this.anchorPositionTick = 0n;
    this.anchorSourceTick = this.source();
  }

  restore(positionTick: MusicalTick, playing = false): void {
    this.anchorPositionTick = nonNegative(positionTick);
    this.anchorSourceTick = this.source();
    this.playing = playing;
  }
}

export function snapshotAt(
  composition: ReferenceComposition,
  positionTick: MusicalTick,
): ReferenceRhythmSnapshot {
  validateComposition(composition);
  const position = nonNegative(positionTick);
  const macroTick = position % composition.macroCycleTicks;
  return {
    positionTick: position,
    macroCycleIndex: position / composition.macroCycleTicks,
    macroPhase: ratioToNumber(macroTick, composition.macroCycleTicks),
    isPhaseZero: macroTick === 0n,
    voices: composition.voices.map((voice) => {
      const spacing = voiceSpacing(composition, voice);
      const voiceTick = position % spacing;
      const eventIndex = position / spacing;
      return {
        id: voice.id,
        phase: ratioToNumber(voiceTick, spacing),
        eventIndex,
        nextEventTick: (eventIndex + 1n) * spacing,
        frequencyHz: voice.frequencyHz,
        hue: voice.hue,
      };
    }),
  };
}

/**
 * Return every authoritative event in the half-open interval [start, end).
 * Adjacent windows therefore neither duplicate nor omit boundary events.
 */
export function eventsBetween(
  composition: ReferenceComposition,
  startTick: MusicalTick,
  endTick: MusicalTick,
): ReferenceRhythmEvent[] {
  validateComposition(composition);
  const start = nonNegative(startTick);
  const end = nonNegative(endTick);
  if (end <= start) return [];

  const events: ReferenceRhythmEvent[] = [];
  composition.voices.forEach((voice) => {
    const spacing = voiceSpacing(composition, voice);
    const firstEventIndex = ceilDiv(start, spacing);
    const endEventIndex = ceilDiv(end, spacing);

    for (let eventIndex = firstEventIndex; eventIndex < endEventIndex; eventIndex++) {
      const tick = eventIndex * spacing;
      if (tick < start || tick >= end) continue;
      const macroTick = tick % composition.macroCycleTicks;
      const eventInMacro = Number(macroTick / spacing);
      events.push({
        id: `${composition.id}@${composition.version}:${tick}:${voice.id}:${eventIndex}`,
        compositionId: composition.id,
        compositionVersion: composition.version,
        tick,
        macroCycleIndex: tick / composition.macroCycleTicks,
        voiceId: voice.id,
        voiceEventIndex: eventIndex,
        eventInMacro,
        isPhaseZero: macroTick === 0n,
        frequencyHz: voice.frequencyHz,
        hue: voice.hue,
      });
    }
  });

  const voiceOrder = new Map(composition.voices.map((voice, index) => [voice.id, index]));
  events.sort(
    (a, b) =>
      compareTicks(a.tick, b.tick) ||
      (voiceOrder.get(a.voiceId) ?? 0) - (voiceOrder.get(b.voiceId) ?? 0),
  );
  return events;
}

export function secondsToTicks(seconds: number): MusicalTick {
  return BigInt(Math.round(Math.max(0, seconds) * Number(REFERENCE_TICKS_PER_SECOND)));
}

export function ticksToSeconds(ticks: MusicalTick): number {
  return Number(ticks) / Number(REFERENCE_TICKS_PER_SECOND);
}

function voiceSpacing(
  composition: ReferenceComposition,
  voice: ReferenceVoiceDefinition,
): MusicalTick {
  return composition.macroCycleTicks / BigInt(voice.subdivisions);
}

function validateComposition(composition: ReferenceComposition): void {
  if (composition.macroCycleTicks <= 0n) {
    throw new Error("Reference composition requires a positive macro-cycle.");
  }
  for (const voice of composition.voices) {
    if (!Number.isInteger(voice.subdivisions) || voice.subdivisions <= 0) {
      throw new Error(`Voice ${voice.id} requires a positive integer subdivision.`);
    }
    if (composition.macroCycleTicks % BigInt(voice.subdivisions) !== 0n) {
      throw new Error(`Voice ${voice.id} does not divide the reference macro-cycle exactly.`);
    }
  }
}

function ceilDiv(value: bigint, divisor: bigint): bigint {
  return (value + divisor - 1n) / divisor;
}

function ratioToNumber(numerator: bigint, denominator: bigint): number {
  return Number(numerator) / Number(denominator);
}

function compareTicks(a: bigint, b: bigint): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function nonNegative(value: bigint): bigint {
  return value < 0n ? 0n : value;
}
