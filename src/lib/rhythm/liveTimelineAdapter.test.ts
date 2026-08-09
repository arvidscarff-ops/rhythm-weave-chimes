import { describe, expect, it } from "vitest";
import {
  createLiveTimelineAdapter,
  exactTransportSeconds,
  transportSecondsFromNumber,
  type ExactTransportSeconds,
} from "./liveTimelineAdapter";

const DEFINITION = {
  composition: {
    id: "live-rational-proof",
    version: 1,
    voices: [
      { id: "four", eventsPerMacroCycle: 4 },
      { id: "five", eventsPerMacroCycle: 5 },
      { id: "six", eventsPerMacroCycle: 6 },
    ],
  },
  macroCycleDuration: exactTransportSeconds(12n),
} as const;

const addSeconds = (
  left: ExactTransportSeconds,
  right: ExactTransportSeconds,
): ExactTransportSeconds =>
  exactTransportSeconds(
    left.secondsNumerator * right.secondsDenominator +
      right.secondsNumerator * left.secondsDenominator,
    left.secondsDenominator * right.secondsDenominator,
  );

describe("live timeline adapter", () => {
  it("reconstructs identical musical state from identical supplied positions", () => {
    const first = createLiveTimelineAdapter(DEFINITION);
    const remounted = createLiveTimelineAdapter(DEFINITION);
    const position = exactTransportSeconds(37n, 2n);

    expect(first.snapshotAt(position)).toEqual(first.snapshotAt(position));
    expect(remounted.snapshotAt(position)).toEqual(first.snapshotAt(position));
  });

  it("maps exact macro-cycle boundaries to exact Phase Zero", () => {
    const adapter = createLiveTimelineAdapter(DEFINITION);

    for (const cycleIndex of [0n, 1n, 2n, 1_000_000_000_000n]) {
      const seconds = exactTransportSeconds(cycleIndex * 12n);
      const snapshot = adapter.snapshotAt(seconds);
      expect(snapshot.macroCycleIndex).toBe(cycleIndex);
      expect(snapshot.isPhaseZero).toBe(true);
      expect(snapshot.macroPosition).toEqual({ numerator: cycleIndex, denominator: 1n });
    }
  });

  it("freezes on repeated pause/background input and resumes from the preserved position", () => {
    const adapter = createLiveTimelineAdapter(DEFINITION);
    const beforePause = adapter.snapshotAt(exactTransportSeconds(5n));
    const duringPause = adapter.snapshotAt(exactTransportSeconds(5n));
    const afterResume = adapter.snapshotAt(exactTransportSeconds(7n));

    expect(duringPause).toEqual(beforePause);
    expect(afterResume.macroPosition).toEqual({ numerator: 7n, denominator: 12n });
    expect(afterResume.macroPosition).not.toEqual(beforePause.macroPosition);
  });

  it("produces cadence-independent identity and order", () => {
    const adapter = createLiveTimelineAdapter(DEFINITION);
    const duration = exactTransportSeconds(36n);

    const enumerate = (windowSizes: readonly ExactTransportSeconds[]) => {
      const ids: string[] = [];
      let cursor = exactTransportSeconds(0n);
      let index = 0;
      while (
        cursor.secondsNumerator * duration.secondsDenominator <
        duration.secondsNumerator * cursor.secondsDenominator
      ) {
        const candidate = addSeconds(cursor, windowSizes[index % windowSizes.length]);
        const end =
          candidate.secondsNumerator * duration.secondsDenominator >
          duration.secondsNumerator * candidate.secondsDenominator
            ? duration
            : candidate;
        ids.push(...adapter.eventsBetween(cursor, end).map((event) => event.id));
        cursor = end;
        index += 1;
      }
      return ids;
    };

    const steady = enumerate([exactTransportSeconds(1n, 60n)]);
    const jittery = enumerate([
      exactTransportSeconds(2n, 5n),
      exactTransportSeconds(9n, 1000n),
      exactTransportSeconds(6n, 5n),
      exactTransportSeconds(33n, 1000n),
      exactTransportSeconds(27n, 10n),
      exactTransportSeconds(71n, 1000n),
    ]);
    const whole = adapter.eventsBetween(exactTransportSeconds(0n), duration);

    expect(steady).toEqual(jittery);
    expect(steady).toEqual(whole.map((event) => event.id));
  });

  it("has no duplicates or omissions across half-open macro boundaries", () => {
    const adapter = createLiveTimelineAdapter(DEFINITION);
    const first = adapter.eventsBetween(0, 12);
    const second = adapter.eventsBetween(12, 24);
    const whole = adapter.eventsBetween(0, 24);
    const joined = [...first, ...second];

    expect(joined.map((event) => event.id)).toEqual(whole.map((event) => event.id));
    expect(new Set(joined.map((event) => event.id)).size).toBe(joined.length);
    expect(second.slice(0, 3).every((event) => event.isPhaseZero)).toBe(true);
  });

  it("preserves long-running supplied precision without a musical tick rate", () => {
    const adapter = createLiveTimelineAdapter(DEFINITION);
    const cycleIndex = 10_000_000_000_000n;
    const position = exactTransportSeconds(cycleIndex * 36n + 1n, 3n);
    const snapshot = adapter.snapshotAt(position);

    expect(snapshot.macroCycleIndex).toBe(cycleIndex);
    expect(snapshot.macroPosition).toEqual({
      numerator: cycleIndex * 36n + 1n,
      denominator: 36n,
    });
    expect(snapshot.macroPhase).toEqual({
      numerator: 1n,
      denominator: 36n,
      normalizedForRendering: expect.closeTo(1 / 36, 10),
    });
  });

  it("converts only the decimal precision exposed by number-valued transport time", () => {
    expect(transportSecondsFromNumber(0.125)).toEqual({
      secondsNumerator: 1n,
      secondsDenominator: 8n,
    });
    expect(transportSecondsFromNumber(1e-7)).toEqual({
      secondsNumerator: 1n,
      secondsDenominator: 10_000_000n,
    });
  });
});
