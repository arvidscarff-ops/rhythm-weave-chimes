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
import { triggerPackVoice, type RuntimePack } from "@/lib/sound/runtimePacks";
import { spawnInkBleed } from "@/lib/visuals/inkBleed";
import type { Scene, SceneGlobals, TriggerEvent } from "./sceneTypes";

/** How often the scheduler wakes (ms). */
const TICK_MS = 25;
/** How far ahead each tick looks (s). Must exceed TICK_MS + jitter. */
const HORIZON_S = 0.12;

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

  // If the window includes t≈0 (first tick after a Phase-Zero reset),
  // schedule the chord at the current audio time so it lands on the user's
  // click instead of one horizon later.
  const isBigBangTick = lastScheduledT <= 0;
  const events = scene.eventsIn(st, lastScheduledT, horizon, globals());
  const whenBigBang = audioCtx.currentTime;
  const whenHorizon = engineClock.sceneToAudioTime(horizon);
  for (const ev of events) {
    const when = isBigBangTick ? whenBigBang : whenHorizon;
    triggerPackVoice(audioCtx, audioDest, pack(), ev.slot, ev.freq, when);
    spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity });
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