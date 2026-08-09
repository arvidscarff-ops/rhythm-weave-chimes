import { describe, expect, it } from "vitest";
import type { RuntimePack } from "@/lib/sound/runtimePacks";
import {
  createCompositionSnapshot,
  orderedPhaseAlignedVoices,
} from "@/lib/rhythm/compositionSnapshot";
import {
  createCompositionRevisionSession,
  queueCompositionRevision,
  type CompositionRevisionSession,
  type ProductionTimelineEvent,
} from "@/lib/rhythm/productionRhythmBridge";
import {
  createProductionScheduler,
  type ProductionSchedulerBinding,
  type ScheduledProductionEvent,
} from "./scheduler";
import type { EngineTransportLifecycleEvent } from "./clock";
import { customScene } from "@/lib/scenes/customScene";

const composition = (revision: number, baseLaps = 4) =>
  createCompositionSnapshot({
    id: "scheduler-proof",
    revision,
    macroCycleDuration: 1,
    baseLaps,
    orderedVoices: orderedPhaseAlignedVoices("proof", 2),
  });

function createHarness(initialSession = createCompositionRevisionSession(composition(1))) {
  let transportTime = 0;
  let paused = false;
  let session: CompositionRevisionSession = initialSession;
  let lifecycle: ((event: EngineTransportLifecycleEvent) => void) | null = null;
  let intervalCallback: (() => void) | null = null;
  let timeoutId = 0;
  const timeouts = new Map<number, () => void>();
  const audioEvents: ScheduledProductionEvent[] = [];
  const visualEvents: ScheduledProductionEvent[] = [];
  const projectedIds: string[] = [];
  const gates: Array<{ silenced: boolean; disconnected: boolean }> = [];
  const audioState = { currentTime: 10 };

  const audioCtx = {
    get currentTime() {
      return audioState.currentTime;
    },
    createGain() {
      const state = { silenced: false, disconnected: false };
      gates.push(state);
      return {
        gain: {
          value: 1,
          cancelScheduledValues() {},
          setValueAtTime(value: number) {
            if (value === 0) state.silenced = true;
          },
        },
        connect() {},
        disconnect() {
          state.disconnected = true;
        },
      };
    },
  } as unknown as AudioContext;

  const scheduler = createProductionScheduler({
    transport: {
      t: () => transportTime,
      isPaused: () => paused,
      sceneToAudioTime: (sceneTime) => audioState.currentTime + sceneTime - transportTime,
      subscribeLifecycle: (subscriber) => {
        lifecycle = subscriber;
        return () => {
          lifecycle = null;
        };
      },
    },
    scheduleAudio: (_ctx, _dest, _pack, event) => audioEvents.push(event),
    setInterval: ((callback: () => void) => {
      intervalCallback = callback;
      return 1;
    }) as typeof globalThis.setInterval,
    clearInterval: (() => {
      intervalCallback = null;
    }) as typeof globalThis.clearInterval,
    setTimeout: ((callback: () => void) => {
      timeoutId += 1;
      timeouts.set(timeoutId, callback);
      return timeoutId;
    }) as typeof globalThis.setTimeout,
    clearTimeout: ((id: number) => {
      timeouts.delete(id);
    }) as typeof globalThis.clearTimeout,
  });

  const binding: ProductionSchedulerBinding = {
    session: () => session,
    setSession: (next: CompositionRevisionSession) => {
      session = next;
    },
    // The projector is intentionally incapable of enumerating events: it can
    // only return one presentation for the one authoritative event supplied.
    project: (event: ProductionTimelineEvent) => {
      projectedIds.push(event.id);
      return {
        slot: (event.voiceOrder % 6) as 0 | 1 | 2 | 3 | 4 | 5,
        freq: 220 + event.voiceOrder,
        x: event.voiceOrder,
        y: event.eventInMacroCycle,
        hue: 0.5,
        velocity: 0.75,
      };
    },
    audioCtx,
    audioDest: {} as AudioNode,
    pack: () => ({}) as RuntimePack,
    visualSink: (event: ScheduledProductionEvent) => visualEvents.push(event),
  };

  scheduler.start();
  scheduler.setActive(binding);

  return {
    scheduler,
    audioEvents,
    visualEvents,
    projectedIds,
    gates,
    setPosition(sceneTime: number) {
      transportTime = sceneTime;
      audioState.currentTime = 10 + sceneTime;
    },
    setPaused(value: boolean) {
      paused = value;
    },
    emit(event: EngineTransportLifecycleEvent) {
      lifecycle?.(event);
    },
    flushVisuals() {
      const pending = [...timeouts.values()];
      timeouts.clear();
      for (const callback of pending) callback();
    },
    getSession: () => session,
    setSession(next: CompositionRevisionSession) {
      session = next;
    },
    setActivationObserver(observer: (next: CompositionRevisionSession) => void) {
      scheduler.setActive({ ...binding, onCompositionActivated: observer });
    },
    rebind() {
      scheduler.setActive(binding);
    },
    tickInterval() {
      intervalCallback?.();
    },
  };
}

