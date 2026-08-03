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
  orbitalPointAtPhase,
  R4_ORBITAL_COMPOSITION,
  R4_ORBITAL_GEOMETRY,
} from "./orbitalFamily.ts";

test("all Orbital voices close exactly at macro Phase Zero", () => {
  const macro = R4_ORBITAL_COMPOSITION.macroCycleTicks;
  for (const tick of [0n, macro, macro * 3n, macro * 10_000n]) {
    const snapshot = snapshotAt(R4_ORBITAL_COMPOSITION, tick);
    assert.equal(snapshot.isPhaseZero, true);
    assert.equal(snapshot.macroPhase, 0);
    assert(snapshot.voices.every((voice) => voice.phase === 0));
  }
});

test("every Orbital event maps to the exact north gate", () => {
  const events = eventsBetween(R4_ORBITAL_COMPOSITION, 0n, R4_ORBITAL_COMPOSITION.macroCycleTicks);
  const geometryByVoice = new Map(
    R4_ORBITAL_GEOMETRY.map((geometry) => [geometry.voiceId, geometry]),
  );

  for (const event of events) {
    const voice = snapshotAt(R4_ORBITAL_COMPOSITION, event.tick).voices.find(
      (candidate) => candidate.id === event.voiceId,
    );
    const geometry = geometryByVoice.get(event.voiceId);
    assert(voice);
    assert(geometry);
    const point = orbitalPointAtPhase(geometry, voice.phase);
    assert(Math.abs(point.x) < 1e-12);
    assert.equal(point.y, -geometry.radius);
  }
});

test("Orbital geometry covers every voice exactly once", () => {
  const voiceIds = R4_ORBITAL_COMPOSITION.voices.map((voice) => voice.id).sort();
  const geometryIds = R4_ORBITAL_GEOMETRY.map((geometry) => geometry.voiceId).sort();
  assert.deepEqual(geometryIds, voiceIds);
  assert.equal(new Set(geometryIds).size, geometryIds.length);
});

test("frame-window shape cannot change Orbital event identity", () => {
  const duration = R4_ORBITAL_COMPOSITION.macroCycleTicks * 5n;
  const collect = (steps: readonly bigint[]) => {
    const ids: string[] = [];
    let cursor = 0n;
    let stepIndex = 0;
    while (cursor < duration) {
      const step = steps[stepIndex % steps.length];
      const end = cursor + step > duration ? duration : cursor + step;
      ids.push(...eventsBetween(R4_ORBITAL_COMPOSITION, cursor, end).map((event) => event.id));
      cursor = end;
      stepIndex += 1;
    }
    return ids;
  };

  assert.deepEqual(collect([16_667n]), collect([11_000n, 280_000n, 1_700_000n, 53_000n]));
});

test("pause and remount reconstruct the same Orbital snapshot", () => {
  let sourceTick = 0n;
  const transport = new ReferenceTransport(() => sourceTick);
  transport.play();
  sourceTick = secondsToTicks(13.625);
  transport.pause();

  const preservedPosition = transport.positionTick();
  sourceTick += secondsToTicks(900);
  const remounted = new ReferenceTransport(() => sourceTick);
  remounted.restore(preservedPosition);

  assert.deepEqual(
    snapshotAt(R4_ORBITAL_COMPOSITION, remounted.positionTick()),
    snapshotAt(R4_ORBITAL_COMPOSITION, preservedPosition),
  );
});

test("a twelve-hour Orbital position and event window remain deterministic", () => {
  const position = secondsToTicks(12 * 60 * 60);
  assert.deepEqual(
    snapshotAt(R4_ORBITAL_COMPOSITION, position),
    snapshotAt(R4_ORBITAL_COMPOSITION, position),
  );
  assert.deepEqual(
    eventsBetween(R4_ORBITAL_COMPOSITION, position, position + secondsToTicks(3)),
    eventsBetween(R4_ORBITAL_COMPOSITION, position, position + secondsToTicks(3)),
  );
});
