/**
 * SYS-010 — transmission runtime (PROTOTYPE, pending Codex review).
 *
 * Ownership boundary (deliberate):
 * - This runtime owns ONLY transmission scheduling state: which item is active,
 *   until when, what has played, what is currently eligible, and the run seed.
 * - It owns NO journey progress, NO scene/rhythm time, NO audio state, NO loop.
 *   It is driven by an immutable read-only crossing snapshot supplied by the
 *   caller, so SYS-007 can be refactored or replaced without touching SYS-010.
 * - Like SYS-007, it has no rAF/timer: consumers poll `update()`/`sample()`.
 *
 * Scheduling model (prototype):
 * - Eligibility is pure geometry: windowStart <= progress < windowEnd.
 * - Sparsity is decided ONCE per "eligibility episode" (the contiguous stretch
 *   during which a transmission is inside its window). Entering the window
 *   performs a single deterministic seeded admission roll whose verdict is
 *   latched for the whole episode. There are no per-update rolls, so changing
 *   the polling frequency cannot change which transmissions are admitted.
 * - Only one transmission may be active at a time, and a configurable minimum
 *   gap separates consecutive transmissions.
 *
 * Determinism guarantee: same seed + same definitions + same crossing-snapshot
 * sequence + same monotonic-time sequence ⇒ same scheduling result. Progress
 * alone is NOT sufficient, because active duration and the minimum gap are
 * measured in monotonic seconds.
 */

import { performanceTimeSource, type TimeSource } from "@/lib/crossing/timeSource";
import { stableUnitRoll } from "./rng";
import type {
  ActiveTransmission,
  CrossingSnapshot,
  TransmissionDefinition,
  TransmissionEndReason,
} from "./transmissionTypes";

export type TransmissionRuntimeConfig = {
  definitions: TransmissionDefinition[];
  timeSource?: TimeSource;
  /** Default seed when `startCrossing` does not supply one. */
  seed?: string;
  /**
   * Probability [0,1] that a transmission is admitted when it enters its
   * eligibility window. 1 = always admitted (still gated by gap/one-at-a-time).
   * Prototype sparsity knob, not product canon.
   */
  admissionChance?: number;
  /** Minimum monotonic seconds between the end of one item and the start of the next. */
  minGapSeconds?: number;
};

export type TransmissionRunInfo = {
  crossingId: string;
  /** Explicit seed; falls back to the config seed, then to the crossing id. */
  seed?: string;
};

export type TransmissionState = {
  crossingId: string | null;
  seed: string;
  current: ActiveTransmission | null;
  /** Seconds remaining on the active item, or null. */
  remainingSeconds: number | null;
  playedTransmissionIds: string[];
  eligibleTransmissionIds: string[];
  /** Ids admitted for their current eligibility episode. */
  admittedTransmissionIds: string[];
  activeUntilSeconds: number | null;
  lastProgress: number;
  lastPhase: string;
};

export type TransmissionListener = {
  transmissionStarted?: (t: ActiveTransmission, s: TransmissionState) => void;
  transmissionEnded?: (
    t: ActiveTransmission,
    reason: TransmissionEndReason,
    s: TransmissionState,
  ) => void;
  eligibilityChanged?: (eligibleIds: string[], s: TransmissionState) => void;
};

type EpisodeState = {
  /** Increments each time the item re-enters its window within a run. */
  index: number;
  inWindow: boolean;
  admitted: boolean;
  /** Guards a non-once item from replaying inside the same episode. */
  playedThisEpisode: boolean;
};

const inWindow = (d: TransmissionDefinition, p: number) =>
  p >= d.windowStart && p < d.windowEnd;

const sameIds = (a: string[], b: string[]) =>
  a.length === b.length && a.every((v, i) => v === b[i]);

