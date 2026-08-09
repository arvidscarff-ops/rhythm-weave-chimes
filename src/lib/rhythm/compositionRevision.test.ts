import { describe, expect, it } from "vitest";
import { createCompositionSnapshot, orderedPhaseAlignedVoices } from "./compositionSnapshot";
import {
  advanceCompositionRevisionSession,
  createCompositionRevisionSession,
  queueCompositionRevision,
} from "./productionRhythmBridge";

const revision = (number: number, baseLaps: number, duration = 10) =>
  createCompositionSnapshot({
    id: "crossing-composition",
    revision: number,
    macroCycleDuration: duration,
    baseLaps,
    orderedVoices: orderedPhaseAlignedVoices("rings", 2),
  });

describe("Phase-Zero composition revision transition", () => {
  it("queues structural changes without mutating the active composition", () => {
    const current = revision(1, 4);
    const next = revision(2, 5);
    const initial = createCompositionRevisionSession(current);
    const queued = queueCompositionRevision(initial, next, 2);

    expect(initial.pending).toBeNull();
    expect(queued.active.composition).toBe(current);
    expect(queued.pending?.authority.composition).toBe(next);
    expect(queued.pending?.activatesAt).toEqual({
      secondsNumerator: 10n,
      secondsDenominator: 1n,
    });
    expect(() => queueCompositionRevision(queued, next, 3)).toThrow(/increase/);
  });

  it("activates the new revision at exact Phase Zero, even after a skipped frame", () => {
    const queued = queueCompositionRevision(
      createCompositionRevisionSession(revision(1, 4)),
      revision(2, 5, 12),
      7,
    );
    const atBoundary = advanceCompositionRevisionSession(queued, 7, 10);

    expect(atBoundary.session.active.composition.revision).toBe(2);
    expect(atBoundary.session.activeFrom).toEqual({
      secondsNumerator: 10n,
      secondsDenominator: 1n,
    });
    expect(atBoundary.input.snapshot.isPhaseZero).toBe(true);
    expect(atBoundary.input.compositionTransportPosition).toEqual({
      secondsNumerator: 0n,
      secondsDenominator: 1n,
    });

    const afterSkippedFrame = advanceCompositionRevisionSession(queued, 9, 11);
    expect(afterSkippedFrame.session.active.composition.revision).toBe(2);
    expect(afterSkippedFrame.input.compositionTransportPosition).toEqual({
      secondsNumerator: 1n,
      secondsDenominator: 1n,
    });
    expect(afterSkippedFrame.input.events.some((event) => event.compositionRevision === 2)).toBe(
      true,
    );
  });

  it("has no duplicate or missed events across a revision boundary", () => {
    const queued = queueCompositionRevision(
      createCompositionRevisionSession(revision(1, 4)),
      revision(2, 5),
      2,
    );
    const first = advanceCompositionRevisionSession(queued, 0, 10);
    const second = advanceCompositionRevisionSession(first.session, 10, 20);
    const joined = [...first.input.events, ...second.input.events];

    expect(first.input.events).toHaveLength(9);
    expect(second.input.events).toHaveLength(11);
    expect(new Set(joined.map((event) => event.id)).size).toBe(joined.length);
    expect(first.input.events.every((event) => event.compositionRevision === 1)).toBe(true);
    expect(second.input.events.every((event) => event.compositionRevision === 2)).toBe(true);
    expect(
      second.input.events.slice(0, 2).every((event) => event.authoritativeEvent.isPhaseZero),
    ).toBe(true);
  });

  it("freezes on identical supplied transport positions and resumes deterministically", () => {
    const session = createCompositionRevisionSession(revision(1, 4));
    const beforePause = advanceCompositionRevisionSession(session, 3, 3);
    const hidden = advanceCompositionRevisionSession(beforePause.session, 3, 3);
    const resumed = advanceCompositionRevisionSession(hidden.session, 3, 4);

    expect(hidden.input.snapshot).toEqual(beforePause.input.snapshot);
    expect(hidden.input.events).toEqual([]);
    expect(resumed.input.snapshot.macroPosition).toEqual({ numerator: 2n, denominator: 5n });
  });

  it("is a supplied-position state machine, not another live transport", () => {
    const session = createCompositionRevisionSession(revision(1, 4));
    expect(Object.keys(session).sort()).toEqual(["active", "activeFrom", "pending"]);
    expect("play" in session).toBe(false);
    expect("pause" in session).toBe(false);
    expect("tick" in session).toBe(false);
  });
});
