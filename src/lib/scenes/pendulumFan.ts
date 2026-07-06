/**
 * Scene B — Harmonic Pendulum Fan (Phase-Alignment retrofit).
 *
 * A top-fixed origin. N strings radiate downward at fanned angles. A
 * node slides along each string; its distance from the anchor is
 *
 *   d_i(t) = 0.5 + (TARGET - 0.5) * cos(2π · progress(t, i, B, D))
 *
 * so `d_i = TARGET` at every wrap, and every node hits its target ring
 * in unison at `t = k · D`. Strand ordering: leftmost = fastest (i = N-1).
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

function strandCount(density: number) {
  return Math.max(5, Math.min(14, Math.round(5 + (density - 2) * 0.9)));
}

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);

/** Where the trigger ring sits along each string, in [0, 1]. */
const TARGET_DIST_NORM = 0.78;

type Strand = {
  /** Fan angle from straight-down (radians). Negative = left. */
  angle: number;
  /** Phase-Alignment voice index (0 = slowest, N-1 = fastest). */
  pi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  /** Scene-time of most recent trigger — flash decay only. */
  lastFireT: number;
};

export type PendulumFanState = {
  strands: Strand[];
  density: number;
};

function strandD(pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  // Node visits d = TARGET at p = 0 and again at p = 1 (same wrap).
  return 0.5 + (TARGET_DIST_NORM - 0.5) * Math.cos(p * Math.PI * 2);
}

function makeStrands(density: number): Strand[] {
  const N = strandCount(density);
  const out: Strand[] = [];
  for (let i = 0; i < N; i++) {
    // Leftmost strand → highest voice index (fastest).
    const angle = ((i - (N - 1) / 2) / (N - 1)) * (Math.PI * 0.55);
    const pi = N - 1 - i;
    out.push({
      angle,
      pi,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: 12 - i * 2,
      hue: 0.55 + (i / N) * 0.4,
      lastFireT: -Infinity,
    });
  }
  return out;
}

export const pendulumFanScene: Scene<PendulumFanState> = {
  id: "pendulumFan",

  init(g) {
    return { strands: makeStrands(g.density ?? 5), density: g.density ?? 5 };
  },

  sample(state, _t, g) {
    const want = strandCount(g.density);
    if (want !== state.strands.length) {
      state.strands = makeStrands(g.density);
      state.density = g.density;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    const N = state.strands.length;
    const scratch: number[] = [];
    for (const s of state.strands) {
      scratch.length = 0;
      crossings(s.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const tx = ax + Math.sin(s.angle) * stringLen * TARGET_DIST_NORM;
      const ty = ay + Math.cos(s.angle) * stringLen * TARGET_DIST_NORM;
      const speedNorm = N > 1 ? s.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        s.lastFireT = tEv;
        events.push({
          slot: s.slot,
          freq: freqOf(s.pitchSemis + g.pitchSemis),
          x: tx,
          y: ty,
          hue: s.hue,
          velocity: 0.55 + speedNorm * 0.4,
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Strings.
    for (const s of state.strands) {
      const tipX = ax + Math.sin(s.angle) * stringLen;
      const tipY = ay + Math.cos(s.angle) * stringLen;
      const hueDeg = (s.hue * 360) % 360;
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = `oklch(0.82 0.1 ${hueDeg} / 0.55)`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = `oklch(0.7 0.16 ${hueDeg} / 0.08)`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    // Target rings.
    for (const s of state.strands) {
      const tx = ax + Math.sin(s.angle) * stringLen * TARGET_DIST_NORM;
      const ty = ay + Math.cos(s.angle) * stringLen * TARGET_DIST_NORM;
      const hueDeg = (s.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - s.lastFireT) * 2.6));
      const flashA = 0.18 + flash * 0.6;
      ctx.strokeStyle = `oklch(0.92 0.16 ${hueDeg} / ${flashA.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(tx, ty, 7 + flash * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sliding nodes.
    for (const s of state.strands) {
      const d = strandD(s.pi, t, B, D);
      const nx = ax + Math.sin(s.angle) * stringLen * d;
      const ny = ay + Math.cos(s.angle) * stringLen * d;
      const hueDeg = (s.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - s.lastFireT) * 2.6));
      const r = 5 + flash * 5;
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / 0.9)`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Anchor.
    const ag = ctx.createRadialGradient(ax, ay, 0, ax, ay, 14);
    ag.addColorStop(0, "oklch(0.95 0.06 240 / 0.8)");
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(ax, ay, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};