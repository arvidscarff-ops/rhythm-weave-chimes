/**
 * Scene D — Radial Sweep & Nebula.
 *
 * A central origin with a sweeping segmented arm (radar logic). The arm
 * angle is a pure function of scene-time: armAngle(t) = ω · t with ω
 * derived from BPM. Targets sit at fixed angles (and varied radii).
 *
 * Phase-Zero contract: at t = 0 the arm sits at angle 0, so the target
 * placed at angle 0 fires the universal Big Bang. Every subsequent
 * trigger is found analytically by solving ω · t ≡ θ_i (mod 2π) inside
 * `eventsIn`. The nebula pulse decays from `lastNebulaT` and the per-
 * target flash from `lastFireT` — both are pure functions of scene-time.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27];

type Target = {
  /** Angle in radians (0..2π). */
  angle: number;
  /** Distance from center, normalized 0..1 of maxR. */
  rNorm: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  /** Scene-time of most recent trigger; drives refractory + flash decay. */
  lastFireT: number;
  /** Cached velocity for events (high pitch / "fast" → louder). */
  velocityBase: number;
};

export type RadialSweepState = {
  targets: Target[];
  /** Cumulative trigger count (every 4th drives a nebula pulse). */
  triggerCount: number;
  /** Scene-time of last nebula pulse; drives derived intensity. */
  lastNebulaT: number;
  /** Cached density so we can hot-reseed on dock changes. */
  density: number;
};

/** Per-target refractory; defensive (uniform ω rarely produces dupes). */
const TARGET_COOLDOWN = 0.12;

/** Map dock density (2..12) → target count (6..16). */
function targetCount(density: number) {
  return Math.max(6, Math.min(16, Math.round(6 + (density - 2) * 1)));
}

/**
 * Build N targets, then apply the universal fast→left/slow→right rule by
 * placing higher-pitch ("faster"-feeling) targets on the canvas-left arc
 * (π/2 .. 3π/2) and lower-pitch targets on the canvas-right arc.
 * Targets are sorted by pitchSemis desc, then split into left/right halves
 * and distributed evenly within each half so the sweep arm still hits them
 * in a smooth cadence.
 */
function buildTargets(N: number): Target[] {
  const proto: Omit<Target, "angle">[] = [];
  for (let i = 0; i < N; i++) {
    proto.push({
      rNorm: 0.45 + (i % 3) * 0.18,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: 0.5 + (i / N) * 0.45,
      lastFireT: -Infinity,
      velocityBase: 0,
    });
  }
  // Sort by pitchSemis desc (highest pitch first = "fastest").
  proto.sort((a, b) => b.pitchSemis - a.pitchSemis);
  const maxPitch = proto[0]?.pitchSemis ?? 0;
  const minPitch = proto[proto.length - 1]?.pitchSemis ?? 0;
  const pitchSpan = Math.max(1, maxPitch - minPitch);
  const half = Math.ceil(N / 2);
  const out: Target[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const p = proto[i];
    let angle: number;
    if (i < half) {
      // Left half arc: angle in (π/2 .. 3π/2), top-left → bottom-left.
      angle = Math.PI / 2 + ((i + 0.5) / half) * Math.PI;
    } else {
      // Right half arc: angle in (-π/2 .. π/2) wrapped = (3π/2 .. 5π/2),
      // distributed bottom-right → top-right.
      const j = i - half;
      const rightN = N - half;
      angle = -Math.PI / 2 + ((j + 0.5) / rightN) * Math.PI;
      if (angle < 0) angle += Math.PI * 2;
    }
    out[i] = {
      angle,
      rNorm: p.rNorm,
      slot: p.slot,
      pitchSemis: p.pitchSemis,
      hue: p.hue,
      lastFireT: -Infinity,
      velocityBase: 0.55 + ((p.pitchSemis - minPitch) / pitchSpan) * 0.4,
    };
  }
  return out;
}

function armOmega(bpm: number) {
  // One full sweep ≈ 2 bars at 4/4.
  return (2 * Math.PI) / ((60 / Math.max(20, bpm)) * 8);
}

const TAU = Math.PI * 2;

