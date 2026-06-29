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
/**
 * Unison-guard window: if two scheduled events would fire within this
 * many seconds of each other, the second is nudged forward by
 * `UNISON_NUDGE_S` to keep them rhythmically independent. The t=0
 * Big Bang chord is intentionally exempt.
 */
const UNISON_GUARD_S = 0.05;
const UNISON_NUDGE_S = 0.012;

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
/** Whether the Big Bang chord has been dispatched for the current binding. */
let bigBangFired = false;

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

  // One-shot Big Bang: every note strikes from its resting position the
  // first time scene time crosses 0. Scheduled at audio currentTime so
  // it lands on the user's click, never queued behind the look-ahead
  // horizon. After this fires, eventsIn owns everything from t > 0.
  if (!bigBangFired && now >= 0) {
    const chord = scene.bigBang
      ? scene.bigBang(st, g)
      : (scene.eventsIn(st, -1e-6, 1e-6, g) ?? []);
    const when = audioCtx.currentTime;
    for (const ev of chord) {
      triggerPackVoice(audioCtx, audioDest, pack(), ev.slot, ev.freq, when);
      spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity });
    }
    bigBangFired = true;
    // Skip past the t=0 anchor so the analytic path starts clean.
    lastScheduledT = Math.max(lastScheduledT, 1e-4);
    if (lastScheduledT >= horizon) return;
  }

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
      if (scheduled[i].when - prev < UNISON_GUARD_S) {
        // Deterministic ± nudge by slot parity; forward only (never
        // back into the past) so dispatch order is preserved.
        const sign = scheduled[i].ev.slot % 2 === 0 ? 1 : 1; // forward
        scheduled[i].when = prev + UNISON_GUARD_S + UNISON_NUDGE_S * sign;
      }
    }
  }
  for (const { ev, when } of scheduled) {
    triggerPackVoice(audioCtx, audioDest, pack(), ev.slot, ev.freq, when);
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
    bigBangFired = false;
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
    bigBangFired = false;
  },

  /** Whether the scheduler owns audio for the currently bound scene. */
  isOwningAudio(): boolean {
    return !!(active && active.scene.eventsIn);
  },
};

// Re-export the legacy bus type so call sites can import from one place.
export type { TriggerEvent };