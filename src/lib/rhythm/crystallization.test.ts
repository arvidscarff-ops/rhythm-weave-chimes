import { describe, expect, it } from "vitest";
import {
  compareMacroPositions,
  createAuthoritativeRhythmTimeline,
  exactMacroPosition,
  type ExactMacroPosition,
} from "./authoritativeTimeline";
import { projectCrystallizationFrame } from "./crystallizationProjection";
import { createCrystallizationState, reduceCrystallizationState } from "./crystallizationState";
import {
  compositionTimelineDefinition,
  createCompositionSnapshot,
  orderedPhaseAlignedVoices,
} from "./compositionSnapshot";
import { exactTransportSeconds } from "./liveTimelineAdapter";
import { createRelationshipCandidateModel } from "./relationshipCandidates";

const composition = createCompositionSnapshot({
  id: "step-11a-crystallization-proof",
  revision: 1,
  macroCycleDuration: exactTransportSeconds(24n),
  baseLaps: 3,
  orderedVoices: orderedPhaseAlignedVoices("crystal-seed", 6),
});
const timeline = createAuthoritativeRhythmTimeline(compositionTimelineDefinition(composition));
const model = createRelationshipCandidateModel(timeline);

function addPositions(left: ExactMacroPosition, right: ExactMacroPosition): ExactMacroPosition {
  return exactMacroPosition(
    left.numerator * right.denominator + right.numerator * left.denominator,
    left.denominator * right.denominator,
  );
}

function enumerateWithCadence(end: ExactMacroPosition, windowSizes: readonly ExactMacroPosition[]) {
  const candidates = [];
  let cursor = exactMacroPosition(0n);
  let windowIndex = 0;
  while (compareMacroPositions(cursor, end) < 0) {
    const proposed = addPositions(cursor, windowSizes[windowIndex % windowSizes.length]);
    const windowEnd = compareMacroPositions(proposed, end) > 0 ? end : proposed;
    candidates.push(...model.candidatesBetween(cursor, windowEnd));
    cursor = windowEnd;
    windowIndex += 1;
  }
  return candidates;
}

describe("Step 11A exact relationship candidates", () => {
  it("derives candidates only from coincident authoritative event positions", () => {
    const candidates = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const authoritativeEvents = timeline.eventsBetween(
      exactMacroPosition(0n),
      exactMacroPosition(1n),
    );
    const eventsById = new Map(authoritativeEvents.map((event) => [event.id, event]));

    expect(candidates.length).toBeGreaterThan(1);
    expect(candidates[0]?.type).toBe("phase-zero-constellation");
    expect(candidates[0]?.voiceIds).toHaveLength(composition.voices.length);

    for (const candidate of candidates) {
      expect(candidate.sourceEventIds.length).toBeGreaterThanOrEqual(2);
      for (const eventId of candidate.sourceEventIds) {
        expect(eventsById.get(eventId)?.macroPosition).toEqual(candidate.macroPosition);
      }
    }
  });

  it("is deterministic and preserves stable occurrence and recurring identities", () => {
    const first = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(2n));
    const second = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(2n));

    expect(first).toEqual(second);
    expect(new Set(first.map((candidate) => candidate.id)).size).toBe(first.length);
    expect(first[0]?.relationshipId).toBe(
      first.find((candidate) => candidate.macroCycleIndex === 1n)?.relationshipId,
    );
  });

  it("produces identical candidate identities at high and sparse render cadence", () => {
    const end = exactMacroPosition(4n);
    const highCadence = enumerateWithCadence(end, [exactMacroPosition(1n, 240n)]);
    const sparseCadence = enumerateWithCadence(end, [
      exactMacroPosition(7n, 40n),
      exactMacroPosition(19n, 30n),
      exactMacroPosition(1n, 120n),
      exactMacroPosition(23n, 16n),
    ]);
    const whole = model.candidatesBetween(exactMacroPosition(0n), end);

    expect(highCadence.map((candidate) => candidate.id)).toEqual(
      sparseCadence.map((candidate) => candidate.id),
    );
    expect(highCadence.map((candidate) => candidate.id)).toEqual(
      whole.map((candidate) => candidate.id),
    );
  });

  it("uses half-open windows without duplicating macro-boundary candidates", () => {
    const first = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const second = model.candidatesBetween(exactMacroPosition(1n), exactMacroPosition(2n));
    const whole = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(2n));

    expect([...first, ...second].map((candidate) => candidate.id)).toEqual(
      whole.map((candidate) => candidate.id),
    );
    expect(new Set([...first, ...second].map((candidate) => candidate.id)).size).toBe(whole.length);
  });

  it("exposes no geometry, clock, scheduler, or cross-system authority", () => {
    for (const key of [
      "geometry",
      "engineClock",
      "transport",
      "scheduler",
      "movement",
      "crossing",
      "transmission",
    ]) {
      expect(key in model).toBe(false);
    }
  });
});

