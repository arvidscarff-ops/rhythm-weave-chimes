/**
 * Single production look-ahead scheduler.
 *
 * Migrated Phase-Alignment engines provide presentation metadata for events
 * already enumerated by the authoritative timeline. Historical
 * Wheel/Pendulum/Bars are quarantined at /dev/legacy-rhythm, retain their old
 * immediate dispatch solely for comparison, and never bind here. Their code
 * must not be used as a template for new Trigger Engines.
 */

import { engineClock, type EngineTransportLifecycleEvent } from "./clock";
import {
  triggerPackVoice,
  BUILTIN_RUNTIME_PACKS,
  type RuntimePack,
} from "@/lib/sound/runtimePacks";
import type { PackId } from "@/lib/sound/packs";
import type { TriggerEvent } from "./sceneTypes";
import { applyOverlay } from "./sceneOverlay";
import {
  advanceCompositionRevisionSession,
  type CompositionRevisionSession,
  type ProductionTimelineEvent,
} from "@/lib/rhythm/productionRhythmBridge";
import {
  addTransportSeconds,
  compareTransportSeconds,
  exactTransportSeconds,
  transportSecondsFromNumber,
  transportSecondsToNumber,
  type ExactTransportSeconds,
} from "@/lib/rhythm/liveTimelineAdapter";

const TICK_MS = 25;
const HORIZON_S = 0.12;
const MAX_CONSUMED_IDENTITIES = 8_192;

const PACK_BY_ID = new Map<PackId, RuntimePack>(
  BUILTIN_RUNTIME_PACKS.flatMap((pack) =>
    pack.kind === "builtin" ? [[pack.id, pack] as const] : [],
  ),
);

export type ScheduledProductionEvent = Readonly<{
  id: string;
  timelineEvent: ProductionTimelineEvent;
  presentation: TriggerEvent;
  audioContextTime: number;
}>;

export type ProductionSchedulerBinding = Readonly<{
  session(): CompositionRevisionSession;
  setSession(session: CompositionRevisionSession): void;
  project(event: ProductionTimelineEvent): TriggerEvent;
  audioCtx: AudioContext;
  audioDest: AudioNode;
  pack(): RuntimePack;
  visualSink(event: ScheduledProductionEvent): void;
  onCompositionActivated?(session: CompositionRevisionSession): void;
}>;

type SchedulerTransport = Readonly<{
  t(): number;
  isPaused(): boolean;
  sceneToAudioTime(sceneTime: number): number;
  subscribeLifecycle(subscriber: (event: EngineTransportLifecycleEvent) => void): () => void;
}>;

type SchedulerDependencies = Readonly<{
  transport: SchedulerTransport;
  scheduleAudio(
    audioCtx: AudioContext,
    audioDest: AudioNode,
    pack: RuntimePack,
    event: ScheduledProductionEvent,
  ): void;
  setInterval: typeof globalThis.setInterval;
  clearInterval: typeof globalThis.clearInterval;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
}>;

type ScheduledRecord = {
  audioContextTime: number;
  visualTimer: ReturnType<typeof setTimeout> | null;
};

