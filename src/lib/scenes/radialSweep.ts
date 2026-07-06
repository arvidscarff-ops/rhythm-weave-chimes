/**
 * Scene D — Radial Sweep (Phase-Alignment retrofit).
 *
 * N radial arms rotate around center. Arm `i` completes `B + i` laps
 * per macro-cycle. A trigger fires when an arm passes 12 o'clock
 * (angle = -π/2), the shared unison anchor.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];

type Arm = {
  pi: number;
  rNorm: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  lastFireT: number;
};

export type RadialSweepState = {
  arms: Arm[];
  density: number;
  triggerCount: number;
  lastNebulaT: number;
};

function armCount(density: number) {
  return Math.max(6, Math.min(16, Math.round(6 + (density - 2) * 1)));
}

function buildArms(N: number): Arm[] {
  const out: Arm[] = new Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = {
      pi: N - 1 - i, // smaller radius → faster (higher pi)
      rNorm: 0.45 + (i % 3) * 0.18,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: 0.5 + (i / N) * 0.45,
      lastFireT: -Infinity,
    };
  }
  return out;
}

export const radialSweepScene: Scene<RadialSweepState> = {
  id: "radialSweep",

  init(g) {
    return {
      arms: buildArms(armCount(g.density ?? 5)),
      density: g.density ?? 5,
      triggerCount: 0,
      lastNebulaT: -Infinity,
    };
  },

  sample(state, _t, g) {
    const want = armCount(g.density);
    if (want !== state.arms.length) {
      state.arms = buildArms(want);
      state.density = g.density;
      state.triggerCount = 0;
      state.lastNebulaT = -Infinity;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const want = armCount(g.density);
    if (want !== state.arms.length) {
      state.arms = buildArms(want);
      state.density = g.density;
      state.triggerCount = 0;
      state.lastNebulaT = -Infinity;
    }
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const N = state.arms.length;
    const scratch: number[] = [];
    // Gather all events sorted by time so nebula counter increments in order.
    type Hit = { tEv: number; arm: Arm };
    const hits: Hit[] = [];
    for (const arm of state.arms) {
      scratch.length = 0;
      crossings(arm.pi, B, D, t0, t1, scratch);
      for (const tEv of scratch) hits.push({ tEv, arm });
    }
    hits.sort((a, b) => a.tEv - b.tEv);
    for (const { tEv, arm } of hits) {
      arm.lastFireT = tEv;
      state.triggerCount++;
      if (state.triggerCount % 4 === 0) state.lastNebulaT = tEv;
      const r = arm.rNorm * maxR;
      // Wraps land at angle = -π/2 (12 o'clock).
      const x = cx;
      const y = cy - r;
      const speedNorm = N > 1 ? arm.pi / (N - 1) : 1;
      events.push({
        slot: arm.slot,
        freq: freqOf(arm.pitchSemis + g.pitchSemis),
        x,
        y,
        hue: arm.hue,
        velocity: 0.55 + speedNorm * 0.4,
      });
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const nebula = Math.max(0, Math.min(1, Math.exp(-(t - state.lastNebulaT) * 1.4)));

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    if (nebula > 0.01) {
      const nr = maxR * (1.0 + nebula * 0.4);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr);
      const alpha = nebula * 0.35;
      grad.addColorStop(0, `oklch(0.92 0.18 220 / ${alpha.toFixed(3)})`);
      grad.addColorStop(0.4, `oklch(0.7 0.2 280 / ${(alpha * 0.55).toFixed(3)})`);
      grad.addColorStop(1, "oklch(0.5 0.12 240 / 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, nr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rings.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.05 220 / 0.18)";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * (i / 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Arms — each spins with `pi` laps per macro-cycle.
    for (const arm of state.arms) {
      const p = progress(t, arm.pi, B, D);
      const angle = -Math.PI / 2 + p * Math.PI * 2;
      const r = arm.rNorm * maxR;
      const tipX = cx + Math.cos(angle) * r;
      const tipY = cy + Math.sin(angle) * r;
      const hueDeg = (arm.hue * 360) % 360;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = `oklch(0.85 0.14 ${hueDeg} / 0.35)`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      const flash = Math.max(0, Math.exp(-(t - arm.lastFireT) * 2.2));
      const radius = 5 + flash * 6;
      const grad = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, radius * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tipX, tipY, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 12 o'clock trigger tick.
    ctx.strokeStyle = "oklch(0.95 0.05 220 / 0.28)";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy - maxR - 6);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    ctx.restore();
  },
};