describe("authoritative production scheduler", () => {
  it("keeps Custom Scene geometry outside the musical event contract", () => {
    expect(customScene.eventsIn).toBeUndefined();
    expect(customScene.projectAuthoritativeEvent).toBeUndefined();
  });

  it("schedules every event at its own occurrence instead of the horizon timestamp", () => {
    const harness = createHarness();
    harness.scheduler.resync({ secondsNumerator: 0n, secondsDenominator: 1n });
    harness.scheduler.tickNow();
    harness.setPosition(0.12);
    harness.scheduler.tickNow();
    harness.setPosition(0.24);
    harness.scheduler.tickNow();

    const occurrences = harness.audioEvents.map((event) => event.audioContextTime);
    expect(occurrences).toEqual([10, 10, 10.2, 10.25]);
    expect(new Set(harness.audioEvents.map((event) => event.id)).size).toBe(
      harness.audioEvents.length,
    );
  });

  it("keeps adjacent half-open windows duplicate-free and shares identity with rendering", () => {
    const harness = createHarness();
    harness.scheduler.resync({ secondsNumerator: 0n, secondsDenominator: 1n });
    for (const position of [0, 0.12, 0.24, 0.36, 0.48]) {
      harness.setPosition(position);
      harness.scheduler.tickNow();
      harness.flushVisuals();
    }

    const audioIds = harness.audioEvents.map((event) => event.id);
    const visualIds = harness.visualEvents.map((event) => event.id);
    expect(new Set(audioIds).size).toBe(audioIds.length);
    expect(visualIds).toEqual(audioIds);
    expect(harness.projectedIds).toEqual(audioIds);
  });

  it("gates looked-ahead audio on pause and resumes from the frozen position without catch-up", () => {
    const harness = createHarness();
    harness.scheduler.resync({ secondsNumerator: 0n, secondsDenominator: 1n });
    harness.scheduler.tickNow();
    harness.setPosition(0.12);
    harness.scheduler.tickNow();
    const futureId = harness.audioEvents.at(-1)?.id;
    const countBeforePause = harness.audioEvents.length;

    harness.setPaused(true);
    harness.emit("freeze");
    expect(harness.gates.at(-1)).toEqual({ silenced: true, disconnected: true });
    harness.scheduler.tickNow();
    expect(harness.audioEvents).toHaveLength(countBeforePause);

    harness.setPaused(false);
    harness.emit("resume");
    harness.scheduler.tickNow();
    expect(harness.audioEvents.at(-1)?.id).toBe(futureId);
    expect(
      harness.audioEvents.filter((event) => event.timelineEvent.authoritativeEvent.isPhaseZero),
    ).toHaveLength(2);
  });

  it("applies the same invalidation to hidden-tab suspension and does not replay consumed events on rebind", () => {
    const harness = createHarness();
    harness.scheduler.resync({ secondsNumerator: 0n, secondsDenominator: 1n });
    harness.scheduler.tickNow();
    const phaseZeroIds = harness.audioEvents.map((event) => event.id);

    harness.setPosition(0.05);
    harness.setPaused(true);
    harness.emit("freeze");
    harness.setPaused(false);
    harness.emit("resume");
    harness.rebind();
    harness.scheduler.tickNow();

    expect(
      harness.audioEvents
        .filter((event) => phaseZeroIds.includes(event.id))
        .map((event) => event.id),
    ).toEqual(phaseZeroIds);
  });

  it("switches queued revisions at exact Phase Zero even across a skipped scheduler frame", () => {
    const initial = createCompositionRevisionSession(composition(1));
    const queued = queueCompositionRevision(initial, composition(2, 5), 0.4);
    const harness = createHarness(queued);
    const activations: number[] = [];
    harness.setActivationObserver((next) => activations.push(next.active.composition.revision));
    harness.setPosition(0.95);
    harness.scheduler.tickNow();

    const revisionTwo = harness.audioEvents.filter(
      (event) => event.timelineEvent.compositionRevision === 2,
    );
    expect(activations).toEqual([]);
    expect(harness.getSession().active.composition.revision).toBe(1);
    harness.flushVisuals();
    expect(activations).toEqual([2]);
    expect(revisionTwo).toHaveLength(2);
    expect(revisionTwo.every((event) => event.timelineEvent.authoritativeEvent.isPhaseZero)).toBe(
      true,
    );
    expect(revisionTwo.every((event) => event.audioContextTime === 11)).toBe(true);
    expect(harness.getSession().active.composition.revision).toBe(2);
  });
});
