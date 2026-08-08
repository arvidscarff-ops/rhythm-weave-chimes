/**
 * SYS-005 — frame delta collector.
 *
 * PROTOTYPE TOOLING. Owns exactly one requestAnimationFrame loop, and only
 * while a measurement session is running. Per frame it performs one
 * subtraction and one ring-buffer write: no sorting, no allocation, no React
 * state update. All statistics are computed at stop (see frameStats.ts).
 *
 * ZERO route dependency: this is a plain module with no React and no rendering,
 * so /dev/performance and the in-player ?perf=1 probe drive the same code.
 *
 * TAB VISIBILITY
 * A `visibilitychange` listener is attached only while measuring. When the tab
 * becomes hidden, sampling suspends and the previous timestamp is invalidated;
 * when it becomes visible again the first delta after the gap is DISCARDED.
 * A backgrounded tab therefore never lands in the samples as one giant
 * "rendered frame". Hidden wall-time is accumulated and subtracted from the
 * reported session duration, so the duration reflects time actually rendered.
 *
 * NOTHING here touches engineClock, the scheduler, audio, the crossing runtime
 * or any scene.
 */

import { computeFrameStats, type FrameStats } from "./frameStats";

/** ~10 minutes at 60fps. Bounded so an indefinite session cannot grow unbounded. */
export const DEFAULT_CAPACITY = 36_000;

/** How often live telemetry is published to the UI (ms). ~2Hz, never per frame. */
export const DEFAULT_TICK_MS = 500;

export type CollectorStatus = "idle" | "measuring" | "complete";

export type CollectorTick = {
  status: CollectorStatus;
  /** Wall duration of the session minus hidden time, in ms. */
  durationMs: number;
  sampleCount: number;
  totalFramesObserved: number;
  truncated: boolean;
  /** Aggregates over the samples currently held in the ring buffer. */
  stats: FrameStats;
};

/* ------------------------------------------------------------------ *
 * Pure timestamp-reset helper — extracted so the visibility behaviour
 * is unit-testable without a browser.
 * ------------------------------------------------------------------ */

export type SampleDecision =
  | { kind: "discard"; nextPrev: number }
  | { kind: "record"; deltaMs: number; nextPrev: number };

/**
 * Decide what to do with a rAF timestamp.
 * `prev === null` means "no valid previous timestamp" — the first frame of a
 * session, or the first frame after the tab became visible again. Both are
 * discarded and simply re-arm the reference point.
 */
export function decideSample(prev: number | null, now: number): SampleDecision {
  if (prev === null || !(now > prev)) return { kind: "discard", nextPrev: now };
  return { kind: "record", deltaMs: now - prev, nextPrev: now };
}

/* ------------------------------------------------------------------ *
 * Ring buffer
 * ------------------------------------------------------------------ */

export type RingBuffer = {
  push(v: number): void;
  /** Oldest → newest. */
  toArray(): number[];
  reset(): void;
  readonly capacity: number;
  readonly size: number;
  readonly truncated: boolean;
};

export function createRingBuffer(capacity = DEFAULT_CAPACITY): RingBuffer {
  const buf = new Float64Array(capacity);
  let head = 0;
  let size = 0;
  let truncated = false;

  return {
    push(v: number) {
      buf[head] = v;
      head = (head + 1) % capacity;
      if (size < capacity) size++;
      else truncated = true; // oldest sample was just overwritten
    },
    toArray() {
      const out = new Array<number>(size);
      const start = size < capacity ? 0 : head;
      for (let i = 0; i < size; i++) out[i] = buf[(start + i) % capacity]!;
      return out;
    },
    reset() {
      head = 0;
      size = 0;
      truncated = false;
    },
    get capacity() {
      return capacity;
    },
    get size() {
      return size;
    },
    get truncated() {
      return truncated;
    },
  };
}

/* ------------------------------------------------------------------ *
 * Collector
 * ------------------------------------------------------------------ */

export type FrameCollector = {
  start(): void;
  stop(): void;
  reset(): void;
  /** Raw frame deltas in ms, oldest → newest. */
  getSamples(): number[];
  getStatus(): CollectorStatus;
  /** Session wall duration minus hidden time, ms. */
  getDurationMs(): number;
  getStartedAtEpochMs(): number | null;
  getTotalFramesObserved(): number;
  isTruncated(): boolean;
  /** Snapshot for live display / final result. */
  snapshot(): CollectorTick;
  /** Low-cadence subscription (~2Hz). Returns an unsubscribe fn. */
  subscribe(fn: (t: CollectorTick) => void): () => void;
  dispose(): void;
};

