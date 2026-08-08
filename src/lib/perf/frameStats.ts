/**
 * SYS-005 — pure frame statistics.
 *
 * No timers, no DOM, no React. Every function here is deterministic given its
 * input array, which is what makes the aggregation unit-testable in isolation
 * from the collector that produces the samples.
 *
 * Percentile method: NEAREST-RANK on the ascending-sorted sample array.
 *   index = clamp(ceil(p * n) - 1, 0, n - 1)
 * This is stated explicitly so two measurement runs are comparable and so
 * nobody has to guess whether interpolation was applied.
 *
 * There is deliberately NO composite "performance score".
 */

/** Slow-frame thresholds in milliseconds. A frame counts when delta > threshold. */
export const SLOW_THRESHOLDS = {
  ms16: 1000 / 60, // 16.666…
  ms33: 1000 / 30, // 33.333…
  ms50: 50,
} as const;

export type SlowFrameBucket = {
  /** Threshold in ms; frames strictly greater than this are counted. */
  thresholdMs: number;
  count: number;
  /** 0–100, relative to sampleCount. 0 when there are no samples. */
  percent: number;
};

export type FrameStats = {
  sampleCount: number;
  averageFps: number;
  averageFrameMs: number;
  medianFrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  worstFrameMs: number;
  slowFrames16: SlowFrameBucket;
  slowFrames33: SlowFrameBucket;
  slowFrames50: SlowFrameBucket;
};

const EMPTY_BUCKET = (thresholdMs: number): SlowFrameBucket => ({
  thresholdMs,
  count: 0,
  percent: 0,
});

export const EMPTY_FRAME_STATS: FrameStats = {
  sampleCount: 0,
  averageFps: 0,
  averageFrameMs: 0,
  medianFrameMs: 0,
  p95FrameMs: 0,
  p99FrameMs: 0,
  worstFrameMs: 0,
  slowFrames16: EMPTY_BUCKET(SLOW_THRESHOLDS.ms16),
  slowFrames33: EMPTY_BUCKET(SLOW_THRESHOLDS.ms33),
  slowFrames50: EMPTY_BUCKET(SLOW_THRESHOLDS.ms50),
};

/** Nearest-rank percentile over an ASCENDING-sorted array. `p` is 0..1. */
export function percentileSorted(sorted: readonly number[], p: number): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const rank = Math.ceil(p * n) - 1;
  const idx = Math.min(n - 1, Math.max(0, rank));
  return sorted[idx]!;
}

/** Median over an ASCENDING-sorted array. Even lengths average the two middles. */
export function medianSorted(sorted: readonly number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = n >> 1;
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function bucket(sorted: readonly number[], thresholdMs: number): SlowFrameBucket {
  const n = sorted.length;
  // Sorted ascending: find the first index strictly greater than the threshold.
  let lo = 0;
  let hi = n;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid]! > thresholdMs) hi = mid;
    else lo = mid + 1;
  }
  const count = n - lo;
  return { thresholdMs, count, percent: n === 0 ? 0 : (count / n) * 100 };
}

/**
 * Aggregate raw frame deltas (ms) into a stable statistics object.
 * The input array is copied before sorting, so the caller's buffer is untouched.
 */
export function computeFrameStats(samplesMs: readonly number[]): FrameStats {
  const n = samplesMs.length;
  if (n === 0) return { ...EMPTY_FRAME_STATS };

  const sorted = Array.from(samplesMs).sort((a, b) => a - b);
  let total = 0;
  for (let i = 0; i < n; i++) total += sorted[i]!;
  const averageFrameMs = total / n;

  return {
    sampleCount: n,
    averageFrameMs,
    averageFps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
    medianFrameMs: medianSorted(sorted),
    p95FrameMs: percentileSorted(sorted, 0.95),
    p99FrameMs: percentileSorted(sorted, 0.99),
    worstFrameMs: sorted[n - 1]!,
    slowFrames16: bucket(sorted, SLOW_THRESHOLDS.ms16),
    slowFrames33: bucket(sorted, SLOW_THRESHOLDS.ms33),
    slowFrames50: bucket(sorted, SLOW_THRESHOLDS.ms50),
  };
}