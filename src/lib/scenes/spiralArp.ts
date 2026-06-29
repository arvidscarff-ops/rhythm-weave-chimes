/**
 * Scene C — Spiral Arpeggiator.
 *
 * Archimedean spiral r = a + b·θ. Playhead particles travel inward along
 * arc length, so the angular velocity naturally compresses as r → 0
 * (accelerando). Triggers fire when a playhead crosses one of K polar
 * grid lines (θ = k · 2π / K). Pitch derived from radius (smaller r →
 * higher).
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];

type Playhead = {
  /** Arc length traveled from outer end, in spiral-units. */
  s: number;
  /** Linear speed along arc (spiral-units/sec). */
  speed: number;
  /** Last θ in radians (for grid-crossing detection). */
  prevTheta: number;
  slot: VoiceSlotIndex;
  hue: number;
  /** Refractory clock. */
  cool: number;
};

export type SpiralArpState = {
  /** Spiral params: r = a + b·θ. */
  a: number;
  b: number;
  /** Number of full turns. */
  turns: number;
  /** Polar grid divisions (K). */
  gridK: number;
  playheads: Playhead[];
  clock: number;
};

/** Total θ for `turns` revolutions. */
const thetaMax = (turns: number) => turns * Math.PI * 2;

/** r at a given θ. */
const radiusAt = (state: SpiralArpState, theta: number) => state.a + state.b * theta;

/**
 * Convert arc length `s` (from outer end θ=θmax going inward) to current
 * θ. Uses the closed form for Archimedean arc length:
 *
 *   L(θ) = (b/2)·[θ·√(1+θ²) + asinh(θ)]
 *
 * We numerically invert by bisection — cheap and stable for small N.
 */
function thetaForArc(state: SpiralArpState, arcFromOuter: number): number {
  const tMax = thetaMax(state.turns);
  const L = (t: number) =>
    (state.b / 2) * (t * Math.sqrt(1 + t * t) + Math.log(t + Math.sqrt(1 + t * t)));
  const Ltotal = L(tMax);
  const target = Math.max(0, Math.min(Ltotal, Ltotal - arcFromOuter));
  let lo = 0,
    hi = tMax;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (L(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export const spiralArpScene: Scene<SpiralArpState> = {
  id: "spiralArp",

  init(g) {
    const turns = 6;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const tMax = thetaMax(turns);
    const b = maxR / tMax;
    return {
      a: 6,
      b,
      turns,
      gridK: 8,
      playheads: [
        { s: 0, speed: 22, prevTheta: tMax, slot: 0, hue: 0.55, cool: 0 },
        { s: 30, speed: 28, prevTheta: tMax, slot: 2, hue: 0.78, cool: 0 },
        { s: 60, speed: 18, prevTheta: tMax, slot: 4, hue: 0.18, cool: 0 },
      ],
      clock: 0,
    };
  },

  update(state, dt, g) {
    state.clock += dt;
    const events: TriggerEvent[] = [];
    const tMax = thetaMax(state.turns);
    const Ltotal = (() => {
      const L = (t: number) =>
        (state.b / 2) * (t * Math.sqrt(1 + t * t) + Math.log(t + Math.sqrt(1 + t * t)));
      return L(tMax);
    })();
    const cx = g.W / 2;
    const cy = g.H / 2;

    for (const p of state.playheads) {
      p.cool = Math.max(0, p.cool - dt);
      p.s += p.speed * dt * g.speed;
      // Wrap when we've traversed the whole arc — re-spawn at outer end.
      if (p.s >= Ltotal) p.s = p.s - Ltotal;
      const theta = thetaForArc(state, p.s);
      // Detect polar grid crossings: floor(theta / step) changed.
      const step = (Math.PI * 2) / state.gridK;
      const prevBucket = Math.floor(p.prevTheta / step);
      const curBucket = Math.floor(theta / step);
      if (curBucket !== prevBucket && p.cool <= 0) {
        p.cool = 0.06;
        const r = radiusAt(state, theta);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        // Pitch: smaller r → higher index. Map r∈[a, a+b·tMax] → semis.
        const rNorm = 1 - r / radiusAt(state, tMax);
        const semIdx = Math.floor(rNorm * (SCALE_SEMIS.length - 1));
        events.push({
          slot: p.slot,
          freq: freqOf(SCALE_SEMIS[semIdx] + g.pitchSemis),
          x,
          y,
          hue: p.hue,
          velocity: 0.5 + rNorm * 0.45,
        });
      }
      p.prevTheta = theta;
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const tMax = thetaMax(state.turns);

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Polar grid lines (sparse, ultra-faint).
    const step = (Math.PI * 2) / state.gridK;
    const maxR = radiusAt(state, tMax);
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.05 220 / 0.12)";
    for (let k = 0; k < state.gridK; k++) {
      const a = k * step;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
      ctx.stroke();
    }

    // Spiral track — three additive passes for halo.
    const passes = [
      { w: 0.5, a: 0.65, hue: 200 },
      { w: 1.4, a: 0.16, hue: 220 },
      { w: 3.4, a: 0.05, hue: 260 },
    ];
    for (const pass of passes) {
      ctx.lineWidth = pass.w;
      ctx.strokeStyle = `oklch(0.85 0.14 ${pass.hue} / ${pass.a.toFixed(2)})`;
      ctx.beginPath();
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const theta = (i / N) * tMax;
        const r = radiusAt(state, theta);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Playheads.
    for (const p of state.playheads) {
      const theta = thetaForArc(state, p.s);
      const r = radiusAt(state, theta);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      const hueDeg = (p.hue * 360) % 360;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, 14);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / 0.95)`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};