export function createTransmissionRuntime(config: TransmissionRuntimeConfig) {
  const time: TimeSource = config.timeSource ?? performanceTimeSource;
  const definitions = [...config.definitions];
  const admissionChance = config.admissionChance ?? 1;
  const minGapSeconds = Math.max(0, config.minGapSeconds ?? 0);

  const listeners = new Set<TransmissionListener>();

  let crossingId: string | null = null;
  let seed = config.seed ?? "";
  let current: ActiveTransmission | null = null;
  const played = new Set<string>();
  let episodes = new Map<string, EpisodeState>();
  let eligibleIds: string[] = [];
  let lastEndedAtSeconds: number | null = null;
  let selectionCounter = 0;
  let lastProgress = 0;
  let lastPhase = "idle";

  function snapshotState(): TransmissionState {
    const now = time();
    return Object.freeze({
      crossingId,
      seed,
      current,
      remainingSeconds: current ? Math.max(0, current.endsAtSeconds - now) : null,
      playedTransmissionIds: Array.from(played),
      eligibleTransmissionIds: [...eligibleIds],
      admittedTransmissionIds: Array.from(episodes.entries())
        .filter(([, e]) => e.inWindow && e.admitted)
        .map(([id]) => id),
      activeUntilSeconds: current ? current.endsAtSeconds : null,
      lastProgress,
      lastPhase,
    });
  }

  function emit<K extends keyof TransmissionListener>(
    key: K,
    call: (fn: NonNullable<TransmissionListener[K]>) => void,
  ) {
    for (const l of Array.from(listeners)) {
      const fn = l[key];
      if (fn) call(fn as NonNullable<TransmissionListener[K]>);
    }
  }

  function endCurrent(reason: TransmissionEndReason, now: number) {
    if (!current) return;
    const ended = current;
    current = null;
    lastEndedAtSeconds = now;
    emit("transmissionEnded", (fn) => fn(ended, reason, snapshotState()));
  }

  /** Weighted seeded pick. Deterministic in (seed, crossingId, selection index). */
  function pick(candidates: TransmissionDefinition[]): TransmissionDefinition {
    const total = candidates.reduce((sum, d) => sum + Math.max(0, d.weight), 0);
    const roll = stableUnitRoll(seed, `${crossingId}:select:${selectionCounter}`);
    selectionCounter += 1;
    if (total <= 0) return candidates[Math.floor(roll * candidates.length)] ?? candidates[0];
    let acc = 0;
    const target = roll * total;
    for (const d of candidates) {
      acc += Math.max(0, d.weight);
      if (target < acc) return d;
    }
    return candidates[candidates.length - 1];
  }

  /**
   * Core reconciliation. `snapshot` is optional: `sample()` re-uses the last
   * observed crossing snapshot so time-only progression (duration expiry) can
   * be observed without inventing progress.
   */
  function reconcile(snapshot?: CrossingSnapshot): TransmissionState {
    const now = time();

    if (snapshot) {
      lastProgress = snapshot.progress;
      lastPhase = snapshot.phase;
      if (crossingId === null) crossingId = snapshot.crossingId;
    }

    // 1. Expire the active item on the monotonic clock.
    if (current && now >= current.endsAtSeconds) endCurrent("completed", now);

    const arrived = lastPhase === "arrived";

    // 2. Arrival: prototype behaviour is to cut an active transmission short
    //    immediately and start nothing new. Documented as prototype, not canon.
    if (arrived && current) endCurrent("arrival", now);

    // 3. Episode bookkeeping — one admission roll per window entry.
    const nextEligible: string[] = [];
    for (const d of definitions) {
      const ep =
        episodes.get(d.id) ??
        ({ index: 0, inWindow: false, admitted: false, playedThisEpisode: false } as EpisodeState);
      const nowInWindow = inWindow(d, lastProgress);

      if (nowInWindow && !ep.inWindow) {
        // Rising edge = new eligibility episode = exactly one deterministic roll.
        ep.index += 1;
        ep.playedThisEpisode = false;
        ep.admitted =
          admissionChance >= 1
            ? true
            : stableUnitRoll(seed, `${crossingId}:admit:${d.id}:${ep.index}`) < admissionChance;
      } else if (!nowInWindow && ep.inWindow) {
        ep.admitted = false;
        ep.playedThisEpisode = false;
      }
      ep.inWindow = nowInWindow;
      episodes.set(d.id, ep);

      // `oncePerCrossing` is honoured as a real field: only once-items are
      // permanently excluded after playing. Recurring items stay eligible.
      const blocked = d.oncePerCrossing && played.has(d.id);
      if (nowInWindow && !blocked) nextEligible.push(d.id);
    }

    if (!sameIds(nextEligible, eligibleIds)) {
      eligibleIds = nextEligible;
      emit("eligibilityChanged", (fn) => fn([...eligibleIds], snapshotState()));
    }

    // 4. Start at most one transmission, honouring the minimum gap.
    const gapOk =
      lastEndedAtSeconds === null || now - lastEndedAtSeconds >= minGapSeconds;

    if (!arrived && !current && gapOk && crossingId !== null) {
      const candidates = definitions.filter((d) => {
        const ep = episodes.get(d.id);
        if (!ep || !ep.inWindow || !ep.admitted) return false;
        if (d.oncePerCrossing && played.has(d.id)) return false;
        if (!d.oncePerCrossing && ep.playedThisEpisode) return false;
        return true;
      });

      if (candidates.length > 0) {
        const chosen = pick(candidates);
        current = {
          definition: chosen,
          startedAtSeconds: now,
          endsAtSeconds: now + Math.max(0, chosen.durationSeconds),
        };
        played.add(chosen.id);
        const ep = episodes.get(chosen.id);
        if (ep) ep.playedThisEpisode = true;
        emit("transmissionStarted", (fn) => fn(current as ActiveTransmission, snapshotState()));
      }
    }

    return snapshotState();
  }

  function clearRunState() {
    current = null;
    played.clear();
    episodes = new Map();
    eligibleIds = [];
    lastEndedAtSeconds = null;
    selectionCounter = 0;
    lastProgress = 0;
    lastPhase = "idle";
  }

  return {
    /** Begin a run. Clears all per-run state and fixes the seed. */
    startCrossing(run: TransmissionRunInfo): TransmissionState {
      const active = current;
      clearRunState();
      crossingId = run.crossingId;
      seed = run.seed ?? config.seed ?? run.crossingId;
      if (active) emit("transmissionEnded", (fn) => fn(active, "reset", snapshotState()));
      return snapshotState();
    },

    /** Feed a crossing snapshot and reconcile scheduling. */
    update(snapshot: CrossingSnapshot): TransmissionState {
      return reconcile(snapshot);
    },

    /** Reconcile against time only, re-using the last observed snapshot. */
    sample(): TransmissionState {
      return reconcile();
    },

    /** Read state without reconciling or emitting. */
    peek(): TransmissionState {
      return snapshotState();
    },

    reset(): TransmissionState {
      const active = current;
      const now = time();
      clearRunState();
      crossingId = null;
      if (active) {
        lastEndedAtSeconds = now;
        emit("transmissionEnded", (fn) => fn(active, "reset", snapshotState()));
        lastEndedAtSeconds = null;
      }
      return snapshotState();
    },

    subscribe(listener: TransmissionListener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    get definitions(): TransmissionDefinition[] {
      return [...definitions];
    },
  };
}

export type TransmissionRuntime = ReturnType<typeof createTransmissionRuntime>;
