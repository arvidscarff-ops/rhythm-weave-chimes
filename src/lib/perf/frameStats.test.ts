import { describe, expect, it } from "vitest";
import {
  computeFrameStats,
  medianSorted,
  percentileSorted,
  SLOW_THRESHOLDS,
} from "./frameStats";

describe("percentile / median helpers", () => {
  it("uses nearest-rank percentiles", () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentileSorted(sorted, 0.5)).toBe(5);
    expect(percentileSorted(sorted, 0.95)).toBe(10);
    expect(percentileSorted(sorted, 0.99)).toBe(10);
    expect(percentileSorted([], 0.95)).toBe(0);
  });

  it("averages the two middles for even-length medians", () => {
    expect(medianSorted([1, 2, 3])).toBe(2);
    expect(medianSorted([1, 2, 3, 4])).toBe(2.5);
    expect(medianSorted([])).toBe(0);
  });
});

describe("computeFrameStats", () => {
  it("returns zeroed stats for an empty sample set (never NaN)", () => {
    const s = computeFrameStats([]);
    expect(s.sampleCount).toBe(0);
    expect(s.averageFps).toBe(0);
    expect(s.averageFrameMs).toBe(0);
    expect(s.medianFrameMs).toBe(0);
    expect(s.p95FrameMs).toBe(0);
    expect(s.p99FrameMs).toBe(0);
    expect(s.worstFrameMs).toBe(0);
    expect(s.slowFrames33.count).toBe(0);
    expect(s.slowFrames33.percent).toBe(0);
    expect(Number.isNaN(s.averageFps)).toBe(false);
  });

  it("handles a single sample", () => {
    const s = computeFrameStats([20]);
    expect(s.sampleCount).toBe(1);
    expect(s.averageFrameMs).toBe(20);
    expect(s.medianFrameMs).toBe(20);
    expect(s.p95FrameMs).toBe(20);
    expect(s.p99FrameMs).toBe(20);
    expect(s.worstFrameMs).toBe(20);
    expect(s.averageFps).toBeCloseTo(50, 6);
    expect(s.slowFrames16.count).toBe(1);
    expect(s.slowFrames33.count).toBe(0);
  });

  it("computes hand-checked values for a known array", () => {
    // 10 samples, unsorted on purpose.
    const samples = [16, 17, 100, 16, 16, 34, 16, 16, 51, 18];
    // sorted: 16,16,16,16,16,17,18,34,51,100  → sum 300, avg 30
    const s = computeFrameStats(samples);
    expect(s.sampleCount).toBe(10);
    expect(s.averageFrameMs).toBe(30);
    expect(s.medianFrameMs).toBe(16.5); // (16 + 17) / 2
    expect(s.p95FrameMs).toBe(100); // ceil(0.95*10)-1 = 9
    expect(s.p99FrameMs).toBe(100);
    expect(s.worstFrameMs).toBe(100);
    expect(s.averageFps).toBeCloseTo(1000 / 30, 6);
    expect(s.slowFrames16.count).toBe(5); // 17,18,34,51,100
    expect(s.slowFrames33.count).toBe(3); // 34,51,100
    expect(s.slowFrames50.count).toBe(2); // 51,100
    expect(s.slowFrames33.percent).toBeCloseTo(30, 6);
  });

  it("does not mutate the caller's array", () => {
    const samples = [30, 10, 20];
    computeFrameStats(samples);
    expect(samples).toEqual([30, 10, 20]);
  });

  it("treats thresholds as strictly-greater-than", () => {
    const exact = computeFrameStats([SLOW_THRESHOLDS.ms16, SLOW_THRESHOLDS.ms33]);
    expect(exact.slowFrames16.count).toBe(1); // 33.33 > 16.67, 16.67 is not > itself
    expect(exact.slowFrames33.count).toBe(0);

    const just = computeFrameStats([SLOW_THRESHOLDS.ms16 + 0.001]);
    expect(just.slowFrames16.count).toBe(1);
  });

  it("handles all-fast and all-slow arrays", () => {
    const fast = computeFrameStats([8, 8, 8, 8]);
    expect(fast.slowFrames16.count).toBe(0);
    expect(fast.averageFps).toBeCloseTo(125, 6);

    const slow = computeFrameStats([60, 70, 80, 90]);
    expect(slow.slowFrames50.count).toBe(4);
    expect(slow.slowFrames50.percent).toBe(100);
  });
});