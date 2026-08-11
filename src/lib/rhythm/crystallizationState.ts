import type { RhythmCompositionDefinition } from "./authoritativeTimeline";
import type { RhythmRelationshipCandidate } from "./relationshipCandidates";

export const CRYSTALLIZATION_STATE_SCHEMA_VERSION = 1 as const;
export const CRYSTALLIZATION_HISTORY_LIMIT = 48;

export type CrystallizedRelationship = Readonly<{
  id: string;
  candidateId: string;
  relationshipId: string;
  commandOrder: number;
  candidate: RhythmRelationshipCandidate;
}>;

/** Session-only, non-musical state for the Step 11A laboratory. */
export type CrystallizationState = Readonly<{
  schemaVersion: typeof CRYSTALLIZATION_STATE_SCHEMA_VERSION;
  compositionId: string;
  compositionVersion: number;
  candidateHistory: readonly RhythmRelationshipCandidate[];
  crystallized: readonly CrystallizedRelationship[];
  nextCommandOrder: number;
}>;

export type CrystallizationCommand =
  | Readonly<{
      type: "observe";
      candidates: readonly RhythmRelationshipCandidate[];
    }>
  | Readonly<{
      type: "crystallize";
      candidateId: string;
    }>
  | Readonly<{
      type: "release";
      candidateId: string;
    }>;

export function createCrystallizationState(
  composition: Pick<RhythmCompositionDefinition, "id" | "version">,
): CrystallizationState {
  return freezeState({
    schemaVersion: CRYSTALLIZATION_STATE_SCHEMA_VERSION,
    compositionId: composition.id,
    compositionVersion: composition.version,
    candidateHistory: [],
    crystallized: [],
    nextCommandOrder: 0,
  });
}

/**
 * Pure reducer for optional player curation. It never receives or returns a
 * CompositionSnapshot, rhythm event batch, transport command, or audio action.
 */
export function reduceCrystallizationState(
  state: CrystallizationState,
  command: CrystallizationCommand,
): CrystallizationState {
  switch (command.type) {
    case "observe": {
      if (command.candidates.length === 0) return state;
      const known = new Set(state.candidateHistory.map((candidate) => candidate.id));
      const additions: RhythmRelationshipCandidate[] = [];
      for (const candidate of command.candidates) {
        validateCandidateIdentity(state, candidate);
        if (!known.has(candidate.id)) {
          known.add(candidate.id);
          additions.push(candidate);
        }
      }
      if (additions.length === 0) return state;
      return freezeState({
        ...state,
        candidateHistory: [...state.candidateHistory, ...additions].slice(
          -CRYSTALLIZATION_HISTORY_LIMIT,
        ),
      });
    }

    case "crystallize": {
      if (state.crystallized.some((entry) => entry.candidateId === command.candidateId)) {
        return state;
      }
      const candidate = state.candidateHistory.find((entry) => entry.id === command.candidateId);
      if (!candidate) throw new Error("Only an observed authoritative candidate can crystallize.");
      const crystallized = Object.freeze({
        id: `crystallized-relationship:v1:${encodeURIComponent(candidate.id)}`,
        candidateId: candidate.id,
        relationshipId: candidate.relationshipId,
        commandOrder: state.nextCommandOrder,
        candidate,
      });
      return freezeState({
        ...state,
        crystallized: [...state.crystallized, crystallized],
        nextCommandOrder: state.nextCommandOrder + 1,
      });
    }

    case "release": {
      const crystallized = state.crystallized.filter(
        (entry) => entry.candidateId !== command.candidateId,
      );
      if (crystallized.length === state.crystallized.length) return state;
      return freezeState({ ...state, crystallized });
    }
  }
}

function validateCandidateIdentity(
  state: CrystallizationState,
  candidate: RhythmRelationshipCandidate,
): void {
  if (
    candidate.compositionId !== state.compositionId ||
    candidate.compositionVersion !== state.compositionVersion
  ) {
    throw new Error("Relationship candidate does not belong to this crystallization session.");
  }
}

function freezeState(
  input: Omit<CrystallizationState, "candidateHistory" | "crystallized"> &
    Readonly<{
      candidateHistory: readonly RhythmRelationshipCandidate[];
      crystallized: readonly CrystallizedRelationship[];
    }>,
): CrystallizationState {
  return Object.freeze({
    ...input,
    candidateHistory: Object.freeze([...input.candidateHistory]),
    crystallized: Object.freeze([...input.crystallized]),
  });
}