export const radialSweepScene: Scene<RadialSweepState> = {
  id: "radialSweep",

  init(g) {
    return {
      targets: buildTargets(targetCount(g.density ?? 5)),
      triggerCount: 0,
      lastNebulaT: -Infinity,
      density: g.density ?? 5,
    };
  },

  sample(state, _t, g) {
    const want = targetCount(g.density);
    if (want !== state.targets.length) {
      state.targets = buildTargets(want);
      state.triggerCount = 0;
      state.lastNebulaT = -Infinity;
      state.density = g.density;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const want = targetCount(g.density);
    if (want !== state.targets.length) {
      state.targets = buildTargets(want);
      state.triggerCount = 0;
      state.lastNebulaT = -Infinity;
      state.density = g.density;
    }
    const omega = armOmega(g.bpm);
    if (omega <= 0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    // armAngle(t) = ω·t.  Target i fires when ω·t = θ_i + n·2π
    //   ⇒ t_n = (θ_i + n·2π)/ω,  n ≥ 0.
    // Collect every (t, target) in [t0, t1), then sort by time so
    // `triggerCount` increments in true chronological order.
    const hits: { tEv: number; target: Target }[] = [];
    for (const tg of state.targets) {
      const lapPeriod = TAU / omega;
      const tFirst = tg.angle / omega;
      // Smallest n with tFirst + n·lapPeriod >= t0.
      const nLo = Math.ceil((t0 - tFirst) / lapPeriod);
      const nHi = Math.floor((t1 - tFirst) / lapPeriod);
      for (let n = nLo; n <= nHi; n++) {
        const tEv = tFirst + n * lapPeriod;
        if (tEv < t0 || tEv >= t1) continue;
        hits.push({ tEv, target: tg });
      }
    }
    hits.sort((a, b) => a.tEv - b.tEv);
    for (const { tEv, target: tg } of hits) {
      if (tEv - tg.lastFireT < TARGET_COOLDOWN) continue;
      tg.lastFireT = tEv;
      state.triggerCount++;
      if (state.triggerCount % 4 === 0) state.lastNebulaT = tEv;
      const r = tg.rNorm * maxR;
      const x = cx + Math.cos(tg.angle) * r;
      const y = cy + Math.sin(tg.angle) * r;
      events.push({
        slot: tg.slot,
        freq: freqOf(tg.pitchSemis + g.pitchSemis),
        x,
        y,
        hue: tg.hue,
        velocity: tg.velocityBase,
      });
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const t = g.globalTime;
    const omega = armOmega(g.bpm);
    const armAngle = omega * t;
    const nebula = Math.max(0, Math.min(1, Math.exp(-(t - state.lastNebulaT) * 1.4)));

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Nebula bloom (central radial gradient pulse) — derived from lastNebulaT.
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

    // Outer ring + faint inner rings.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.05 220 / 0.18)";
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * (i / 3), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Sweep wedge — derived trail by sampling armAngle backward in time.
    const TRAIL_N = 18;
    const TRAIL_DT = 0.035;
    for (let i = 1; i < TRAIL_N; i++) {
      const a0 = omega * (t - i * TRAIL_DT);
      const a1 = omega * (t - (i - 1) * TRAIL_DT);
      const alpha = ((TRAIL_N - i) / TRAIL_N) * 0.18;
      ctx.fillStyle = `oklch(0.85 0.16 200 / ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, a0, a1);
      ctx.closePath();
      ctx.fill();
    }

    // Arm line.
    const tipX = cx + Math.cos(armAngle) * maxR;
    const tipY = cy + Math.sin(armAngle) * maxR;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.95 0.16 200 / 0.85)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "oklch(0.8 0.18 220 / 0.12)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();

    // Targets — flash decays from lastFireT.
    for (const tg of state.targets) {
      const r = tg.rNorm * maxR;
      const x = cx + Math.cos(tg.angle) * r;
      const y = cy + Math.sin(tg.angle) * r;
      const hueDeg = (tg.hue * 360) % 360;
      const flash = Math.max(0, Math.min(1, Math.exp(-(t - tg.lastFireT) * 2.2)));
      ctx.strokeStyle = `oklch(0.92 0.16 ${hueDeg} / ${(0.2 + flash * 0.6).toFixed(3)})`;
      ctx.lineWidth = 1.0 + flash * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5 + flash * 6, 0, Math.PI * 2);
      ctx.stroke();
      if (flash > 0.05) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
        grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(flash * 0.65).toFixed(3)})`);
        grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  },
};