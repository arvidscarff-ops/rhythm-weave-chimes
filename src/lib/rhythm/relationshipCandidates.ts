import {
  compareMacroPositions,
  type AuthoritativeRhythmEvent,
  type AuthoritativeRhythmTimeline,
  type ExactMacroPosition,
  type ExactRhythmPhase,
} from "./authoritativeTimeline";

export const RELATIONSHIP_CANDIDATE_SCHEMA_VERSION = 1 as const;
export const RELATIONSHIP_CANDIDATE_RULE_VERSION = 1 as const;

export type RelationshipCandidateType = "boundary-alignment" | "phase-zero-constellation";

/**
 * One exact occurrence of a mathematical relationship in the authoritative
 * composition. The occurrence identity includes absolute macro position;
 * relationshipId identifies the same recurring structure across macro cycles.
 */
export type RhythmRelationshipCandidate = Readonly<{
  schemaVersion: typeof RELATIONSHIP_CANDIDATE_SCHEMA_VERSION;
  ruleVersion: typeof RELATIONSHIP_CANDIDATE_RULE_VERSION;
  id: string;
  relationshipId: string;
  type: RelationshipCandidateType;
  compositionId: string;
  compositionVersion: number;
  macroPosition: ExactMacroPosition;
  macroCycleIndex: bigint;
  macroPhase: ExactRhythmPhase;
  voiceIds: readonly string[];
  sourceEventIds: readonly string[];
}>;

export type RelationshipCandidateModel = Readonly<{
  compositionId: string;
  compositionVersion: number;
  ruleVersion: typeof RELATIONSHIP_CANDIDATE_RULE_VERSION;
  /** Enumerate exact candidates in the half-open interval [start, end). */
  candidatesBetween(
    start: ExactMacroPosition,
    end: ExactMacroPosition,
  ): readonly RhythmRelationshipCandidate[];
}>;

/**
 * Derive relationship candidates from the same exact event timeline consumed
 * by audio and Trigger Engine visuals.
 *
 * Rule v1 is deliberately narrow:
 * - two or more voice events at one exact non-zero macro phase form one
 *   boundary-alignment candidate;
 * - the all-voice exact Phase Zero event forms one constellation candidate.
 *
 * The model has no geometry input, clock, timer, browser API, or floating-point
 * comparison through which rendered contact could invent a relationship.
 */
export function createRelationshipCandidateModel(
  timeline: AuthoritativeRhythmTimeline,
): RelationshipCandidateModel {
  const { id: compositionId, version: compositionVersion } = timeline.definition;

  return Object.freeze({
    compositionId,
    compositionVersion,
    ruleVersion: RELATIONSHIP_CANDIDATE_RULE_VERSION,

    candidatesBetween(
      start: ExactMacroPosition,
      end: ExactMacroPosition,
    ): readonly RhythmRelationshipCandidate[] {
      const events = timeline.eventsBetween(start, end);
      const candidates: RhythmRelationshipCandidate[] = [];

      for (let cursor = 0; cursor < events.length;) {
        const first = events[cursor];
        let groupEnd = cursor + 1;
        while (
          groupEnd < events.length &&
          compareMacroPositions(events[groupEnd].macroPosition, first.macroPosition) === 0
        ) {
          groupEnd += 1;
        }

        const coincidentEvents = events.slice(cursor, groupEnd);
        if (coincidentEvents.length >= 2) {
          candidates.push(candidateFromCoincidentEvents(coincidentEvents));
        }
        cursor = groupEnd;
      }

      return Object.freeze(candidates);
    },
  });
}

function candidateFromCoincidentEvents(
  events: readonly AuthoritativeRhythmEvent[],
): RhythmRelationshipCandidate {
  const first = events[0];
  const type: RelationshipCandidateType = first.isPhaseZero
    ? "phase-zero-constellation"
    : "boundary-alignment";
  const voiceIds = Object.freeze(events.map((event) => event.voiceId));
  const sourceEventIds = Object.freeze(events.map((event) => event.id));
  const voiceIdentity = voiceIds.map(encodeURIComponent).join("+");
  const recurringPosition = `${first.macroPhase.numerator}/${first.macroPhase.denominator}`;
  const occurrencePosition = `${first.macroPosition.numerator}/${first.macroPosition.denominator}`;
  const identityPrefix = `${encodeURIComponent(first.compositionId)}@${first.compositionVersion}`;

  return Object.freeze({
    schemaVersion: RELATIONSHIP_CANDIDATE_SCHEMA_VERSION,
    ruleVersion: RELATIONSHIP_CANDIDATE_RULE_VERSION,
    id: ["relationship-candidate:v1", identityPrefix, type, occurrencePosition, voiceIdentity].join(
      ":",
    ),
    relationshipId: [
      "rhythm-relationship:v1",
      identityPrefix,
      type,
      recurringPosition,
      voiceIdentity,
    ].join(":"),
    type,
    compositionId: first.compositionId,
    compositionVersion: first.compositionVersion,
    macroPosition: first.macroPosition,
    macroCycleIndex: first.macroCycleIndex,
    macroPhase: first.macroPhase,
    voiceIds,
    sourceEventIds,
  });
}
