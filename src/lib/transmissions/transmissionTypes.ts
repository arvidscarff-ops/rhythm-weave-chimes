/**
 * SYS-010 — transmission definition types (PROTOTYPE).
 *
 * Deliberately minimal: only the fields the scheduling prototype needs.
 * No channel/region/source/category fields — WORLD_LORE §24 describes the tone
 * of transmissions but defines no taxonomy, and this task is runtime
 * architecture, not writing.
 */

export type TransmissionDefinition = {
  id: string;
  /** Developer placeholder label. NOT narrative content. */
  label: string;
  /** Normalized crossing progress window: eligible when start <= p < end. */
  windowStart: number;
  windowEnd: number;
  /** Prototype active duration, seconds, measured on the injected time source. */
  durationSeconds: number;
  /** Relative weight for the seeded selection layer. */
  weight: number;
  /** true → one play per crossing run. false → may recur under normal rules. */
  oncePerCrossing: boolean;
};

/**
 * The ONLY thing SYS-010 knows about a crossing. Structural on purpose so
 * SYS-007 can be refactored or replaced without touching this runtime.
 */
export type CrossingSnapshot = {
  crossingId: string;
  /** Normalized journey progress in [0,1]. */
  progress: number;
  /** Free-form phase string; only "arrived" carries scheduling meaning here. */
  phase: string;
};

export type TransmissionEndReason = "completed" | "arrival" | "reset";

export type ActiveTransmission = {
  definition: TransmissionDefinition;
  /** Monotonic seconds from the injected time source. */
  startedAtSeconds: number;
  endsAtSeconds: number;
};
