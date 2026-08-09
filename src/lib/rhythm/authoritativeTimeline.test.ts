import { describe, expect, it } from "vitest";
import {
  createAuthoritativeRhythmTimeline,
  type RhythmCompositionDefinition,
} from "./authoritativeTimeline";

const MACRO_CYCLE_TICKS = 12_000_000n;

const COMPOSITION: RhythmCompositionDefinition = {
  id: "r3-reconciliation",
  version: 1,
  macroCycleTicks: MACRO_CYCLE_TICKS,
  voices: [
    { id: "low", eventsPerMacroCycle: 4 },
    { id: "middle", eventsPerMacroCycle: 5 },
    { id: "high", eventsPerMacroCycle: 6 },
  ],
};

describe("authoritative rhythm timeline", () => {
  it("closes every voice exactly at every macro-cycle Phase Zero", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);

    for (const cycleIndex of [0n, 1n, 2n, 10_000n]) {
      const snapshot = timeline.snapshotAt(MACRO_CYCLE_TICKS * cycleIndex);
      expect(snapshot.macroCycleIndex).toBe(cycleIndex);
      expect(snapshot.isPhaseZero).toBe(true);
      expect(snapshot.macroPhase).toEqual({
        cycleTick: 0n,
        cycleLengthTicks: MACRO_CYCLE_TICKS,
        normalized: 0,
      });
      expect(snapshot.voices.every((voice) => voice.phase.cycleTick === 0n)).toBe(true);
      expect(snapshot.voices.every((voice) => voice.phase.normalized === 0)).toBe(true);
    }

    expect(timeline.snapshotAt(MACRO_CYCLE_TICKS - 1n).isPhaseZero).toBe(false);
  });

  it("produces stable event identities and a deterministic tie-break order", () => {
    const firstTimeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const secondTimeline = createAuthoritativeRhythmTimeline({
      ...COMPOSITION,
      voices: COMPOSITION.voices.map((voice) => ({ ...voice })),
    });
    const first = firstTimeline.eventsBetween(0n, MACRO_CYCLE_TICKS);
    const second = secondTimeline.eventsBetween(0n, MACRO_CYCLE_TICKS);

    expect(first).toEqual(second);
    expect(new Set(first.map((event) => event.id)).size).toBe(first.length);
    expect(first.slice(0, 3).map((event) => event.voiceId)).toEqual(["low", "middle", "high"]);
    expect(first[0]?.id).toBe("rhythm-event:v1:r3-reconciliation@1:0:low:0");

    for (let index = 1; index < first.length; index += 1) {
      const previous = first[index - 1];
      const current = first[index];
      expect(
        current.tick > previous.tick ||
          (current.tick === previous.tick && current.voiceOrder > previous.voiceOrder),
      ).toBe(true);
    }
  });

  it("uses half-open windows without duplicates, omissions, or frame-cadence dependence", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const duration = MACRO_CYCLE_TICKS * 3n;
    const whole = timeline.eventsBetween(0n, duration);
    const split = 6_000_000n;
    const adjacent = [
      ...timeline.eventsBetween(0n, split),
      ...timeline.eventsBetween(split, duration),
    ];

    expect(adjacent.map((event) => event.id)).toEqual(whole.map((event) => event.id));
    expect(new Set(adjacent.map((event) => event.id)).size).toBe(adjacent.length);

    const enumerateInWindows = (windowSizes: readonly bigint[]) => {
      const ids: string[] = [];
      let cursor = 0n;
      let windowIndex = 0;
      while (cursor < duration) {
        const size = windowSizes[windowIndex % windowSizes.length];
        const end = cursor + size > duration ? duration : cursor + size;
        ids.push(...timeline.eventsBetween(cursor, end).map((event) => event.id));
        cursor = end;
        windowIndex += 1;
      }
      return ids;
    };

    expect(enumerateInWindows([16_667n])).toEqual(
      enumerateInWindows([400_000n, 9_000n, 1_200_000n, 33_000n, 2_700_000n, 71_000n]),
    );
    expect(enumerateInWindows([16_667n])).toEqual(whole.map((event) => event.id));
  });

  it("reconstructs exact state beyond Number's safe-integer duration", () => {
    const timeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const distantCycleIndex = 10_000_000_000_000n;
    const cycleStart = MACRO_CYCLE_TICKS * distantCycleIndex;
    const position = cycleStart + 2_400_001n;

    expect(position).toBeGreaterThan(BigInt(Number.MAX_SAFE_INTEGER));

    const firstSnapshot = timeline.snapshotAt(position);
    const reconstructedTimeline = createAuthoritativeRhythmTimeline(COMPOSITION);
    const reconstructedSnapshot = reconstructedTimeline.snapshotAt(position);

    expect(reconstructedSnapshot).toEqual(firstSnapshot);
    expect(firstSnapshot.macroCycleIndex).toBe(distantCycleIndex);
    expect(firstSnapshot.macroPhase.cycleTick).toBe(2_400_001n);
    expect(firstSnapshot.voices.map((voice) => voice.eventIndex)).toEqual([
      position / 3_000_000n,
      position / 2_400_000n,
      position / 2_000_000n,
    ]);

    const distantEvents = timeline.eventsBetween(cycleStart, cycleStart + MACRO_CYCLE_TICKS);
    expect(distantEvents).toHaveLength(15);
    expect(distantEvents.slice(0, 3).map((event) => event.voiceId)).toEqual([
      "low",
      "middle",
      "high",
    ]);
    expect(distantEvents.slice(0, 3).every((event) => event.isPhaseZero)).toBe(true);
  });
});