export function createProductionScheduler(dependencies: SchedulerDependencies) {
  const { transport } = dependencies;
  let timer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeLifecycle: (() => void) | null = null;
  let active: ProductionSchedulerBinding | null = null;
  let schedulingSession: CompositionRevisionSession | null = null;
  let lastScheduledPosition: ExactTransportSeconds = exactTransportSeconds(0n);
  let generationGate: GainNode | null = null;
  let activationTimer: ReturnType<typeof setTimeout> | null = null;
  const scheduledRecords = new Map<string, ScheduledRecord>();
  const consumedIds = new Set<string>();
  const consumedOrder: string[] = [];

  const rememberConsumed = (id: string) => {
    if (consumedIds.has(id)) return;
    consumedIds.add(id);
    consumedOrder.push(id);
    while (consumedOrder.length > MAX_CONSUMED_IDENTITIES) {
      const oldest = consumedOrder.shift();
      if (oldest) consumedIds.delete(oldest);
    }
  };

  const forgetConsumed = (id: string) => {
    consumedIds.delete(id);
    const index = consumedOrder.indexOf(id);
    if (index >= 0) consumedOrder.splice(index, 1);
  };

  const silenceGeneration = () => {
    if (!active || !generationGate) return;
    const now = active.audioCtx.currentTime;
    generationGate.gain.cancelScheduledValues(now);
    generationGate.gain.setValueAtTime(0, now);
    generationGate.disconnect();
    generationGate = null;
  };

  const invalidateFuture = () => {
    silenceGeneration();
    if (activationTimer != null) dependencies.clearTimeout(activationTimer);
    activationTimer = null;
    const audioNow = active?.audioCtx.currentTime ?? 0;
    for (const [id, record] of scheduledRecords) {
      if (record.visualTimer != null) dependencies.clearTimeout(record.visualTimer);
      if (record.audioContextTime > audioNow) forgetConsumed(id);
    }
    scheduledRecords.clear();
    schedulingSession = active?.session() ?? null;
    lastScheduledPosition = transportSecondsFromNumber(transport.t());
  };

  const resetOrigin = () => {
    invalidateFuture();
    consumedIds.clear();
    consumedOrder.length = 0;
    lastScheduledPosition = exactTransportSeconds(0n);
  };

  const handleLifecycle = (event: EngineTransportLifecycleEvent) => {
    if (event === "origin-reset") resetOrigin();
    else invalidateFuture();
  };

  const ensureGenerationGate = (binding: ProductionSchedulerBinding): GainNode => {
    if (generationGate) return generationGate;
    const gate = binding.audioCtx.createGain();
    gate.gain.value = 1;
    gate.connect(binding.audioDest);
    generationGate = gate;
    return gate;
  };

  const scheduleVisual = (
    binding: ProductionSchedulerBinding,
    scheduled: ScheduledProductionEvent,
  ): ReturnType<typeof setTimeout> | null => {
    const delayMs = Math.max(0, (scheduled.audioContextTime - binding.audioCtx.currentTime) * 1000);
    if (delayMs < 4) {
      binding.visualSink(scheduled);
      return null;
    }
    return dependencies.setTimeout(() => {
      const record = scheduledRecords.get(scheduled.id);
      if (!record) return;
      scheduledRecords.delete(scheduled.id);
      binding.visualSink(scheduled);
    }, delayMs);
  };

  const scheduleEvent = (
    binding: ProductionSchedulerBinding,
    timelineEvent: ProductionTimelineEvent,
  ) => {
    if (consumedIds.has(timelineEvent.id)) return;
    const presentation = applyOverlay(binding.project(timelineEvent));
    const occurrence = transportSecondsToNumber(timelineEvent.suppliedTransportOccurrence);
    const translatedAudioTime = transport.sceneToAudioTime(occurrence);
    if (!Number.isFinite(translatedAudioTime)) {
      throw new RangeError(`Invalid Web Audio time for authoritative event ${timelineEvent.id}.`);
    }
    // Web Audio treats past events as immediate, but its scheduling methods
    // reject negative timestamps. Preserve the existing immediate-late-event
    // behavior while keeping the timestamp valid on newly resumed contexts.
    const audioContextTime = Math.max(0, binding.audioCtx.currentTime, translatedAudioTime);
    const scheduled = Object.freeze({
      id: timelineEvent.id,
      timelineEvent,
      presentation,
      audioContextTime,
    });
    const pack = presentation.pack
      ? (PACK_BY_ID.get(presentation.pack) ?? binding.pack())
      : binding.pack();

    rememberConsumed(timelineEvent.id);
    dependencies.scheduleAudio(binding.audioCtx, ensureGenerationGate(binding), pack, scheduled);
    const visualTimer = scheduleVisual(binding, scheduled);
    scheduledRecords.set(timelineEvent.id, { audioContextTime, visualTimer });
  };

  const scheduleCompositionActivation = (
    binding: ProductionSchedulerBinding,
    nextSession: CompositionRevisionSession,
  ) => {
    if (activationTimer != null) dependencies.clearTimeout(activationTimer);
    const occurrence = transportSecondsToNumber(nextSession.activeFrom);
    const audioContextTime = transport.sceneToAudioTime(occurrence);
    const activate = () => {
      activationTimer = null;
      if (active !== binding) return;
      binding.setSession(nextSession);
      binding.onCompositionActivated?.(nextSession);
    };
    const delayMs = Math.max(0, (audioContextTime - binding.audioCtx.currentTime) * 1000);
    if (delayMs < 4) activate();
    else activationTimer = dependencies.setTimeout(activate, delayMs);
  };

  const tickNow = () => {
    const binding = active;
    if (!binding || transport.isPaused()) return;

    // Immediate visual events have no timer callback to remove their record.
    // Discard them once their audio occurrence has passed so long sessions do
    // not retain one scheduler record per note.
    for (const [id, record] of scheduledRecords) {
      if (record.visualTimer == null && record.audioContextTime <= binding.audioCtx.currentTime) {
        scheduledRecords.delete(id);
      }
    }
    const now = transportSecondsFromNumber(transport.t());
    const horizon = addTransportSeconds(now, transportSecondsFromNumber(HORIZON_S));

    if (
      compareTransportSeconds(lastScheduledPosition, now) < 0 &&
      transportSecondsToNumber(now) - transportSecondsToNumber(lastScheduledPosition) >
        HORIZON_S * 2
    ) {
      // Suspension or a missed scheduler run: resume at now, never catch up.
      invalidateFuture();
    }
    if (compareTransportSeconds(lastScheduledPosition, horizon) >= 0) return;

    const before = schedulingSession ?? binding.session();
    const advanced = advanceCompositionRevisionSession(before, lastScheduledPosition, horizon);
    schedulingSession = advanced.session;
    const compositionActivated = advanced.session.active !== before.active;
    if (compositionActivated) {
      const previousRevision = before.active.composition.revision;
      for (const event of advanced.input.events) {
        if (event.compositionRevision === previousRevision) scheduleEvent(binding, event);
      }
      scheduleCompositionActivation(binding, advanced.session);
      for (const event of advanced.input.events) {
        if (event.compositionRevision !== previousRevision) scheduleEvent(binding, event);
      }
    } else {
      for (const event of advanced.input.events) scheduleEvent(binding, event);
    }
    lastScheduledPosition = horizon;
  };

  return Object.freeze({
    setActive(binding: ProductionSchedulerBinding | null): void {
      invalidateFuture();
      active = binding;
      schedulingSession = binding?.session() ?? null;
      lastScheduledPosition = transportSecondsFromNumber(transport.t());
    },

    start(): void {
      if (timer != null) return;
      lastScheduledPosition = transportSecondsFromNumber(transport.t());
      unsubscribeLifecycle = transport.subscribeLifecycle(handleLifecycle);
      schedulingSession = active?.session() ?? null;
      timer = dependencies.setInterval(tickNow, TICK_MS);
    },

    stop(): void {
      if (timer != null) dependencies.clearInterval(timer);
      timer = null;
      unsubscribeLifecycle?.();
      unsubscribeLifecycle = null;
      invalidateFuture();
      active = null;
    },

    resync(position?: ExactTransportSeconds): void {
      invalidateFuture();
      lastScheduledPosition = position ?? transportSecondsFromNumber(transport.t());
    },

    invalidateFuture,
    tickNow,

    isOwningAudio(): boolean {
      return active != null;
    },
  });
}

export const engineScheduler = createProductionScheduler({
  transport: engineClock,
  scheduleAudio: (audioCtx, audioDest, pack, event) => {
    triggerPackVoice(
      audioCtx,
      audioDest,
      pack,
      event.presentation.slot,
      event.presentation.freq,
      event.audioContextTime,
    );
  },
  setInterval: globalThis.setInterval.bind(globalThis),
  clearInterval: globalThis.clearInterval.bind(globalThis),
  setTimeout: globalThis.setTimeout.bind(globalThis),
  clearTimeout: globalThis.clearTimeout.bind(globalThis),
});

export type { TriggerEvent };
