import { describe, expect, it } from "vitest";
import type { AuthoritativeRhythmEvent } from "./authoritativeTimeline";
import { deriveOrbitalFrame, R4_ORBITAL_GEOMETRY } from "./orbitalFamily";
import {
  derivePendulumFrame,
  R4_PENDULUM_STRANDS,
  R4_PENDULUM_TARGET_DISTANCE,
} from "./pendulumFamily";
import { createR4SharedLabAdapter } from "./r4SharedLab";
import {
  deriveStringNetworkFrame,
  R4_STRING_NETWORK_GEOMETRY,
  stringPointAtPhase,
} from "./stringNetworkFamily";
import { exactTransportSeconds, type ExactTransportSeconds } from "./liveTimelineAdapter";
import type { TriggerFamilyAuthorityInput } from "./triggerFamilyConsumer";

const adapter = createR4SharedLabAdapter();

function authorityAt(
  position: ExactTransportSeconds,
  events: readonly AuthoritativeRhythmEvent[] = [],
): TriggerFamilyAuthorityInput {
  return Object.freeze({
    snapshot: adapter.snapshotAt(position),
    events,
  });
}

function addSeconds(
  left: ExactTransportSeconds,
  right: ExactTransportSeconds,
): ExactTransportSeconds {
  return exactTransportSeconds(
    left.secondsNumerator * right.secondsDenominator +
      right.secondsNumerator * left.secondsDenominator,
    left.secondsDenominator * right.secondsDenominator,
  );
}

function isBefore(left: ExactTransportSeconds, right: ExactTransportSeconds): boolean {
  return (
    left.secondsNumerator * right.secondsDenominator <
    right.secondsNumerator * left.secondsDenominator
  );
}

function collectWithCadence(
  end: ExactTransportSeconds,
  windowSizes: readonly ExactTransportSeconds[],
): readonly AuthoritativeRhythmEvent[] {
  const events: AuthoritativeRhythmEvent[] = [];
  let cursor = exactTransportSeconds(0n);
  let windowIndex = 0;

  while (isBefore(cursor, end)) {
    const candidate = addSeconds(cursor, windowSizes[windowIndex % windowSizes.length]);
    const windowEnd = isBefore(end, candidate) ? end : candidate;
    events.push(...adapter.eventsBetween(cursor, windowEnd));
    cursor = windowEnd;
    windowIndex += 1;
  }

  return events;
}

function frameEventIds(
  frame:
    | ReturnType<typeof derivePendulumFrame>
    | ReturnType<typeof deriveOrbitalFrame>
    | ReturnType<typeof deriveStringNetworkFrame>,
): readonly string[] {
  if ("strands" in frame) {
    return frame.strands.flatMap((strand) => strand.authoritativeEventIds);
  }
  if ("strings" in frame) {
    return frame.strings.flatMap((string) => string.authoritativeEventIds);
  }
  return frame.voices.flatMap((voice) => voice.authoritativeEventIds);
}

describe("Reset R4 Trigger Engine families as pure consumers", () => {
  it("derives identical geometry from identical authoritative input", () => {
    const input = authorityAt(exactTransportSeconds(37n, 4n));

    expect(derivePendulumFrame(input)).toEqual(derivePendulumFrame(input));
    expect(deriveOrbitalFrame(input)).toEqual(deriveOrbitalFrame(input));
    expect(deriveStringNetworkFrame(input)).toEqual(deriveStringNetworkFrame(input));
  });

  it("keeps event identity independent of frame cadence for all three families", () => {
    const end = exactTransportSeconds(48n);
    const steadyEvents = collectWithCadence(end, [exactTransportSeconds(1n, 60n)]);
    const jitteryEvents = collectWithCadence(end, [
      exactTransportSeconds(7n, 1000n),
      exactTransportSeconds(9n, 20n),
      exactTransportSeconds(13n, 10n),
      exactTransportSeconds(31n, 1000n),
    ]);

    expect(steadyEvents.map((event) => event.id)).toEqual(jitteryEvents.map((event) => event.id));

    const steadyInput = authorityAt(end, steadyEvents);
    const jitteryInput = authorityAt(end, jitteryEvents);
    expect(derivePendulumFrame(steadyInput)).toEqual(derivePendulumFrame(jitteryInput));
    expect(deriveOrbitalFrame(steadyInput)).toEqual(deriveOrbitalFrame(jitteryInput));
    expect(deriveStringNetworkFrame(steadyInput)).toEqual(deriveStringNetworkFrame(jitteryInput));
  });

  it("can only project injected authoritative event IDs", () => {
    const events = adapter.eventsBetween(exactTransportSeconds(0n), exactTransportSeconds(24n));
    const input = authorityAt(exactTransportSeconds(24n), events);
    const injectedIds = new Set(events.map((event) => event.id));

    for (const frame of [
      derivePendulumFrame(input),
      deriveOrbitalFrame(input),
      deriveStringNetworkFrame(input),
    ]) {
      const ids = frameEventIds(frame);
      expect(ids.every((id) => injectedIds.has(id))).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(Object.isFrozen(frame)).toBe(true);
    }
  });

  it("feeds all families from the same shared authority", () => {
    const input = authorityAt(exactTransportSeconds(29n, 2n));
    const pendulum = derivePendulumFrame(input);
    const orbital = deriveOrbitalFrame(input);
    const strings = deriveStringNetworkFrame(input);

    expect(pendulum.source).toEqual(orbital.source);
    expect(orbital.source).toEqual(strings.source);
    expect(pendulum.source.compositionId).toBe("reset-r4-shared-family-lab");
  });

  it("reconstructs exact Phase Zero before deriving family geometry", () => {
    const phaseZeroEvents = adapter.eventsBetween(
      exactTransportSeconds(24n),
      exactTransportSeconds(24_001n, 1_000n),
    );
    const input = authorityAt(exactTransportSeconds(24n), phaseZeroEvents);
    const pendulum = derivePendulumFrame(input);
    const orbital = deriveOrbitalFrame(input);
    const strings = deriveStringNetworkFrame(input);

    expect(input.snapshot.isPhaseZero).toBe(true);
    expect(input.snapshot.macroPosition).toEqual({ numerator: 1n, denominator: 1n });
    expect(pendulum.source.isPhaseZero).toBe(true);
    expect(orbital.source.isPhaseZero).toBe(true);
    expect(strings.source.isPhaseZero).toBe(true);
    expect(
      pendulum.strands.every((strand) => strand.distance === R4_PENDULUM_TARGET_DISTANCE),
    ).toBe(true);
    expect(
      orbital.voices.every(
        (voice) => Math.abs(voice.point.x) < 1e-12 && voice.point.y === -voice.radius,
      ),
    ).toBe(true);
    expect(strings.strings.every((string) => string.point.x === string.from.x)).toBe(true);
    expect(strings.strings.every((string) => string.point.y === string.from.y)).toBe(true);
  });

  it("preserves the distinct family geometry fixtures", () => {
    expect(new Set(R4_PENDULUM_STRANDS.map((strand) => strand.voiceId)).size).toBe(9);
    expect(new Set(R4_ORBITAL_GEOMETRY.map((voice) => voice.voiceId)).size).toBe(8);
    expect(new Set(R4_STRING_NETWORK_GEOMETRY.map((string) => string.voiceId)).size).toBe(6);

    for (const string of R4_STRING_NETWORK_GEOMETRY) {
      expect(stringPointAtPhase(string, 0)).toEqual(string.from);
      expect(stringPointAtPhase(string, 0.5)).toEqual(string.to);
      expect(stringPointAtPhase(string, 1)).toEqual(string.from);
    }
  });
});
