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
import { speedCoeffs, phaseOffsets } from "@/lib/engine/polyrhythm";

/**
 * Strand ratios are derived from the shared prime/φ distribution.
 * Coefficients are sorted descending so strand 0 (leftmost) is the
 * fastest oscillator (smallest period multiplier) — preserving the
 * universal "fast notes on the left, slow on the right" rule.
 * Range is compressed by a soft exponent so the slowest strand at
 * high N still moves noticeably on screen.
 */
function strandRatios(N: number): number[] {
  const coeffs = speedCoeffs(N).slice().sort((a, b) => b - a);
  // ratio = 1 / coeff^0.6 — softens the dynamic range from ~18× to ~6×.
  return coeffs.map((c) => 1 / Math.pow(Math.max(1e-3, c), 0.6));
}
/** Map dock density (2..12) → strand count (5..14). */
function strandCount(density: number) {
  return Math.max(5, Math.min(14, Math.round(5 + (density - 2) * 0.9)));
}
const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);

/** Normalized distance the trigger ring sits at, along each string. */
const TARGET_DIST_NORM = 0.78;
/** Refractory window per strand (s). */
const COOLDOWN = 0.18;

// d(θ) = 0.5 + 0.4 sin(2π θ).  d = 0.78 ⇒ sin(2π θ) = 0.7.
// Two solutions per unit-θ cycle (rising + falling crossings).
const ALPHA = Math.asin(0.7);            // ≈ 0.7754
const RISING_PHASE = ALPHA / (Math.PI * 2);     // ≈ 0.1234  ← Phase-Zero anchor
const FALLING_PHASE = 0.5 - ALPHA / (Math.PI * 2); // ≈ 0.3766

type Strand = {
  /** Fan angle from straight-down (radians). Negative = left. */
  angle: number;
  /** Modulation period multiplier (Galileo ratio). */
  ratio: number;
  /**
   * Phase-Zero offset (in θ-units, 0..1). Set to {@link RISING_PHASE}
   * plus a small golden-ratio perturbation so every strand starts
   * visually NEAR its target ring at t=0 (the explicit t=0 trigger in
   * `eventsIn` still fires the universal Big Bang chord), then phases
   * out of unison immediately afterward.
   */
  phase0: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  /**
   * Scene-time of the most recent trigger from this strand. Used both
   * by the scheduler's refractory guard and by `sample` to derive the
   * visual flash without per-frame mutation.
   */
  lastFireT: number;
  /** Cached velocity for events from this strand (fast strand → louder). */
  velocityBase: number;
};

export type PendulumFanState = {
  strands: Strand[];
  /** Cached density so we can hot-reseed on dock changes. */
  density: number;
};

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 5.4;
}

/** Pure: normalized distance 0..1 of strand at scene-time t. */
function strandD(s: Strand, t: number, period: number) {
  const T = period * s.ratio;
  const theta = s.phase0 + t / T;
  return 0.5 + 0.4 * Math.sin(theta * Math.PI * 2);
}

function makeStrands(density: number): Strand[] {
  const N = strandCount(density);
  const ratios = strandRatios(N);
  // Compressed golden offsets in (-0.05, +0.05) θ-units → tiny visual
  // perturbation off the ring at t=0, big enough to desync over time.
  const offsets = phaseOffsets(N).map((o) => (o - 0.5) * 0.1);
  const out: Strand[] = [];
  for (let i = 0; i < N; i++) {
    const angle = ((i - (N - 1) / 2) / (N - 1)) * (Math.PI * 0.55);
    const ratio = ratios[i];
    // Faster strand → louder ink-bleed. Normalize 1/ratio across [1/maxRatio, 1].
    const fastNorm = 1 / ratio; // ∈ (0, 1]; ratio≥1 always
    out.push({
      angle,
      ratio,
      phase0: RISING_PHASE + offsets[i],
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: 12 - i * 2, // leftmost = highest pitch (matches fast = left)
      hue: 0.55 + (i / N) * 0.4,
      lastFireT: -Infinity,
      velocityBase: 0.55 + fastNorm * 0.4,
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
    const period = basePeriod(g.bpm);
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;

    for (const s of state.strands) {
      const T = period * s.ratio;
      if (T <= 0) continue;
      // θ(t) = phase0 + t/T ; crossings at θ = RISING_PHASE + k and
      // θ = FALLING_PHASE + k.
      const theta0 = s.phase0 + t0 / T;
      const theta1 = s.phase0 + t1 / T;
      const lo = Math.min(theta0, theta1);
      const hi = Math.max(theta0, theta1);
      // For each anchor offset, enumerate integers k with anchor+k ∈ [lo, hi).
      const collect = (anchor: number, out: number[]) => {
        const firstK = Math.ceil(lo - anchor);
        const lastK = Math.floor(hi - anchor);
        // Note: include start exactly so the t=0 Big Bang fires.
        for (let k = firstK; k <= lastK; k++) {
          const th = anchor + k;
          if (th >= lo && th < hi) out.push(th);
        }
      };
      const thetas: number[] = [];
      collect(RISING_PHASE, thetas);
      collect(FALLING_PHASE, thetas);
      thetas.sort((p, q) => p - q);

      for (const theta of thetas) {
        const tEv = (theta - s.phase0) * T;
        if (tEv <= 0) continue; // Big Bang owns t=0
        if (tEv - s.lastFireT < COOLDOWN) continue;
        s.lastFireT = tEv;
        const tx = ax + Math.sin(s.angle) * stringLen * TARGET_DIST_NORM;
        const ty = ay + Math.cos(s.angle) * stringLen * TARGET_DIST_NORM;
        events.push({
          slot: s.slot,
          freq: freqOf(s.pitchSemis + g.pitchSemis),
          x: tx,
          y: ty,
          hue: s.hue,
          velocity: s.velocityBase,
        });
      }
    }
    return events;
  },

  bigBang(state, g) {
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    return state.strands.map((s) => {
      const tx = ax + Math.sin(s.angle) * stringLen * TARGET_DIST_NORM;
      const ty = ay + Math.cos(s.angle) * stringLen * TARGET_DIST_NORM;
      s.lastFireT = 0;
      return {
        slot: s.slot,
        freq: freqOf(s.pitchSemis + g.pitchSemis),
        x: tx,
        y: ty,
        hue: s.hue,
        velocity: s.velocityBase,
      };
    });
  },

  draw(state, ctx, g) {
    const ax = g.W / 2;
    const ay = g.H * 0.14;
    const stringLen = g.H * 0.68;
    const targetDistNorm = TARGET_DIST_NORM;
    const period = basePeriod(g.bpm);
    const t = g.globalTime;

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
      const d = strandD(s, t, period);
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