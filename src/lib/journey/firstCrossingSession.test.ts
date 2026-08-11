import { describe, expect, it } from "vitest";
import {
  createFirstCrossingSession,
  hydrateFirstCrossingSession,
  type FirstCrossingTimeSource,
} from "./firstCrossingSession";

function manualTime(start = 0) {
  let current = start;
  const source: FirstCrossingTimeSource = () => current;
  return {
    source,
    advance(seconds: number) {
      current += seconds;
    },
    set(seconds: number) {
      current = seconds;
    },
  };
}

function makeSession(start = 0, runId = "run-001") {
  const time = manualTime(start);
  const session = createFirstCrossingSession(
    { runId, routeDefinitionId: "route-first-crossing" },
    { timeSource: time.source },
  );
  return { time, session };
}

describe("FirstCrossingSession active journey time", () => {
  it("increases only while running", () => {
    const { time, session } = makeSession(100);

    expect(session.sample().status).toBe("not_started");
    session.start();
    time.advance(12.5);

    expect(session.sample()).toEqual(
      expect.objectContaining({ status: "running", activeElapsedSeconds: 12.5 }),
    );
  });

  it("freezes on explicit pause and resumes from the exact active position", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(8);

    expect(session.pause().activeElapsedSeconds).toBe(8);
    time.advance(1_000);
    expect(session.sample().activeElapsedSeconds).toBe(8);

    session.resume();
    time.advance(3);
    expect(session.sample().activeElapsedSeconds).toBe(11);
  });

  it("freezes across long background suspension without catch-up", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(5);

    expect(session.suspendForBackground()).toEqual(
      expect.objectContaining({ status: "suspended", activeElapsedSeconds: 5 }),
    );
    time.advance(60 * 60 * 24 * 30);
    expect(session.sample().activeElapsedSeconds).toBe(5);

    session.resumeFromBackground();
    time.advance(2);
    expect(session.sample().activeElapsedSeconds).toBe(7);
  });

  it("does not auto-resume after an explicit pause while hidden", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(4);
    session.suspendForBackground();
    session.pause();

    expect(session.resumeFromBackground()).toEqual(
      expect.objectContaining({
        status: "paused",
        explicitlyPaused: true,
        backgroundSuspended: false,
      }),
    );
    time.advance(100);
    expect(session.sample().activeElapsedSeconds).toBe(4);

    session.resume();
    time.advance(1);
    expect(session.sample().activeElapsedSeconds).toBe(5);
  });

  it("allows explicit resume while hidden without advancing until visible", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(6);
    session.suspendForBackground();
    session.pause();
    session.resume();

    expect(session.sample()).toEqual(
      expect.objectContaining({
        status: "suspended",
        explicitlyPaused: false,
        backgroundSuspended: true,
        activeElapsedSeconds: 6,
      }),
    );
    time.advance(500);
    expect(session.sample().activeElapsedSeconds).toBe(6);

    session.resumeFromBackground();
    time.advance(2);
    expect(session.sample().activeElapsedSeconds).toBe(8);
  });

  it("does not truncate a large active monotonic gap", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(50_000);
    expect(session.sample().activeElapsedSeconds).toBe(50_000);
  });

  it("can accept time only through an externally owned finite boundary", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(12);

    expect(session.sampleThrough(10).activeElapsedSeconds).toBe(10);
    time.advance(1_000);
    expect(session.sampleThrough(10).activeElapsedSeconds).toBe(10);
    expect(session.completeAt(10)).toEqual(
      expect.objectContaining({ status: "completed", activeElapsedSeconds: 10 }),
    );
  });

  it("can complete at an exact boundary after a sparse observation overshoots it", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(12);

    expect(session.completeAt(10)).toEqual(
      expect.objectContaining({ status: "completed", activeElapsedSeconds: 10 }),
    );
  });

  it("does not trim time accepted before the latest sparse interval", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(5);
    session.sample();
    time.advance(5);
    session.sample();

    expect(() => session.completeAt(4)).toThrow("previously accepted journey time");
  });

  it("rejects a time source that moves backwards", () => {
    const { time, session } = makeSession(10);
    session.start();
    time.advance(2);
    expect(session.sample().activeElapsedSeconds).toBe(2);
    time.set(11);
    expect(() => session.sample()).toThrow("must be monotonic");
  });
});

