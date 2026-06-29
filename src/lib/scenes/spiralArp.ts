/**
 * Scene C — Spiral Arpeggiator.
 *
 * Archimedean spiral r = a + b·θ. Playhead particles travel inward along
 * arc length, so the angular velocity naturally compresses as r → 0
 * (accelerando). Triggers fire when a playhead crosses one of K polar
 * grid lines (θ = k · 2π / K). Pitch derived from radius (smaller r →
 * higher).
 *
 * Phase-Zero contract: arc position is a pure function of scene time:
 *     s_i(t) = (s0_i + v_i · t) mod Ltotal
 * All playheads start at the outer end (s0 = 0) so at t = 0 they sit
 * exactly on the outermost polar grid line and fire the universal Big
 * Bang chord. Audio triggers are enumerated analytically inside
 * `eventsIn` from a precomputed `arcAtBucket` table — no per-frame
 * mutation.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const COOLDOWN = 0.06;

type Playhead = {
  /** Phase-Zero arc offset (spiral-units). s(t) = (s0 + speed·t) mod Ltotal. */
  s0: number;
  /** Linear speed along arc (spiral-units / scene-second). */
  speed: number;
  slot: VoiceSlotIndex;
  hue: number;
  /** Scene-time of most recent trigger; refractory + flash derivation. */
  lastFireT: number;
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
  /** Cached density so we can hot-reseed on dock changes. */
  density: number;
  /** Cached total arc length (recomputed on geometry change). */
  Ltotal: number;
  /**
   * Cached crossing arcs for each polar-grid boundary in one lap.
   * Length = gridK · turns; entry [0] is 0 (outer start, also the
   * t = 0 Big Bang anchor).
   */
  arcAtBucket: number[];
};

/** Map dock density (2..12) → spiral turns (3..10). */
function spiralTurns(density: number) {
  return Math.max(3, Math.min(10, Math.round(3 + (density - 2) * 0.7)));
}

/** Total θ for `turns` revolutions. */
const thetaMax = (turns: number) => turns * Math.PI * 2;

/** r at a given θ. */
const radiusAt = (state: SpiralArpState, theta: number) => state.a + state.b * theta;

/** Closed-form arc length of Archimedean spiral from θ=0 to θ. */
function arcLen(b: number, theta: number): number {
  return (b / 2) * (theta * Math.sqrt(1 + theta * theta) + Math.log(theta + Math.sqrt(1 + theta * theta)));
}

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
  const target = Math.max(0, Math.min(state.Ltotal, state.Ltotal - arcFromOuter));
  let lo = 0,
    hi = tMax;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (arcLen(state.b, mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Recompute geometry caches in-place. */
function reseedGeometry(state: SpiralArpState, g: SceneGlobals) {
  const turns = spiralTurns(g.density ?? 5);
  const maxR = Math.min(g.W, g.H) * 0.42;
  const tMax = thetaMax(turns);
  const b = maxR / tMax;
  state.turns = turns;
  state.b = b;
  state.density = g.density ?? 5;
  state.Ltotal = arcLen(b, tMax);
  const K = state.gridK;
  const step = (Math.PI * 2) / K;
  const N = K * turns;
  const arr = new Array<number>(N);
  // k = 0 is the outer start (θ = tMax ≡ 0 mod step) — the Big Bang anchor.
  arr[0] = 0;
  for (let k = 1; k < N; k++) {
    arr[k] = state.Ltotal - arcLen(b, k * step);
  }
  state.arcAtBucket = arr;
}

export const spiralArpScene: Scene<SpiralArpState> = {
  id: "spiralArp",

  init(g) {
    const state: SpiralArpState = {
      a: 6,
      b: 1,
      turns: 3,
      gridK: 8,
      density: g.density ?? 5,
      Ltotal: 1,
      arcAtBucket: [0],
      // Phase Zero: all playheads at s0 = 0 (outer end, on a grid line)
      // → universal Big Bang at t = 0.
      playheads: [
        { s0: 0, speed: 22, slot: 0, hue: 0.55, lastFireT: -Infinity },
        { s0: 0, speed: 28, slot: 2, hue: 0.78, lastFireT: -Infinity },
        { s0: 0, speed: 18, slot: 4, hue: 0.18, lastFireT: -Infinity },
      ],
    };
    reseedGeometry(state, g);
    return state;
  },

  sample(state, _t, g) {
    if (spiralTurns(g.density) !== state.turns) {
      reseedGeometry(state, g);
      for (const p of state.playheads) p.lastFireT = -Infinity;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    if (spiralTurns(g.density) !== state.turns) {
      reseedGeometry(state, g);
      for (const p of state.playheads) p.lastFireT = -Infinity;
    }
    const cx = g.W / 2;
    const cy = g.H / 2;
    const { Ltotal, arcAtBucket } = state;
    const tMaxR = radiusAt(state, thetaMax(state.turns));

    for (const p of state.playheads) {
      const v = p.speed;
      if (v <= 0) continue;
      const sLo = p.s0 + v * t0;
      const sHi = p.s0 + v * t1;
      // Enumerate every bucket-boundary crossing in [sLo, sHi).
      const hits: number[] = [];
      for (let k = 0; k < arcAtBucket.length; k++) {
        const arc = arcAtBucket[k];
        const nLo = Math.ceil((sLo - arc) / Ltotal);
        const nHi = Math.floor((sHi - arc) / Ltotal);
        for (let n = nLo; n <= nHi; n++) {
          const sEv = n * Ltotal + arc;
          if (sEv < sLo || sEv >= sHi) continue;
          hits.push((sEv - p.s0) / v);
        }
      }
      hits.sort((a, b) => a - b);
      for (const tEv of hits) {
        if (tEv - p.lastFireT < COOLDOWN) continue;
        p.lastFireT = tEv;
        const sMod = ((p.s0 + v * tEv) % Ltotal + Ltotal) % Ltotal;
        const theta = thetaForArc(state, sMod);
        const r = radiusAt(state, theta);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        const rNorm = Math.max(0, Math.min(1, 1 - r / tMaxR));
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
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const tMax = thetaMax(state.turns);
    const t = g.globalTime;

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
      const sMod = ((p.s0 + p.speed * t) % state.Ltotal + state.Ltotal) % state.Ltotal;
      const theta = thetaForArc(state, sMod);
      const r = radiusAt(state, theta);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      const hueDeg = (p.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - p.lastFireT) * 3.2));
      const radius = 14 + flash * 8;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};