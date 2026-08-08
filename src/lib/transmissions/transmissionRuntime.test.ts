import { describe, expect, it } from "vitest";
import { createManualTimeSource } from "@/lib/crossing/timeSource";
import { createTransmissionRuntime } from "./transmissionRuntime";
import type { TransmissionDefinition } from "./transmissionTypes";

const DEFS: TransmissionDefinition[] = [
  { id: "a", label: "Transmission A", windowStart: 0.1, windowEnd: 0.25, durationSeconds: 6, weight: 1, oncePerCrossing: true },
  { id: "b", label: "Transmission B", windowStart: 0.35, windowEnd: 0.55, durationSeconds: 8, weight: 1, oncePerCrossing: true },
  { id: "c", label: "Transmission C", windowStart: 0.7, windowEnd: 0.88, durationSeconds: 5, weight: 1, oncePerCrossing: true },
];

function make(opts: Partial<Parameters<typeof createTransmissionRuntime>[0]> = {}) {
  const clock = createManualTimeSource(100);
  const rt = createTransmissionRuntime({
    definitions: DEFS,
    timeSource: clock.source,
    admissionChance: 1,
    minGapSeconds: 0,
    ...opts,
  });
  return { rt, clock };
}

const snap = (progress: number, phase = "in_transit") => ({
  crossingId: "run-1",
  progress,
  phase,
});

describe("transmission runtime — eligibility", () => {
  it("fires nothing outside any eligibility window", () => {
    const { rt } = make();
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    for (const p of [0, 0.05, 0.3, 0.6, 0.95]) {
      const s = rt.update(snap(p));
      expect(s.current).toBeNull();
      expect(s.eligibleTransmissionIds).toEqual([]);
    }
  });

  it("starts an eligible transmission inside its window", () => {
    const { rt } = make();
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    const s = rt.update(snap(0.15));
    expect(s.current?.definition.id).toBe("a");
    expect(s.eligibleTransmissionIds).toEqual(["a"]);
  });
});

describe("transmission runtime — scheduling constraints", () => {
  it("never repeats a oncePerCrossing item within a run", () => {
    const { rt, clock } = make();
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    clock.advance(6);
    rt.update(snap(0.2));
    expect(rt.peek().current).toBeNull();
    const s = rt.update(snap(0.22));
    expect(s.current).toBeNull();
    expect(s.playedTransmissionIds).toEqual(["a"]);
  });

  it("allows a non-once item to recur in a later episode", () => {
    const recurring: TransmissionDefinition[] = [
      { ...DEFS[0], oncePerCrossing: false },
    ];
    const { rt, clock } = make({ definitions: recurring });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    expect(rt.peek().current?.definition.id).toBe("a");
    clock.advance(6);
    rt.update(snap(0.2));
    expect(rt.peek().current).toBeNull();
    // Same episode: no replay.
    rt.update(snap(0.21));
    expect(rt.peek().current).toBeNull();
    // Leave and re-enter the window → new episode → may play again.
    rt.update(snap(0.05));
    const s = rt.update(snap(0.15));
    expect(s.current?.definition.id).toBe("a");
  });

  it("keeps only one transmission active at a time (overlapping windows)", () => {
    const overlapping: TransmissionDefinition[] = [
      { ...DEFS[0], id: "x", windowStart: 0.1, windowEnd: 0.5, durationSeconds: 10 },
      { ...DEFS[1], id: "y", windowStart: 0.1, windowEnd: 0.5, durationSeconds: 10 },
    ];
    const { rt, clock } = make({ definitions: overlapping });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    const first = rt.update(snap(0.2)).current?.definition.id;
    expect(first).toBeDefined();
    clock.advance(1);
    const s = rt.update(snap(0.25));
    expect(s.current?.definition.id).toBe(first);
  });

  it("ends an active transmission when its duration elapses", () => {
    const { rt, clock } = make();
    const ended: string[] = [];
    rt.subscribe({ transmissionEnded: (t, reason) => ended.push(`${t.definition.id}:${reason}`) });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    clock.advance(5.9);
    expect(rt.sample().current).not.toBeNull();
    clock.advance(0.2);
    expect(rt.sample().current).toBeNull();
    expect(ended).toEqual(["a:completed"]);
  });

  it("respects the minimum gap between transmissions", () => {
    const back2back: TransmissionDefinition[] = [
      { ...DEFS[0], id: "x", windowStart: 0.1, windowEnd: 0.9, durationSeconds: 2, oncePerCrossing: true },
      { ...DEFS[1], id: "y", windowStart: 0.1, windowEnd: 0.9, durationSeconds: 2, oncePerCrossing: true },
    ];
    const { rt, clock } = make({ definitions: back2back, minGapSeconds: 5 });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.2));
    clock.advance(2);
    rt.update(snap(0.3));
    expect(rt.peek().current).toBeNull();
    clock.advance(1);
    expect(rt.update(snap(0.35)).current).toBeNull();
    clock.advance(5);
    expect(rt.update(snap(0.4)).current).not.toBeNull();
  });

  it("reset clears per-run state", () => {
    const { rt } = make();
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    const s = rt.reset();
    expect(s.current).toBeNull();
    expect(s.playedTransmissionIds).toEqual([]);
    expect(s.eligibleTransmissionIds).toEqual([]);
  });
});