export type FrameCollectorOptions = {
  capacity?: number;
  tickMs?: number;
};

export function createFrameCollector(opts: FrameCollectorOptions = {}): FrameCollector {
  const capacity = opts.capacity ?? DEFAULT_CAPACITY;
  const tickMs = opts.tickMs ?? DEFAULT_TICK_MS;
  const ring = createRingBuffer(capacity);
  const subs = new Set<(t: CollectorTick) => void>();

  let status: CollectorStatus = "idle";
  let raf = 0;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let prev: number | null = null;
  let totalFrames = 0;

  let startedAtEpochMs: number | null = null;
  let startedAtPerfMs = 0;
  let stoppedAtPerfMs = 0;
  let hiddenMs = 0;
  let hiddenSincePerfMs: number | null = null;

  const now = () =>
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const durationMs = () => {
    if (startedAtEpochMs === null) return 0;
    const end = status === "measuring" ? now() : stoppedAtPerfMs;
    const pendingHidden = hiddenSincePerfMs !== null ? end - hiddenSincePerfMs : 0;
    return Math.max(0, end - startedAtPerfMs - hiddenMs - pendingHidden);
  };

  const snapshot = (): CollectorTick => ({
    status,
    durationMs: durationMs(),
    sampleCount: ring.size,
    totalFramesObserved: totalFrames,
    truncated: ring.truncated,
    stats: computeFrameStats(ring.toArray()),
  });

  const emit = () => {
    const t = snapshot();
    for (const fn of subs) fn(t);
  };

  const loop = (ts: number) => {
    // Suspended while hidden — the rAF loop is cancelled, but guard anyway.
    if (status === "measuring" && hiddenSincePerfMs === null) {
      const d = decideSample(prev, ts);
      prev = d.nextPrev;
      if (d.kind === "record") {
        ring.push(d.deltaMs);
        totalFrames++;
      }
    }
    raf = requestAnimationFrame(loop);
  };

  const onVisibility = () => {
    if (status !== "measuring") return;
    if (document.visibilityState === "hidden") {
      hiddenSincePerfMs = now();
      prev = null; // invalidate: the gap must never become a sample
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else {
      if (hiddenSincePerfMs !== null) hiddenMs += now() - hiddenSincePerfMs;
      hiddenSincePerfMs = null;
      prev = null; // discard the first delta after resuming
      if (!raf) raf = requestAnimationFrame(loop);
    }
  };

  const teardown = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (tickTimer !== null) clearInterval(tickTimer);
    tickTimer = null;
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };

  return {
    start() {
      if (status === "measuring") return;
      ring.reset();
      totalFrames = 0;
      prev = null;
      hiddenMs = 0;
      hiddenSincePerfMs = null;
      startedAtEpochMs = Date.now();
      startedAtPerfMs = now();
      stoppedAtPerfMs = startedAtPerfMs;
      status = "measuring";
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", onVisibility);
      }
      raf = requestAnimationFrame(loop);
      tickTimer = setInterval(emit, tickMs);
      emit();
    },
    stop() {
      if (status !== "measuring") return;
      if (hiddenSincePerfMs !== null) {
        hiddenMs += now() - hiddenSincePerfMs;
        hiddenSincePerfMs = null;
      }
      stoppedAtPerfMs = now();
      status = "complete";
      teardown();
      emit();
    },
    reset() {
      teardown();
      ring.reset();
      totalFrames = 0;
      prev = null;
      hiddenMs = 0;
      hiddenSincePerfMs = null;
      startedAtEpochMs = null;
      startedAtPerfMs = 0;
      stoppedAtPerfMs = 0;
      status = "idle";
      emit();
    },
    getSamples: () => ring.toArray(),
    getStatus: () => status,
    getDurationMs: durationMs,
    getStartedAtEpochMs: () => startedAtEpochMs,
    getTotalFramesObserved: () => totalFrames,
    isTruncated: () => ring.truncated,
    snapshot,
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    dispose() {
      teardown();
      subs.clear();
    },
  };
}