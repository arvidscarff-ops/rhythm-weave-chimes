import { describe, expect, it } from "vitest";
import {
  createAuthoritativeRhythmTimeline,
  exactMacroPosition,
  type RhythmCompositionDefinition,
} from "./authoritativeTimeline";

const COMPOSITION: RhythmCompositionDefinition = {
  id: "rational-reconciliation",
  version: 2,
  voices: [
    { id: "low", eventsPerMacroCycle: 4 },
    { id: "middle", eventsPerMacroCycle: 5 },
    { id: "high", eventsPerMacroCycle: 6 },
  ],
};

describe("authoritative rational rhythm timeline", () => {
  it("closes every voice exactly at every macro-cycle Phase Zero", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);

    for (const cycleIndex of [0n, 1n, 2n, 10_000_000_000_000n]) {
      const snapshot = timeline.snapshotAt(exactMacroPosition(cycleIndex));
      expect(snapshot.macroCycleIndex).toBe(cycleIndex);
      expect(snapshot.isPhaseZero).toBe(true);
      expect(snapshot.macroPhase).toEqual({
        numerator: 0n,
        denominator: 1n,
        normalizedForRendering: 0,
      });
      expect(snapshot.voices.every((voice) => voice.phase.numerator === 0n)).toBe(true);
    }

    expect(timeline.snapshotAt(exactMacroPosition(99n, 100n)).isPhaseZero).toBe(false);
  });

  it("derives stable event identity and ordering from exact integer indices", () => {
    const firstTimeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const secondTimeline = createAuthoritativeRhythmTimeline({
      ...COMPOSITION,
      voices: COMPOSITION.voices.map((voice) => ({ ...voice })),
    });
    const first = firstTimeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const second = secondTimeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(1n));

    expect(first).toEqual(second);
    expect(first).toEqual(
      firstTimeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(1n)),
    );
    expect(new Set(first.map((event) => event.id)).size).toBe(first.length);
    expect(first.slice(0, 3).map((event) => event.voiceId)).toEqual(["low", "middle", "high"]);
    expect(first[0]?.id).toBe("rhythm-event:v2:rational-reconciliation@2:low:0");

    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1];
      const current = first[index];
      const ordered =
        current.macroPosition.numerator * previous.macroPosition.denominator >
          previous.macroPosition.numerator * current.macroPosition.denominator ||
        (current.macroPosition.numerator * previous.macroPosition.denominator ===
          previous.macroPosition.numerator * current.macroPosition.denominator &&
          current.voiceOrder > previous.voiceOrder);
      expect(ordered).toBe(true);
    }
  });

  it("uses exact half-open boundaries without duplicates or omissions at Phase Zero", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const first = timeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const second = timeline.eventsBetween(exactMacroPosition(1n), exactMacroPosition(2n));
    const whole = timeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(2n));
    const joined = [...first, ...second];

    expect(first).toHaveLength(15);
    expect(second).toHaveLength(15);
    expect(joined.map((event) => event.id)).toEqual(whole.map((event) => event.id));
    expect(new Set(joined.map((event) => event.id)).size).toBe(joined.length);
    expect(first.some((event) => event.macroCycleIndex === 1n)).toBe(false);
    expect(second.slice(0, 3).every((event) => event.isPhaseZero)).toBe(true);
    expect(second.slice(0, 3).every((event) => event.macroCycleIndex === 1n)).toBe(true);
  });

  it("derives smooth rendering phase without using it as event authority", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const position = exactMacroPosition(1n, 3n);
    const before = timeline.eventsBetween(exactMacroPosition(0n), position);
    const snapshot = timeline.snapshotAt(position);

    expect(snapshot.macroPhase.numerator).toBe(1n);
    expect(snapshot.macroPhase.denominator).toBe(3n);
    expect(snapshot.macroPhase.normalizedForRendering).toBeCloseTo(1 / 3, 10);
    expect(snapshot.voices[0]?.phase).toEqual({
      numerator: 1n,
      denominator: 3n,
      normalizedForRendering: expect.closeTo(1 / 3, 10),
    });
    expect(timeline.eventsBetween(exactMacroPosition(0n), position)).toEqual(before);
  });
});