describe("Step 11A session-only crystallization", () => {
  it("keeps passive observation valid and deduplicates repeated samples", () => {
    const candidates = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const passive = reduceCrystallizationState(createCrystallizationState(timeline.definition), {
      type: "observe",
      candidates,
    });
    const repeated = reduceCrystallizationState(passive, { type: "observe", candidates });

    expect(passive.crystallized).toEqual([]);
    expect(repeated).toBe(passive);
    expect(new Set(passive.candidateHistory.map((candidate) => candidate.id)).size).toBe(
      passive.candidateHistory.length,
    );
  });

  it("persists an optional selection visually and releases it explicitly", () => {
    const candidates = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const observed = reduceCrystallizationState(createCrystallizationState(timeline.definition), {
      type: "observe",
      candidates,
    });
    const selected = candidates.find((candidate) => candidate.type === "boundary-alignment")!;
    const crystallized = reduceCrystallizationState(observed, {
      type: "crystallize",
      candidateId: selected.id,
    });
    const repeated = reduceCrystallizationState(crystallized, {
      type: "crystallize",
      candidateId: selected.id,
    });
    const released = reduceCrystallizationState(repeated, {
      type: "release",
      candidateId: selected.id,
    });

    expect(crystallized.crystallized[0]?.candidate).toEqual(selected);
    expect(repeated).toBe(crystallized);
    expect(released.crystallized).toEqual([]);
  });

  it("does not change CompositionSnapshot revisions or authoritative musical events", () => {
    const beforeEvents = timeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(2n));
    const candidates = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const observed = reduceCrystallizationState(createCrystallizationState(timeline.definition), {
      type: "observe",
      candidates,
    });
    const afterCommand = reduceCrystallizationState(observed, {
      type: "crystallize",
      candidateId: candidates[0].id,
    });

    expect(composition.revision).toBe(1);
    expect(afterCommand).not.toHaveProperty("composition");
    expect(timeline.eventsBetween(exactMacroPosition(0n), exactMacroPosition(2n))).toEqual(
      beforeEvents,
    );
  });

  it("lets a visual family consume relationships without creating new identities", () => {
    const candidates = model.candidatesBetween(exactMacroPosition(0n), exactMacroPosition(1n));
    const observed = reduceCrystallizationState(createCrystallizationState(timeline.definition), {
      type: "observe",
      candidates,
    });
    const crystallized = reduceCrystallizationState(observed, {
      type: "crystallize",
      candidateId: candidates[0].id,
    });
    const availableIds = candidates.slice(-3).map((candidate) => candidate.id);
    const input = {
      snapshot: timeline.snapshotAt(exactMacroPosition(7n, 12n)),
      state: crystallized,
      availableCandidateIds: availableIds,
    } as const;
    const frame = projectCrystallizationFrame(input);
    const secondFrame = projectCrystallizationFrame(input);
    const permittedIds = new Set([...availableIds, candidates[0].id]);

    expect(frame).toEqual(secondFrame);
    expect(
      frame.relationships.every((relationship) => permittedIds.has(relationship.candidateId)),
    ).toBe(true);
    expect(frame.relationships.some((relationship) => relationship.state === "crystallized")).toBe(
      true,
    );
    expect(Object.isFrozen(frame)).toBe(true);
  });
});
