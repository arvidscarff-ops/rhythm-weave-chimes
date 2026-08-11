import type { RhythmTimelineSnapshot } from "./authoritativeTimeline";
import type { CrystallizationState } from "./crystallizationState";

export type CrystallizationVisualNode = Readonly<{
  voiceId: string;
  voiceOrder: number;
  phaseForRendering: number;
  x: number;
  y: number;
}>;

export type CrystallizationVisualRelationship = Readonly<{
  candidateId: string;
  relationshipId: string;
  state: "candidate" | "crystallized";
  voiceIds: readonly string[];
  points: readonly Readonly<{ x: number; y: number }>[];
}>;

export type CrystallizationVisualFrame = Readonly<{
  compositionId: string;
  compositionVersion: number;
  macroCycleIndex: bigint;
  phaseForRendering: number;
  nodes: readonly CrystallizationVisualNode[];
  relationships: readonly CrystallizationVisualRelationship[];
}>;

export type CrystallizationProjectionInput = Readonly<{
  snapshot: RhythmTimelineSnapshot;
  state: CrystallizationState;
  /** Recent candidates selected by the presenter for transient legibility. */
  availableCandidateIds: readonly string[];
}>;

/**
 * One radial visual-family proof. It consumes candidate/crystallization state
 * and authoritative rendering phase, but has no API for creating candidates.
 */
export function projectCrystallizationFrame(
  input: CrystallizationProjectionInput,
): CrystallizationVisualFrame {
  validateIdentity(input.snapshot, input.state);
  const voiceCount = input.snapshot.voices.length;
  const nodes = input.snapshot.voices.map((voice) => {
    const angle = -Math.PI / 2 + (voice.voiceOrder / voiceCount) * Math.PI * 2;
    const radius = 0.66 + Math.cos(voice.phase.normalizedForRendering * Math.PI * 2) * 0.14;
    return Object.freeze({
      voiceId: voice.id,
      voiceOrder: voice.voiceOrder,
      phaseForRendering: voice.phase.normalizedForRendering,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  });
  const nodesByVoice = new Map(nodes.map((node) => [node.voiceId, node]));
  const crystallizedIds = new Set(input.state.crystallized.map((entry) => entry.candidateId));
  const available = input.availableCandidateIds
    .filter((candidateId) => !crystallizedIds.has(candidateId))
    .map((candidateId) => {
      const candidate = input.state.candidateHistory.find((entry) => entry.id === candidateId);
      if (!candidate) throw new Error(`Unknown available candidate: ${candidateId}`);
      return relationshipProjection(candidate, "candidate", nodesByVoice);
    });
  const crystallized = input.state.crystallized.map((entry) =>
    relationshipProjection(entry.candidate, "crystallized", nodesByVoice),
  );

  return Object.freeze({
    compositionId: input.snapshot.compositionId,
    compositionVersion: input.snapshot.compositionVersion,
    macroCycleIndex: input.snapshot.macroCycleIndex,
    phaseForRendering: input.snapshot.macroPhase.normalizedForRendering,
    nodes: Object.freeze(nodes),
    relationships: Object.freeze([...available, ...crystallized]),
  });
}

function relationshipProjection(
  candidate: CrystallizationState["candidateHistory"][number],
  state: CrystallizationVisualRelationship["state"],
  nodesByVoice: ReadonlyMap<string, CrystallizationVisualNode>,
): CrystallizationVisualRelationship {
  return Object.freeze({
    candidateId: candidate.id,
    relationshipId: candidate.relationshipId,
    state,
    voiceIds: candidate.voiceIds,
    points: Object.freeze(
      candidate.voiceIds.map((voiceId) => {
        const node = nodesByVoice.get(voiceId);
        if (!node) throw new Error(`Candidate references missing authoritative voice: ${voiceId}`);
        return Object.freeze({ x: node.x, y: node.y });
      }),
    ),
  });
}

function validateIdentity(snapshot: RhythmTimelineSnapshot, state: CrystallizationState): void {
  if (
    snapshot.compositionId !== state.compositionId ||
    snapshot.compositionVersion !== state.compositionVersion
  ) {
    throw new Error("Crystallization projection requires one shared composition identity.");
  }
}
