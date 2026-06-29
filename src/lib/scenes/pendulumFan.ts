/**
 * Scene B — Harmonic Pendulum Fan.
 *
 * Single top-fixed origin. N strings radiate downward at fanned angles.
 * A node slides along each string with distance modulated by a sine wave:
 *
 *   d_i(t) = base_i + A_i · sin(ω_i · t + φ_i)
 *
 * Fixed target rings sit at each string's `targetDist`. A trigger fires
 * the frame `d_i` crosses `targetDist` (either direction).
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";

const RATIOS = [1.0, 1.06, 1.13, 1.21, 1.3, 1.4, 1.51, 1.63, 1.76, 1.9, 2.05, 2.21];
/** Map dock density (2..12) → strand count (5..14). */
function strandCount(density: number) {
  return Math.max(5, Math.min(14, Math.round(5 + (density - 2) * 0.9)));
}
const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);

type Strand = {
  /** Fan angle from straight-down (radians). Negative = left. */
  angle: number;
  /** Modulation period multiplier (Galileo ratio). */
  ratio: number;
  /** Phase 0..1. */
  phase: number;
  /** Last d value, for crossing detection. */
  prevD: number;
  /** Refractory clock (s). */
  cool: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  flash: number;
};

export type PendulumFanState = {
  strands: Strand[];
  clock: number;
};

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 5.4;
}

export const pendulumFanScene: Scene<PendulumFanState> = {
  id: "pendulumFan",

  init(_g) {
    const N = strandCount(_g.density ?? 5);
    const strands: Strand[] = [];
    for (let i = 0; i < N; i++) {
      const angle = ((i - (N - 1) / 2) / (N - 1)) * (Math.PI * 0.55);
      strands.push({
        angle,
        ratio: RATIOS[i % RATIOS.length],
        phase: 0,
        prevD: 0.5,
        cool: 0,
        slot: (i % 6) as VoiceSlotIndex,
        pitchSemis: 12 - i * 2,
        hue: 0.55 + (i / N) * 0.4,
        flash: 0,
      });
    }
    return { strands, clock: 0 };
  },

  update(state, dt, g) {
    const want = strandCount(g.density);
    if (want !== state.strands.length) {
      state.strands = pendulumFanScene.init({ ...g, density: g.density }).strands;
    }
    state.clock += dt;
    const events: TriggerEvent[] = [];
    const period = basePeriod(g.bpm);
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    // Target ring sits at 78% along each string.
    const targetDistNorm = 0.78;

    for (const s of state.strands) {
      s.cool = Math.max(0, s.cool - dt);
      s.flash = Math.max(0, s.flash - dt * 2.6);
      const inc = (dt * g.speed) / (period * s.ratio);
      s.phase = (s.phase + inc) % 1;
      // Normalized distance 0..1 along string: base 0.5, amplitude 0.4.
      const d = 0.5 + 0.4 * Math.sin(s.phase * Math.PI * 2);
      const crossed =
        (s.prevD < targetDistNorm && d >= targetDistNorm) ||
        (s.prevD > targetDistNorm && d <= targetDistNorm);
      if (crossed && s.cool <= 0) {
        s.cool = 0.18;
        s.flash = 1;
        const tx = ax + Math.sin(s.angle) * stringLen * targetDistNorm;
        const ty = ay + Math.cos(s.angle) * stringLen * targetDistNorm;
        events.push({
          slot: s.slot,
          freq: freqOf(s.pitchSemis + g.pitchSemis),
          x: tx,
          y: ty,
          hue: s.hue,
          velocity: 0.75,
        });
      }
      s.prevD = d;
    }
    return events;
  },

  draw(state, ctx, g) {
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    const targetDistNorm = 0.78;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Strings (additive 0.5px hairlines + a soft glow pass).
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
      // Soft glow under the line.
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = `oklch(0.7 0.16 ${hueDeg} / 0.08)`;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
    }

    // Target rings at targetDistNorm of each string.
    for (const s of state.strands) {
      const tx = ax + Math.sin(s.angle) * stringLen * targetDistNorm;
      const ty = ay + Math.cos(s.angle) * stringLen * targetDistNorm;
      const hueDeg = (s.hue * 360) % 360;
      const flashA = 0.18 + s.flash * 0.6;
      ctx.strokeStyle = `oklch(0.92 0.16 ${hueDeg} / ${flashA.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(tx, ty, 7 + s.flash * 4, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sliding nodes.
    for (const s of state.strands) {
      const d = 0.5 + 0.4 * Math.sin(s.phase * Math.PI * 2);
      const nx = ax + Math.sin(s.angle) * stringLen * d;
      const ny = ay + Math.cos(s.angle) * stringLen * d;
      const hueDeg = (s.hue * 360) % 360;
      const r = 5 + s.flash * 5;
      const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, r * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / 0.9)`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(nx, ny, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Anchor dot.
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