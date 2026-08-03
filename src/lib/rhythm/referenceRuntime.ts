import {
  eventsBetween,
  R3_REFERENCE_COMPOSITION,
  ReferenceTransport,
  secondsToTicks,
  snapshotAt,
  ticksToSeconds,
  type MusicalTick,
  type ReferenceComposition,
  type ReferenceRhythmEvent,
  type ReferenceRhythmSnapshot,
} from "./referenceAuthority";

const SCHEDULER_INTERVAL_MS = 25;
const LOOKAHEAD_TICKS = secondsToTicks(0.12);
const LATE_WINDOW_TICKS = LOOKAHEAD_TICKS * 2n;
const VISUAL_EVENT_AGE_TICKS = secondsToTicks(1.35);
const MIN_AUDIO_LEAD_SECONDS = 0.006;

export type ReferenceRuntimeDiagnostics = {
  scheduledEventCount: number;
  duplicateEventCount: number;
  lateWindowCount: number;
  scheduledThroughTick: MusicalTick;
  lastScheduledEventId: string | null;
  lastPhaseZeroTick: MusicalTick;
};

/**
 * Platform adapter for the R3 proof.
 *
 * The transport and event model remain authoritative. This scheduler only
 * projects their future events onto Web Audio; the renderer independently
 * reconstructs current geometry from the same transport and event IDs.
 */
export class ReferenceRuntime {
  readonly transport = new ReferenceTransport();

  private readonly composition: ReferenceComposition;
  private readonly masterLevel: number;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private schedulerTimer: ReturnType<typeof setInterval> | null = null;
  private scheduledThroughTick = 0n;
  private scheduledIds = new Map<string, MusicalTick>();
  private activeSources = new Map<string, OscillatorNode>();
  private scheduledEventCount = 0;
  private duplicateEventCount = 0;
  private lateWindowCount = 0;
  private lastScheduledEventId: string | null = null;
  private lastPhaseZeroTick = 0n;

  constructor(composition: ReferenceComposition, masterLevel = 0.42) {
    this.composition = composition;
    this.masterLevel = masterLevel;
  }

  snapshot(): ReferenceRhythmSnapshot {
    return snapshotAt(this.composition, this.transport.positionTick());
  }

  recentEvents(): ReferenceRhythmEvent[] {
    const now = this.transport.positionTick();
    const start = now > VISUAL_EVENT_AGE_TICKS ? now - VISUAL_EVENT_AGE_TICKS : 0n;
    return eventsBetween(this.composition, start, now + 1n);
  }

  diagnostics(): ReferenceRuntimeDiagnostics {
    return {
      scheduledEventCount: this.scheduledEventCount,
      duplicateEventCount: this.duplicateEventCount,
      lateWindowCount: this.lateWindowCount,
      scheduledThroughTick: this.scheduledThroughTick,
      lastScheduledEventId: this.lastScheduledEventId,
      lastPhaseZeroTick: this.lastPhaseZeroTick,
    };
  }

  async play(): Promise<void> {
    const context = this.ensureAudio();
    if (context.state === "suspended") await context.resume();
    if (this.transport.isPlaying()) return;

    this.scheduledThroughTick = this.transport.positionTick();
    this.transport.play();
    this.startScheduler();
    this.schedulerTick();
  }

  pause(): void {
    this.transport.pause();
    this.stopScheduler();
    this.cancelFutureAudio();
  }

  resetPhaseZero(): void {
    const wasPlaying = this.transport.isPlaying();
    this.cancelAllAudio();
    this.scheduledIds.clear();
    this.transport.resetPhaseZero();
    this.scheduledThroughTick = 0n;
    this.lastPhaseZeroTick = 0n;
    if (wasPlaying) this.schedulerTick();
  }

  releaseConsumer(): void {
    this.pause();
  }

  private ensureAudio(): AudioContext {
    if (this.audioContext && this.masterGain) return this.audioContext;
    const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
    const context = new AudioCtor();
    const master = context.createGain();
    master.gain.value = this.masterLevel;
    master.connect(context.destination);
    this.audioContext = context;
    this.masterGain = master;
    return context;
  }

  private startScheduler(): void {
    if (this.schedulerTimer) return;
    this.schedulerTimer = setInterval(() => this.schedulerTick(), SCHEDULER_INTERVAL_MS);
  }

  private stopScheduler(): void {
    if (!this.schedulerTimer) return;
    clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
  }

  private schedulerTick(): void {
    const context = this.audioContext;
    const master = this.masterGain;
    if (!context || !master || !this.transport.isPlaying()) return;

    const nowTick = this.transport.positionTick();
    if (this.scheduledThroughTick < nowTick - LATE_WINDOW_TICKS) {
      this.lateWindowCount += 1;
      this.scheduledThroughTick = nowTick;
    }

    const horizonTick = nowTick + LOOKAHEAD_TICKS;
    if (this.scheduledThroughTick >= horizonTick) return;

    const events = eventsBetween(this.composition, this.scheduledThroughTick, horizonTick);
    for (const event of events) {
      if (this.scheduledIds.has(event.id)) {
        this.duplicateEventCount += 1;
        continue;
      }

      const secondsFromNow = ticksToSeconds(event.tick - nowTick);
      const when = context.currentTime + Math.max(MIN_AUDIO_LEAD_SECONDS, secondsFromNow);
      this.scheduleTone(event, when, context, master);
      this.scheduledIds.set(event.id, event.tick);
      this.scheduledEventCount += 1;
      this.lastScheduledEventId = event.id;
      if (event.isPhaseZero) this.lastPhaseZeroTick = event.tick;
    }

    this.scheduledThroughTick = horizonTick;
    this.pruneEventIdentities(nowTick);
  }

  private scheduleTone(
    event: ReferenceRhythmEvent,
    when: number,
    context: AudioContext,
    destination: AudioNode,
  ): void {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = event.voiceId === "low" ? "sine" : "triangle";
    oscillator.frequency.setValueAtTime(event.frequencyHz, when);
    envelope.gain.setValueAtTime(0.0001, when);
    envelope.gain.exponentialRampToValueAtTime(event.isPhaseZero ? 0.075 : 0.045, when + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, when + (event.isPhaseZero ? 1.4 : 0.72));
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(when);
    oscillator.stop(when + (event.isPhaseZero ? 1.45 : 0.76));
    this.activeSources.set(event.id, oscillator);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
      this.activeSources.delete(event.id);
    };
  }

  private cancelFutureAudio(): void {
    const nowTick = this.transport.positionTick();
    for (const [eventId, source] of this.activeSources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      this.activeSources.delete(eventId);
      const tick = this.scheduledIds.get(eventId);
      if (tick != null && tick >= nowTick) this.scheduledIds.delete(eventId);
    }
    this.scheduledThroughTick = nowTick;
  }

  private cancelAllAudio(): void {
    for (const source of this.activeSources.values()) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
    this.activeSources.clear();
  }

  private pruneEventIdentities(nowTick: MusicalTick): void {
    const oldestKeptTick =
      nowTick > this.composition.macroCycleTicks ? nowTick - this.composition.macroCycleTicks : 0n;
    for (const [eventId, tick] of this.scheduledIds) {
      if (tick < oldestKeptTick && !this.activeSources.has(eventId)) {
        this.scheduledIds.delete(eventId);
      }
    }
  }
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

export const r3ReferenceRuntime = new ReferenceRuntime(R3_REFERENCE_COMPOSITION);
