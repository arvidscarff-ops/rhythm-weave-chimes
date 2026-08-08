import { describe, expect, it, vi } from "vitest";
import { createCrossingRuntime, phaseForProgress, DEFAULT_THRESHOLDS } from "./crossingRuntime";
import { createManualTimeSource } from "./timeSource";

function make(duration = 100) {
  const clock = createManualTimeSource(1000);
  const rt = createCrossingRuntime({
    id: "test",
    originId: "a",
    destinationId: "b",
    durationSeconds: duration,
    timeSource: clock.source,
  });
  return { clock, rt };
}

describe("phaseForProgress", () => {
  it("maps normalized progress to lifecycle phases", () => {
    const t = DEFAULT_THRESHOLDS;
    expect(phaseForProgress(0, t)).toBe("launching");
    expect(phaseForProgress(0.04, t)).toBe("launching");
    expect(phaseForProgress(0.05, t)).toBe("in_transit");
    expect(phaseForProgress(0.89, t)).toBe("in_transit");
    expect(phaseForProgress(0.9, t)).toBe("approaching");
    expect(phaseForProgress(1, t)).toBe("arrived");
  });
});

describe("crossing runtime", () => {
  it("is deterministic from elapsed time and clamps progress", () => {
    const { clock, rt } = make(100);
    rt.start();
    clock.advance(25);
    expect(rt.sample().progress).toBeCloseTo(0.25, 10);
    clock.advance(25);
    expect(rt.sample().progress).toBeCloseTo(0.5, 10);
    clock.advance(500);
    const s = rt.sample();
    expect(s.progress).toBe(1);
    expect(s.elapsedSeconds).toBe(100);
  });

  it("does not advance until sampled, and never from frame count", () => {
    const { rt } = make(100);
    rt.start();
    rt.sample();
    rt.sample();
    rt.sample();
    expect(rt.peek().progress).toBe(0);
  });

  it("transitions through the full lifecycle", () => {
    const { clock, rt } = make(100);
    const seen: string[] = [];
    rt.subscribe({ phaseChanged: (p) => seen.push(p) });
    rt.start();
    clock.advance(10);
    rt.sample();
    clock.advance(85);
    rt.sample();
    clock.advance(10);
    rt.sample();
    expect(seen).toEqual(["launching", "in_transit", "approaching", "arrived"]);
  });

  it("arrives exactly once and pins progress to 1.0 with an observable event", () => {
    const { clock, rt } = make(100);
    const arrived = vi.fn();
    const progress = vi.fn();
    rt.subscribe({ crossingArrived: arrived, progressChanged: progress });
    rt.start();
    clock.advance(99.9999);
    rt.sample();
    progress.mockClear();
    // Tiny remaining delta would be suppressed by epsilon, but arrival forces it.
    clock.advance(0.0001);
    const s = rt.sample();
    expect(s.progress).toBe(1);
    expect(progress).toHaveBeenCalledWith(1, expect.objectContaining({ phase: "arrived" }));
    clock.advance(50);
    rt.sample();
    rt.sample();
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it("suppresses progressChanged below the epsilon", () => {
    const { clock, rt } = make(100);
    const progress = vi.fn();
    rt.start();
    rt.subscribe({ progressChanged: progress });
    clock.advance(0.05); // 0.0005 progress < 0.001 epsilon
    rt.sample();
    expect(progress).not.toHaveBeenCalled();
    clock.advance(0.1);
    rt.sample();
    expect(progress).toHaveBeenCalledTimes(1);
  });

  it("pause freezes progress; resume continues without a time jump", () => {
    const { clock, rt } = make(100);
    rt.start();
    clock.advance(10);
    rt.pause();
    clock.advance(1000);
    expect(rt.sample().progress).toBeCloseTo(0.1, 10);
    rt.resume();
    clock.advance(10);
    expect(rt.sample().progress).toBeCloseTo(0.2, 10);
  });

  it("scrub runs normal transition logic and cannot double-arrive", () => {
    const { rt } = make(100);
    const arrived = vi.fn();
    rt.subscribe({ crossingArrived: arrived });
    rt.start();
    expect(rt.scrubTo(0.95).phase).toBe("approaching");
    expect(rt.scrubTo(1).phase).toBe("arrived");
    expect(arrived).toHaveBeenCalledTimes(1);
    rt.scrubTo(0.5);
    rt.scrubTo(1);
    expect(arrived).toHaveBeenCalledTimes(1);
  });

  it("reset produces a clean run and re-arms arrival", () => {
    const { clock, rt } = make(100);
    const arrived = vi.fn();
    rt.subscribe({ crossingArrived: arrived });
    rt.start();
    rt.scrubTo(1);
    const idle = rt.reset();
    expect(idle.phase).toBe("idle");
    expect(idle.progress).toBe(0);
    expect(idle.startedAtMonotonicSeconds).toBeNull();
    expect(idle.arrivedAtMonotonicSeconds).toBeNull();
    rt.start();
    clock.advance(100);
    rt.sample();
    expect(arrived).toHaveBeenCalledTimes(2);
  });

  it("records monotonic runtime seconds, not epoch timestamps", () => {
    const { clock, rt } = make(100);
    rt.start();
    expect(rt.peek().startedAtMonotonicSeconds).toBe(1000);
    clock.advance(100);
    expect(rt.sample().arrivedAtMonotonicSeconds).toBe(1100);
  });
});
