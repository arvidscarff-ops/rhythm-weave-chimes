import type { CrossingPhase, CrossingTransitionId } from "../crossing/crossingRuntime";

/** Immutable authored scheduling input. Content/voice remains WRLD-owned. */
export type TransmissionDefinition = Readonly<{
  id: string;
  /** Developer/content label only; the runtime does not present it. */
  label: string;
  /** Half-open normalized eligibility interval: [windowStart, windowEnd). */
  windowStart: number;
  windowEnd: number;
  /** Active journey seconds, never wall-clock seconds. */
  durationSeconds: number;
  /** Positive relative weight inside an equal-priority candidate tier. */
  weight: number;
  /** Higher numeric values win before weighted selection is considered. */
  priority: number;
  oncePerCrossing: boolean;
}>;

/** Structural SYS-007 input; SYS-010 does not import or own its runtime. */
export type TransmissionCrossingInput = Readonly<{
  runId: string;
  routeDefinitionId: string;
  progress: number;
  phase: CrossingPhase;
  activeElapsedSeconds: number;
  transitions?: readonly Readonly<{ id: CrossingTransitionId }>[];
}>;

export type TransmissionEpisodeSnapshot = Readonly<{
  episodeId: string;
  definitionId: string;
  admitted: boolean;
  evaluatedAtProgress: number;
  evaluatedAtActiveSeconds: number;
}>;

export type ActiveTransmissionSnapshot = Readonly<{
  definitionId: string;
  episodeId: string;
  startedAtActiveSeconds: number;
  completesAtActiveSeconds: number;
  startEventId: string;
}>;

export type TransmissionRuntimeEvent =
  | Readonly<{
      id: string;
      type: "transmissionAdmitted";
      definitionId: string;
      episodeId: string;
      atActiveSeconds: number;
    }>
  | Readonly<{
      id: string;
      type: "transmissionStarted";
      definitionId: string;
      episodeId: string;
      atActiveSeconds: number;
      completesAtActiveSeconds: number;
    }>
  | Readonly<{
      id: string;
      type: "transmissionCompleted";
      definitionId: string;
      episodeId: string;
      atActiveSeconds: number;
    }>
  | Readonly<{
      id: string;
      type: "transmissionArrivalFadeRequested";
      definitionId: string;
      episodeId: string;
      atActiveSeconds: number;
    }>;
