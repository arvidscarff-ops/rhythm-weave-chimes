/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  eventsBetween,
  ReferenceTransport,
  secondsToTicks,
  snapshotAt,
} from "./referenceAuthority.ts";
import {
  pendulumDistanceAtPhase,
  R4_PENDULUM_COMPOSITION,
  R4_PENDULUM_STRANDS,
  R4_PENDULUM_TARGET_DISTANCE,
} from "./pendulumFamily.ts";

test("all Pendulum voices close exactly at macro Phase Zero", () => {
  const macro = R4_PENDULUM_COMPOSITION.macroCycleTicks;
  for (const tick of [0n, macro, macro * 2n, macro * 500n]) {
    const snapshot = snapshotAt(R4_PENDULUM_COMPOSITION, tick);
    assert.equal(snapshot.isPhaseZero, true);
    assert.equal(snapshot.macroPhase, 0);
    assert(snapshot.voices.every((voice) => voice.phase === 0));
  }
});

test("every authoritative event maps to exact Pendulum target contact", () => {
  const events = eventsBetween(
    R4_PENDULUM_COMPOSITION,
    0n,
    R4_PENDULUM_COMPOSITION.macroCycleTicks,
  );
  assert(events.length > 0);

  for (const event of events) {
    const voice = snapshotAt(R4_PENDULUM_COMPOSITION, event.tick).voices.find(
      (candidate) => candidate.id === event.voiceId,
    );
    assert(voice);
    assert.equal(voice.phase, 0);
    assert.equal(pendulumDistanceAtPhase(voice.phase), R4_PENDULUM_TARGET_DISTANCE);
  }
});

test("visual strand definitions cover each musical voice exactly once", () => {
  const voiceIds = R4_PENDULUM_COMPOSITION.voices.map((voice) => voice.id).sort();
  const strandIds = R4_PENDULUM_STRANDS.map((strand) => strand.voiceId).sort();
  assert.deepEqual(strandIds, voiceIds);
  assert.equal(new Set(strandIds).size, strandIds.length);
});

test("frame-window shape cannot change Pendulum event identity", () => {
  const duration = R4_PENDULUM_COMPOSITION.macroCycleTicks * 4n;
  const collect = (steps: readonly bigint[]) => {
    const ids: string[] = [];
    let cursor = 0n;
    let stepIndex = 0;
    while (cursor < duration) {
      const step = steps[stepIndex % steps.length];
      const end = cursor + step > duration ? duration : cursor + step;
      ids.push(...eventsBetween(R4_PENDULUM_COMPOSITION, cursor, end).map((event) => event.id));
      cursor = end;
      stepIndex += 1;
    }
    return ids;
  };

  assert.deepEqual(collect([16_667n]), collect([7_000n, 190_000n, 2_100_000n, 31_000n, 770_000n]));
});

test("pause, resume, and remount reconstruction preserve Pendulum state", () => {
  let sourceTick = 0n;
  const transport = new ReferenceTransport(() => sourceTick);
  transport.play();
  sourceTick = secondsToTicks(11.375);
  transport.pause();

  const preservedPosition = transport.positionTick();
  sourceTick += secondsToTicks(600);
  assert.equal(transport.positionTick(), preservedPosition);

  const remounted = new ReferenceTransport(() => sourceTick);
  remounted.restore(preservedPosition);
  assert.deepEqual(
    snapshotAt(R4_PENDULUM_COMPOSITION, remounted.positionTick()),
    snapshotAt(R4_PENDULUM_COMPOSITION, preservedPosition),
  );
});

test("a hidden-tab-sized clock jump reconstructs without accumulated deltas", () => {
  let sourceTick = 0n;
  const transport = new ReferenceTransport(() => sourceTick);
  transport.play();
  sourceTick = secondsToTicks(45 * 60);

  assert.deepEqual(
    snapshotAt(R4_PENDULUM_COMPOSITION, transport.positionTick()),
    snapshotAt(R4_PENDULUM_COMPOSITION, secondsToTicks(45 * 60)),
  );
});

test("an eight-hour Pendulum position remains deterministic", () => {
  const position = secondsToTicks(8 * 60 * 60);
  assert.deepEqual(
    snapshotAt(R4_PENDULUM_COMPOSITION, position),
    snapshotAt(R4_PENDULUM_COMPOSITION, position),
  );
  assert.deepEqual(
    eventsBetween(R4_PENDULUM_COMPOSITION, position, position + secondsToTicks(2)),
    eventsBetween(R4_PENDULUM_COMPOSITION, position, position + secondsToTicks(2)),
  );
});