describe("transmission runtime — determinism", () => {
  const runWithSeed = (seed: string) => {
    const { rt, clock } = make({ admissionChance: 0.5 });
    const started: string[] = [];
    rt.subscribe({ transmissionStarted: (t) => started.push(t.definition.id) });
    rt.startCrossing({ crossingId: "run-1", seed });
    for (let i = 0; i <= 100; i++) {
      rt.update(snap(i / 100));
      clock.advance(0.5);
    }
    return started;
  };

  it("same seed + same inputs produce the same selection", () => {
    expect(runWithSeed("seed-1")).toEqual(runWithSeed("seed-1"));
  });

  it("a different seed can produce a different valid selection", () => {
    const results = ["s1", "s2", "s3", "s4", "s5", "s6"].map(runWithSeed);
    const distinct = new Set(results.map((r) => r.join(",")));
    expect(distinct.size).toBeGreaterThan(1);
    for (const r of results) {
      for (const id of r) expect(["a", "b", "c"]).toContain(id);
    }
  });

  it("admission does not depend on update frequency", () => {
    const run = (step: number) => {
      const { rt, clock } = make({ admissionChance: 0.5 });
      const started: string[] = [];
      rt.subscribe({ transmissionStarted: (t) => started.push(t.definition.id) });
      rt.startCrossing({ crossingId: "run-1", seed: "rate" });
      // Both runs traverse identical progress *and* identical elapsed time;
      // only the sampling granularity differs.
      const totalSeconds = 60;
      for (let t = 0; t <= totalSeconds; t += step) {
        clock.set(100 + t);
        rt.update(snap(t / totalSeconds));
      }
      return started;
    };
    const dense = run(0.1);
    const sparse = run(2);
    expect(sparse).toEqual(dense);
  });
});

describe("transmission runtime — progress jumps and arrival", () => {
  it("does not retroactively fire a window that was skipped over", () => {
    const { rt } = make();
    const started: string[] = [];
    rt.subscribe({ transmissionStarted: (t) => started.push(t.definition.id) });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.2));   // inside A
    rt.update(snap(0.8));   // jumped past B entirely, now inside C
    expect(started).toEqual(["a"]);
    expect(rt.peek().current?.definition.id).toBe("a");
  });

  it("jumping 0.20 → 0.80 never plays the 0.35–0.55 item", () => {
    const onlyB = [DEFS[1]];
    const { rt } = make({ definitions: onlyB });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.2));
    const s = rt.update(snap(0.8));
    expect(s.current).toBeNull();
    expect(s.playedTransmissionIds).toEqual([]);
  });

  it("scrubbing backwards does not replay a oncePerCrossing transmission", () => {
    const { rt, clock } = make();
    const started: string[] = [];
    rt.subscribe({ transmissionStarted: (t) => started.push(t.definition.id) });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    clock.advance(6);
    rt.update(snap(0.4));
    rt.update(snap(0.05));
    rt.update(snap(0.15)); // back inside A's window: new episode, but played
    expect(started.filter((id) => id === "a")).toHaveLength(1);
  });

  it("arrival ends the active transmission immediately, exactly once", () => {
    const { rt } = make();
    const ended: string[] = [];
    rt.subscribe({ transmissionEnded: (t, reason) => ended.push(`${t.definition.id}:${reason}`) });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    rt.update(snap(0.15));
    expect(rt.peek().current).not.toBeNull();
    rt.update(snap(1, "arrived"));
    rt.update(snap(1, "arrived"));
    rt.sample();
    expect(ended).toEqual(["a:arrival"]);
    expect(rt.peek().current).toBeNull();
  });

  it("starts nothing after arrival and leaves valid state", () => {
    const late = [{ ...DEFS[2], windowStart: 0.7, windowEnd: 1.01 }];
    const { rt } = make({ definitions: late });
    rt.startCrossing({ crossingId: "run-1", seed: "s" });
    const s = rt.update(snap(1, "arrived"));
    expect(s.current).toBeNull();
    expect(s.activeUntilSeconds).toBeNull();
    expect(s.remainingSeconds).toBeNull();
    expect(s.playedTransmissionIds).toEqual([]);
  });
});
