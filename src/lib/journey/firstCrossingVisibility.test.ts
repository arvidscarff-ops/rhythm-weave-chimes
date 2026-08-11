import { describe, expect, it, vi } from "vitest";
import { createFirstCrossingSession, type FirstCrossingTimeSource } from "./firstCrossingSession";
import {
  installFirstCrossingVisibility,
  type FirstCrossingVisibilitySource,
} from "./firstCrossingVisibility";

function visibilityHarness(initiallyHidden: boolean) {
  let hidden = initiallyHidden;
  let listener: () => void = () => undefined;
  const remove = vi.fn();
  const source: FirstCrossingVisibilitySource = {
    get hidden() {
      return hidden;
    },
    addEventListener(_type, next) {
      listener = next;
    },
    removeEventListener(_type, next) {
      remove(next);
      if (listener === next) listener = () => undefined;
    },
  };

  return {
    source,
    setHidden(value: boolean) {
      hidden = value;
      listener();
    },
    remove,
  };
}

function sessionHarness() {
  let now = 0;
  const source: FirstCrossingTimeSource = () => now;
  const session = createFirstCrossingSession(
    { runId: "run-visibility", routeDefinitionId: "route-first-crossing" },
    { timeSource: source },
  );
  return {
    session,
    advance(seconds: number) {
      now += seconds;
    },
  };
}

describe("First Crossing document visibility adapter", () => {
  it("synchronizes initial hidden state and resumes without catch-up", () => {
    const visibility = visibilityHarness(true);
    const journey = sessionHarness();
    const cleanup = installFirstCrossingVisibility(visibility.source, journey.session);

    expect(journey.session.start().status).toBe("suspended");
    journey.advance(10_000);
    expect(journey.session.sample().activeElapsedSeconds).toBe(0);

    visibility.setHidden(false);
    journey.advance(4);
    expect(journey.session.sample()).toEqual(
      expect.objectContaining({ status: "running", activeElapsedSeconds: 4 }),
    );

    cleanup();
    expect(visibility.remove).toHaveBeenCalledTimes(1);
  });

  it("does not override an explicit pause made while hidden", () => {
    const visibility = visibilityHarness(false);
    const journey = sessionHarness();
    installFirstCrossingVisibility(visibility.source, journey.session);
    journey.session.start();
    journey.advance(2);

    visibility.setHidden(true);
    journey.session.pause();
    journey.advance(500);
    visibility.setHidden(false);

    expect(journey.session.sample()).toEqual(
      expect.objectContaining({ status: "paused", activeElapsedSeconds: 2 }),
    );
  });
});
