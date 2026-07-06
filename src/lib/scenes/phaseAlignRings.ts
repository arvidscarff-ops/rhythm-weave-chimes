/**
 * Scene — Phase-Align Rings (canonical proof of the macro-cycle rule).
 *
 * Concentric-ring target. One dot per note orbits its ring clockwise;
 * angle is a pure function of `phaseAlign.progress(t, i, B, D)` mapped
 * onto `[0, 2π)` starting at 12 o'clock (angle = -π/2 at progress = 0).
 * A trigger fires every time the dot passes 12 o'clock — the shared
 * anchor — so every voice fires in unison at `t = k · D` (Big Bang) and
 * spreads into (B+i) staggered laps in between.
 *
 * This scene is the reference implementation: engine authors adding
 * new scenes should mirror its `sample`/`eventsIn` shape.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress, lapsFor } from "@/lib/engine/phaseAlign";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
// A pentatonic-ish palette so the Big Bang chord is consonant.
const SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36, 38, 40, 43, 45, 48, 50, 52, 55];
const HUES = [0.55, 0.62, 0.68, 0.76, 0.85, 0.94, 0.03, 0.10, 0.16, 0.22, 0.30, 0.38, 0.45, 0.52, 0.58, 0.66, 0.74, 0.82, 0.90, 0.98, 0.06, 0.14, 0.20, 0.26];

export type PhaseAlignRingsState = {
  /** Cached N for hot-detect reseed. */
  n: number;
};

export const phaseAlignRingsScene: Scene<PhaseAlignRingsState> = {
  id: "phaseAlignRings",

  init(g) {
    return { n: g.noteCount };
  },

  sample(state, _t, g) {
    if (state.n !== g.noteCount) state.n = g.noteCount;
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const N = g.noteCount;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const rStep = maxR / Math.max(1, N);

    const scratch: number[] = [];
    for (let i = 0; i < N; i++) {
      scratch.length = 0;
      crossings(i, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const r = rStep * (i + 1);
      // Trigger point sits at 12 o'clock (angle = -π/2).
      const x = cx;
      const y = cy - r;
      const slot = (i % 6) as VoiceSlotIndex;
      const freq = freqOf(SEMIS[i % SEMIS.length] + g.pitchSemis);
      const hue = HUES[i % HUES.length];
      // Louder / brighter for faster (higher i) voices — they carry the
      // polyrhythmic top of the mix.
      const velocity = 0.55 + (i / Math.max(1, N - 1)) * 0.4;
      for (let k = 0; k < scratch.length; k++) {
        events.push({ slot, freq, x, y, hue, velocity });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const N = g.noteCount;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const rStep = maxR / Math.max(1, N);
    const t = g.globalTime;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Ring tracks — hairline circles.
    ctx.lineWidth = 0.5;
    for (let i = 0; i < N; i++) {
      const r = rStep * (i + 1);
      const hueDeg = ((HUES[i % HUES.length]) * 360) % 360;
      ctx.strokeStyle = `oklch(0.78 0.08 ${hueDeg} / 0.16)`;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 12 o'clock trigger tick — same anchor for every ring.
    ctx.strokeStyle = "oklch(0.9 0.05 220 / 0.18)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR - 6);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    // Dots — one per note, orbiting clockwise from 12 o'clock.
    for (let i = 0; i < N; i++) {
      const r = rStep * (i + 1);
      const p = progress(t, i, B, D);
      const angle = -Math.PI / 2 + p * Math.PI * 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const hueDeg = (HUES[i % HUES.length] * 360) % 360;
      // Fresh-trigger flash: how close is progress to 0 or 1?
      const nearWrap = Math.min(p, 1 - p);
      const flash = Math.max(0, 1 - nearWrap * 16); // narrow spike near p=0
      const radius = 4 + flash * 8;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center label showing cycle position as a subtle rotating hand.
    const cycleFrac = ((t % D) + D) % D / D;
    const hAng = -Math.PI / 2 + cycleFrac * Math.PI * 2;
    ctx.strokeStyle = "oklch(0.9 0.08 220 / 0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(hAng) * 14, cy + Math.sin(hAng) * 14);
    ctx.stroke();

    // Ripple on macro-cycle boundary.
    const secsSinceBang = t - Math.floor(t / D) * D;
    if (secsSinceBang < 0.35) {
      const a = 1 - secsSinceBang / 0.35;
      const rr = maxR * (0.2 + (1 - a) * 1.2);
      ctx.strokeStyle = `oklch(0.95 0.15 200 / ${(a * 0.4).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Suppress unused-var lint; the state is intentionally minimal.
    void state;

    ctx.restore();
  },
};