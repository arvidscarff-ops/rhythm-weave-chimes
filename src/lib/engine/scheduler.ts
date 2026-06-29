/**
 * Phase engine — look-ahead audio scheduler.
 *
 * Replaces the imperative `dispatchTriggers` path for scenes that have
 * been migrated to the Phase-Zero contract. Operates on a 25 ms tick;
 * each tick queries `activeScene.eventsIn(t0, t1)` over a 120 ms horizon
 * and schedules voices at precise `AudioContext.currentTime` targets via
 * `triggerPackVoice`. The render loop never touches audio.
 *
 * The scheduler is dormant until `start()` is called and an active
 * scene with `eventsIn` is set. Legacy scenes (no `eventsIn`) cause it
 * to no-op for that frame — the old imperative path keeps running for
 * them. This is the feature flag: per-scene opt-in via the contract.
 */

import { engineClock } from "./clock";
import { triggerPackVoice, BUILTIN_RUNTIME_PACKS, type RuntimePack } from "@/lib/sound/runtimePacks";
import type { PackId } from "@/lib/sound/packs";
import { spawnInkBleed } from "@/lib/visuals/inkBleed";
import type { Scene, SceneGlobals, TriggerEvent } from "./sceneTypes";

/** How often the scheduler wakes (ms). */
const TICK_MS = 25;
/** How far ahead each tick looks (s). Must exceed TICK_MS + jitter. */
const HORIZON_S = 0.12;
/**
 * Unison-guard window. Two events whose audio times fall in
 * `[UNISON_EXACT_S, UNISON_GUARD_S)` apart are nudged forward to keep
 * near-misses rhythmically independent. Events closer than
 * `UNISON_EXACT_S` are treated as the SAME instant (an intentional
 * coincidence / chord — e.g. the play-time chord, or a future
 * polyrhythm realignment) and pass through untouched.
 */
const UNISON_GUARD_S = 0.05;
const UNISON_NUDGE_S = 0.012;
const UNISON_EXACT_S = 0.001;

/** Builtin-pack lookup so events with `ev.pack` can route per-layer. */
const PACK_BY_ID = new Map<PackId, RuntimePack>(
  BUILTIN_RUNTIME_PACKS.flatMap((p) => (p.kind === "builtin" ? [[p.id, p] as const] : [])),
);

type ActiveBinding = {
  scene: Scene<unknown>;
  /** Late-bound state getter — returns `null` while the scene is lazy-initing. */
  state: () => unknown | null;
  globals: () => SceneGlobals;
  audioCtx: AudioContext;
  audioDest: AudioNode;
  pack: () => RuntimePack;
};

let timer: ReturnType<typeof setInterval> | null = null;
let active: ActiveBinding | null = null;
/** End of the last horizon we scheduled, in scene-time. */
let lastScheduledT = 0;

function schedulerTick(): void {
  if (!active) return;
  if (engineClock.isPaused()) return;

  const { scene, state, globals, audioCtx, audioDest, pack } = active;
  if (!scene.eventsIn) return; // scene not migrated — legacy path owns it
  const st = state();
  if (st == null) return; // not yet initialized

  const now = engineClock.t();
  const horizon = now + HORIZON_S;

  // Only clamp when we're genuinely behind (e.g. after a long pause). On
  // the normal first tick after `resync()`, lastScheduledT is just a hair
  // behind `now` and we MUST preserve it so the t=0 Big Bang window gets
  // queried — otherwise every scene loses its first-click chord.
  if (now - lastScheduledT > HORIZON_S * 2) lastScheduledT = now;
  if (lastScheduledT >= horizon) return;

  const g = globals();

  const events = scene.eventsIn(st, lastScheduledT, horizon, g);
  const whenHorizon = engineClock.sceneToAudioTime(horizon);
  // Compute each event's audio time, then apply the unison guard.
  const scheduled: { ev: TriggerEvent; when: number }[] = events.map((ev) => ({
    ev,
    when: whenHorizon,
  }));
  if (scheduled.length > 1) {
    scheduled.sort((a, b) => a.when - b.when || a.ev.slot - b.ev.slot);
    for (let i = 1; i < scheduled.length; i++) {
      const prev = scheduled[i - 1].when;
      const delta = scheduled[i].when - prev;
      // Exact coincidence — emergent chord (Big Bang on play, or a
      // future polyrhythm realignment). Leave it alone.
      if (delta < UNISON_EXACT_S) continue;
      // Near miss — nudge forward so the two notes are heard as
      // distinct rhythmic events, not a smeared unison.
      if (delta < UNISON_GUARD_S) {
        scheduled[i].when = prev + UNISON_GUARD_S + UNISON_NUDGE_S;
      }
    }
  }
  for (const { ev, when } of scheduled) {
    const packForEvent = ev.pack ? (PACK_BY_ID.get(ev.pack) ?? pack()) : pack();
    triggerPackVoice(audioCtx, audioDest, packForEvent, ev.slot, ev.freq, when);
    // Visual lands with the audio: delay ink-bleed by the nudge so
    // the bloom stays glued to the sound, not the original event time.
    const delayMs = Math.max(0, (when - audioCtx.currentTime) * 1000);
    if (delayMs < 4) {
      spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity });
    } else {
      setTimeout(() => spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity }), delayMs);
    }
  }
  lastScheduledT = horizon;
}

export const engineScheduler = {
  /** Bind the scheduler to the active scene + audio destination. */
  setActive(binding: ActiveBinding | null): void {
    active = binding;
    lastScheduledT = engineClock.t();
  },

  /** Begin ticking. Safe to call repeatedly. */
  start(): void {
    if (timer != null) return;
    lastScheduledT = engineClock.t();
    timer = setInterval(schedulerTick, TICK_MS);
  },

  /** Stop ticking and clear the active binding. */
  stop(): void {
    if (timer != null) {
      clearInterval(timer);
      timer = null;
    }
    active = null;
  },

  /**
   * Reset the scheduling cursor — call on Phase-Zero reset, scene
   * switch, or transport play.
   */
  resync(): void {
    lastScheduledT = engineClock.t();
  },

  /** Whether the scheduler owns audio for the currently bound scene. */
  isOwningAudio(): boolean {
    return !!(active && active.scene.eventsIn);
  },
};

// Re-export the legacy bus type so call sites can import from one place.
export type { TriggerEvent };