describe("FirstCrossingSession identity and reconstruction", () => {
  it("preserves identity, elapsed time, and running state through JSON hydration", () => {
    const { time, session } = makeSession(1_000, "run-stable");
    session.start();
    time.advance(9);

    const serialized = JSON.parse(JSON.stringify(session.snapshot())) as unknown;
    const restoreTime = manualTime(90_000);
    const restored = hydrateFirstCrossingSession(serialized, {
      timeSource: restoreTime.source,
    });

    expect(restored.sample()).toEqual(
      expect.objectContaining({
        status: "running",
        activeElapsedSeconds: 9,
        config: {
          runId: "run-stable",
          routeDefinitionId: "route-first-crossing",
        },
      }),
    );
    restoreTime.advance(3);
    expect(restored.sample().activeElapsedSeconds).toBe(12);
  });

  it("hydrates without counting time spent away", () => {
    const { time, session } = makeSession(20);
    session.start();
    time.advance(7);
    const snapshot = session.snapshot();

    const restoreTime = manualTime(9_000_000);
    const restored = hydrateFirstCrossingSession(snapshot, {
      timeSource: restoreTime.source,
    });

    expect(restored.sample().activeElapsedSeconds).toBe(7);
  });

  it("preserves explicit pause and suspension gates through hydration", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(3);
    session.suspendForBackground();
    session.pause();

    const snapshot = session.snapshot();
    const restoredTime = manualTime(10_000);
    const restored = hydrateFirstCrossingSession(snapshot, {
      timeSource: restoredTime.source,
    });

    expect(restored.sample()).toEqual(
      expect.objectContaining({
        status: "paused",
        explicitlyPaused: true,
        backgroundSuspended: true,
        activeElapsedSeconds: 3,
      }),
    );
    restored.resumeFromBackground();
    restoredTime.advance(100);
    expect(restored.sample().activeElapsedSeconds).toBe(3);
  });

  it("keeps configuration and snapshots immutable", () => {
    const { session } = makeSession();
    const snapshot = session.snapshot();

    expect(Object.isFrozen(session.config)).toBe(true);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.config)).toBe(true);
    expect(Object.isFrozen(snapshot.lifecycle)).toBe(true);
  });

  it("can peek accepted state and snapshot without consulting advancing time", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(5);

    expect(session.peek().activeElapsedSeconds).toBe(0);
    expect(session.peekSnapshot().lifecycle.activeElapsedSeconds).toBe(0);
    expect(session.snapshot().lifecycle.activeElapsedSeconds).toBe(5);
  });

  it("does not generate or replace run identity during hydration", () => {
    const { session } = makeSession(0, "caller-owned-run-id");
    const restored = hydrateFirstCrossingSession(session.snapshot(), {
      timeSource: manualTime().source,
    });

    expect(restored.config.runId).toBe("caller-owned-run-id");
    expect(restored.config.routeDefinitionId).toBe("route-first-crossing");
  });

  it("keeps multiple sessions fully independent", () => {
    const first = makeSession(0, "run-a");
    const second = makeSession(100, "run-b");
    first.session.start();
    second.session.start();

    first.time.advance(5);
    second.time.advance(2);
    first.session.pause();
    second.time.advance(3);

    expect(first.session.sample()).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ runId: "run-a" }),
        status: "paused",
        activeElapsedSeconds: 5,
      }),
    );
    expect(second.session.sample()).toEqual(
      expect.objectContaining({
        config: expect.objectContaining({ runId: "run-b" }),
        status: "running",
        activeElapsedSeconds: 5,
      }),
    );
  });

  it("freezes permanently when completed", () => {
    const { time, session } = makeSession();
    session.start();
    time.advance(10);
    expect(session.complete()).toEqual(
      expect.objectContaining({ status: "completed", activeElapsedSeconds: 10 }),
    );
    time.advance(1_000);
    expect(session.sample().activeElapsedSeconds).toBe(10);
    expect(session.suspendForBackground()).toEqual(
      expect.objectContaining({
        status: "completed",
        explicitlyPaused: false,
        backgroundSuspended: false,
        activeElapsedSeconds: 10,
      }),
    );
    expect(session.resumeFromBackground().activeElapsedSeconds).toBe(10);
  });

  it("rejects malformed or internally inconsistent snapshots", () => {
    expect(() =>
      hydrateFirstCrossingSession({
        schemaVersion: 1,
        config: { runId: "run", routeDefinitionId: "route" },
        lifecycle: {
          started: false,
          completed: true,
          explicitlyPaused: false,
          backgroundSuspended: false,
          activeElapsedSeconds: 0,
        },
      }),
    ).toThrow("must also be started");
  });
});
