/**
 * Scene D — Radial Sweep & Nebula.
 *
 * A central origin with a sweeping segmented arm (radar logic). The arm
 * has angular velocity ω derived from BPM. Targets sit at fixed angles
 * (and varied radii). A trigger fires when the arm angle crosses each
 * target's angle.
 *
 * On every Kth trigger the central nebula gets a soft, blooming pulse —
 * a large slow-decay ink-bleed-style radial gradient.
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
  flash: number;
};

export type RadialSweepState = {
  /** Current arm angle (rad). */
  armAngle: number;
  /** Trail of recent arm angles for the sweep wedge. */
  trailAngles: number[];
  targets: Target[];
  /** Trigger counter for nebula pulses. */
  triggerCount: number;
  /** Nebula pulse intensity 0..1 (decays). */
  nebula: number;
  clock: number;
};

/** Map dock density (2..12) → target count (6..16). */
function targetCount(density: number) {
  return Math.max(6, Math.min(16, Math.round(6 + (density - 2) * 1)));
}

function buildTargets(N: number): Target[] {
  const out: Target[] = [];
  for (let i = 0; i < N; i++) {
    out.push({
      angle: (i / N) * Math.PI * 2,
      rNorm: 0.45 + (i % 3) * 0.18,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: 0.5 + (i / N) * 0.45,
      flash: 0,
    });
  }
  return out;
}

function armOmega(bpm: number) {
  // One full sweep ≈ 2 bars at 4/4.
  return (2 * Math.PI) / ((60 / Math.max(20, bpm)) * 8);
}

/** Normalize to [0, 2π). */
function norm(a: number) {
  const tau = Math.PI * 2;
  return ((a % tau) + tau) % tau;
}

/** Forward distance from prev → next angle (assuming CCW motion). */
function fwd(prev: number, next: number) {
  const tau = Math.PI * 2;
  return ((next - prev) % tau + tau) % tau;
}

export const radialSweepScene: Scene<RadialSweepState> = {
  id: "radialSweep",

  init(_g) {
    const targets = buildTargets(targetCount(_g.density ?? 5));
    return {
      armAngle: 0,
      trailAngles: [],
      targets,
      triggerCount: 0,
      nebula: 0,
      clock: 0,
    };
  },

  update(state, dt, g) {
    const want = targetCount(g.density);
    if (want !== state.targets.length) state.targets = buildTargets(want);
    state.clock += dt;
    state.nebula = Math.max(0, state.nebula - dt * 1.4);
    for (const t of state.targets) t.flash = Math.max(0, t.flash - dt * 2.2);

    const omega = armOmega(g.bpm) * g.speed;
    const prev = norm(state.armAngle);
    state.armAngle += omega * dt;
    const next = norm(state.armAngle);
    state.trailAngles.push(next);
    if (state.trailAngles.length > 18) state.trailAngles.shift();

    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;
    const arc = fwd(prev, next);

    const events: TriggerEvent[] = [];
    for (const tg of state.targets) {
      const d = fwd(prev, tg.angle);
      if (d > 0 && d <= arc) {
        const r = tg.rNorm * maxR;
        const x = cx + Math.cos(tg.angle) * r;
        const y = cy + Math.sin(tg.angle) * r;
        tg.flash = 1;
        state.triggerCount++;
        if (state.triggerCount % 4 === 0) {
          // Nebula pulse on every 4th trigger.
          state.nebula = 1;
        }
        events.push({
          slot: tg.slot,
          freq: freqOf(tg.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: tg.hue,
          velocity: 0.7,
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const maxR = Math.min(g.W, g.H) * 0.42;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Nebula bloom (central radial gradient pulse).
    if (state.nebula > 0.01) {
      const nr = maxR * (1.0 + state.nebula * 0.4);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, nr);
      const alpha = state.nebula * 0.35;
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

    // Sweep wedge — fading trail of past arm positions.
    const trail = state.trailAngles;
    if (trail.length > 1) {
      for (let i = 1; i < trail.length; i++) {
        const a0 = trail[i - 1];
        const a1 = trail[i];
        const alpha = (i / trail.length) * 0.18;
        ctx.fillStyle = `oklch(0.85 0.16 200 / ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, maxR, a0, a1);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Arm line.
    const tipX = cx + Math.cos(state.armAngle) * maxR;
    const tipY = cy + Math.sin(state.armAngle) * maxR;
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

    // Targets.
    for (const t of state.targets) {
      const r = t.rNorm * maxR;
      const x = cx + Math.cos(t.angle) * r;
      const y = cy + Math.sin(t.angle) * r;
      const hueDeg = (t.hue * 360) % 360;
      ctx.strokeStyle = `oklch(0.92 0.16 ${hueDeg} / ${(0.2 + t.flash * 0.6).toFixed(3)})`;
      ctx.lineWidth = 1.0 + t.flash * 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 5 + t.flash * 6, 0, Math.PI * 2);
      ctx.stroke();
      if (t.flash > 0.05) {
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 18);
        grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(t.flash * 0.65).toFixed(3)})`);
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