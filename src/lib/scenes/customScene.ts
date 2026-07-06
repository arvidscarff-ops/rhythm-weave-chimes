/**
 * Scene — Custom (blueprint-driven).
 *
 * Runtime adapter that reads the active `CustomSceneBlueprint` from
 * `activeBlueprint` and renders it via the shared `pathTransformer`.
 * Cadence flows through `phaseAlign` so every custom scene automatically
 * respects the macro-cycle Big Bang rule.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { progress } from "@/lib/engine/phaseAlign";
import {
  crossings as pathCrossings,
  positionOn,
  samplePath,
  trackRotation,
  trackScale,
} from "@/lib/engine/pathTransformer";
import { getActiveBlueprint } from "@/lib/scenes/activeBlueprint";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36, 38, 40, 43, 45, 48, 50, 52, 55];
const HUES = [0.55, 0.62, 0.68, 0.76, 0.85, 0.94, 0.03, 0.10, 0.16, 0.22, 0.30, 0.38, 0.45, 0.52, 0.58, 0.66, 0.74, 0.82, 0.90, 0.98, 0.06, 0.14, 0.20, 0.26];

export type CustomSceneState = { seed: number };

function resolveTrackCount(g: SceneGlobals): number {
  const bp = getActiveBlueprint();
  const override = bp.layout.trackCount;
  if (typeof override === "number" && override > 0) {
    return Math.max(1, Math.min(48, Math.floor(override)));
  }
  return Math.max(1, Math.min(48, g.noteCount));
}

/** Map unit-space (-1..1) to pixels centered on the canvas. */
function toPx(
  x: number,
  y: number,
  scale: number,
  rot: number,
  W: number,
  H: number,
): { x: number; y: number } {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  const half = Math.min(W, H) / 2;
  return { x: W / 2 + rx * scale * half, y: H / 2 + ry * scale * half };
}

export const customScene: Scene<CustomSceneState> = {
  id: "custom",

  init() {
    return { seed: 0 };
  },

  sample(state) {
    void state; // stateless; blueprint read live
  },

  eventsIn(_state, t0, t1, g) {
    if (t1 <= t0) return [];
    const bp = getActiveBlueprint();
    const N = resolveTrackCount(g);
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const slot = bp.voice.slot as VoiceSlotIndex;
    const events: TriggerEvent[] = [];
    for (let i = 0; i < N; i++) {
      const times = pathCrossings(bp, i, B, D, t0, t1);
      if (times.length === 0) continue;
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const hue = HUES[i % HUES.length];
      const freq = freqOf(SEMIS[i % SEMIS.length] + g.pitchSemis);
      const velocity = 0.55 + (i / Math.max(1, N - 1)) * 0.4;
      for (const t of times) {
        const p = progress(t, i, B, D);
        const pos = positionOn(bp.path, p);
        const px = toPx(pos.x, pos.y, scale, rot, g.W, g.H);
        events.push({ slot, freq, x: px.x, y: px.y, hue, velocity });
      }
    }
    return events;
  },

  draw(_state, ctx, g) {
    const bp = getActiveBlueprint();
    const N = resolveTrackCount(g);
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const t = g.globalTime;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Wireframe tracks.
    const polyline = samplePath(bp.path, 128);
    ctx.lineWidth = 0.6;
    for (let i = 0; i < N; i++) {
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const hueDeg = (HUES[i % HUES.length] * 360) % 360;
      ctx.strokeStyle = `oklch(0.78 0.09 ${hueDeg} / 0.14)`;
      ctx.beginPath();
      for (let k = 0; k < polyline.length; k++) {
        const p = polyline[k];
        const px = toPx(p.x, p.y, scale, rot, g.W, g.H);
        if (k === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      }
      ctx.stroke();
    }

    // Axis-intersect trigger line, if enabled.
    if (bp.trigger.mode === "axisIntersect") {
      const half = Math.min(g.W, g.H) / 2;
      const pos = bp.trigger.position ?? 0;
      ctx.strokeStyle = "oklch(0.9 0.08 220 / 0.25)";
      ctx.lineWidth = 0.75;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      if (bp.trigger.axis === "y") {
        const y = g.H / 2 + pos * half;
        ctx.moveTo(0, y);
        ctx.lineTo(g.W, y);
      } else {
        const x = g.W / 2 + pos * half;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, g.H);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Orbiting dots.
    for (let i = 0; i < N; i++) {
      const p = progress(t, i, B, D);
      const pos = positionOn(bp.path, p);
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const px = toPx(pos.x, pos.y, scale, rot, g.W, g.H);
      const hueDeg = (HUES[i % HUES.length] * 360) % 360;
      const nearWrap = Math.min(p, 1 - p);
      const flash = Math.max(0, 1 - nearWrap * 16);
      const radius = 4 + flash * 8;
      const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, radius * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px.x, px.y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Big-Bang ripple on macro-cycle boundary.
    const secsSinceBang = t - Math.floor(t / D) * D;
    if (secsSinceBang < 0.35) {
      const a = 1 - secsSinceBang / 0.35;
      const maxR = Math.min(g.W, g.H) * 0.42;
      const rr = maxR * (0.2 + (1 - a) * 1.2);
      ctx.strokeStyle = `oklch(0.95 0.15 200 / ${(a * 0.4).toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(g.W / 2, g.H / 2, rr, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  },
};