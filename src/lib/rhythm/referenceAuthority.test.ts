/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import {
  eventsBetween,
  R3_REFERENCE_COMPOSITION,
  ReferenceTransport,
  REFERENCE_TICKS_PER_SECOND,
  secondsToTicks,
  snapshotAt,
} from "./referenceAuthority.ts";

test("normalized phases stay in [0, 1)", () => {
  for (let step = 0; step <= 12_000; step += 7) {
    const snapshot = snapshotAt(R3_REFERENCE_COMPOSITION, BigInt(step) * 1_000n);
    assert(snapshot.macroPhase >= 0 && snapshot.macroPhase < 1);
    for (const voice of snapshot.voices) {
      assert(voice.phase >= 0 && voice.phase < 1);
    }
  }
});

test("macro-cycle closure and Phase Zero are exact", () => {
  const macro = R3_REFERENCE_COMPOSITION.macroCycleTicks;
  for (const tick of [0n, macro, macro * 2n, macro * 10_000n]) {
    const snapshot = snapshotAt(R3_REFERENCE_COMPOSITION, tick);
    assert.equal(snapshot.isPhaseZero, true);
    assert.equal(snapshot.macroPhase, 0);
    assert(snapshot.voices.every((voice) => voice.phase === 0));
  }

  assert.equal(snapshotAt(R3_REFERENCE_COMPOSITION, macro - 1n).isPhaseZero, false);
});

test("event identity is deterministic and adjacent windows do not duplicate", () => {
  const split = secondsToTicks(6);
  const end = R3_REFERENCE_COMPOSITION.macroCycleTicks;
  const first = eventsBetween(R3_REFERENCE_COMPOSITION, 0n, split);
  const second = eventsBetween(R3_REFERENCE_COMPOSITION, split, end);
  const whole = eventsBetween(R3_REFERENCE_COMPOSITION, 0n, end);
  const joined = [...first, ...second];

  assert.deepEqual(
    joined.map((event) => event.id),
    whole.map((event) => event.id),
  );
  assert.equal(new Set(joined.map((event) => event.id)).size, joined.length);
  assert.deepEqual(
    eventsBetween(R3_REFERENCE_COMPOSITION, 0n, end),
    eventsBetween(R3_REFERENCE_COMPOSITION, 0n, end),
  );
});

test("frame sampling frequency cannot change musical events", () => {
  const duration = R3_REFERENCE_COMPOSITION.macroCycleTicks * 3n;
  const sample = (steps: readonly bigint[]) => {
    const ids: string[] = [];
    let cursor = 0n;
    for (const step of steps) {
      const end = cursor + step > duration ? duration : cursor + step;
      ids.push(...eventsBetween(R3_REFERENCE_COMPOSITION, cursor, end).map((event) => event.id));
      cursor = end;
      if (cursor === duration) break;
    }
    if (cursor < duration) {
      ids.push(
        ...eventsBetween(R3_REFERENCE_COMPOSITION, cursor, duration).map((event) => event.id),
      );
    }
    return ids;
  };

  const sixtyFps = Array.from({ length: 2_160 }, () => 16_667n);
  const jittery = [400_000n, 9_000n, 1_200_000n, 33_000n, 2_700_000n, 71_000n];
  assert.deepEqual(sample(sixtyFps), sample(jittery));
});

test("pause, resume, and restoration preserve canonical position", () => {
  let sourceTick = 0n;
  const transport = new ReferenceTransport(() => sourceTick);

  transport.play();
  sourceTick += 5n * REFERENCE_TICKS_PER_SECOND;
  assert.equal(transport.positionTick(), secondsToTicks(5));

  transport.pause();
  sourceTick += 20n * REFERENCE_TICKS_PER_SECOND;
  assert.equal(transport.positionTick(), secondsToTicks(5));

  transport.play();
  sourceTick += 2n * REFERENCE_TICKS_PER_SECOND;
  assert.equal(transport.positionTick(), secondsToTicks(7));

  const restored = new ReferenceTransport(() => sourceTick);
  restored.restore(transport.positionTick());
  assert.deepEqual(
    snapshotAt(R3_REFERENCE_COMPOSITION, restored.positionTick()),
    snapshotAt(R3_REFERENCE_COMPOSITION, secondsToTicks(7)),
  );
});

test("a four-hour position is derived without accumulated frame deltas", () => {
  let sourceTick = 0n;
  const transport = new ReferenceTransport(() => sourceTick);
  transport.play();
  sourceTick = secondsToTicks(4 * 60 * 60);

  const snapshot = snapshotAt(R3_REFERENCE_COMPOSITION, transport.positionTick());
  assert.equal(snapshot.macroCycleIndex, 1_200n);
  assert.equal(snapshot.isPhaseZero, true);
});
