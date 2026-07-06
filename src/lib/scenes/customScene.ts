/**
 * Scene — Custom (blueprint-driven).
 *
 * Runtime for the Scene Builder. Reads the active `CustomSceneBlueprint`
 * from `activeBlueprint` every frame so aesthetic edits and preset loads
 * apply instantly without touching the audio scheduler or resetting the
 * musical clock. Timing still flows through `phaseAlign` so the
 * macro-cycle Big Bang rule is preserved.
 *
 * Rendering layers, back-to-front:
 *   1. preClear() — fade previous frame by (1 - trail.decay), giving
 *      long-exposure ribbons when decay is high.
 *   2. Wireframe tracks (path polylines) with palette color.
 *   3. Path pulses — flashes running along a track after a trigger.
 *   4. Note orbs — uniform radius + independent "living breath" glow.
 *   5. Particle bursts — organic per-note explosion on each trigger.
 *   6. Macro-cycle climax — ambient flash + stardust field on every
 *      Big Bang.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { progress } from "@/lib/engine/phaseAlign";
import {
  crossings as pathCrossings,
  positionOn,
  samplePath,
  trackRotation,
  trackScale,
  type CustomSceneBlueprint,
} from "@/lib/engine/pathTransformer";
import { getActiveBlueprint } from "@/lib/scenes/activeBlueprint";
import { paletteAt, paletteMid, withAlpha } from "@/lib/studio/palettes";

/* ------------------------------------------------------------------ */
/*  Pitch / voice mapping (unchanged from previous revision)          */
/* ------------------------------------------------------------------ */

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
// eslint-disable-next-line prettier/prettier
const SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36, 38, 40, 43, 45, 48, 50, 52, 55];

/* ------------------------------------------------------------------ */
/*  Mutable scene state — particle systems + trigger history          */
/* ------------------------------------------------------------------ */

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  born: number;      // scene time seconds
  life: number;      // seconds
  size: number;
  color: string;     // rgb
};

type PulseTrace = {
  trackIdx: number;
  born: number;
  color: string;
  startProgress: number;
};

type StardustSpec = Particle;

export type CustomSceneState = {
  particles: Particle[];
  pulses: PulseTrace[];
  stardust: StardustSpec[];
  lastEventsScanUntil: number;
  lastCycleIndex: number;
  climaxUntil: number;       // scene time by which ambient flash decays
  climaxColor: string;
  lastTime: number;
};

function makeState(): CustomSceneState {
  return {
    particles: [],
    pulses: [],
    stardust: [],
    lastEventsScanUntil: 0,
    lastCycleIndex: -1,
    climaxUntil: 0,
    climaxColor: "#ffffff",
    lastTime: 0,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function resolveTrackCount(bp: CustomSceneBlueprint, g: SceneGlobals): number {
  const override = bp.layout.trackCount;
  if (typeof override === "number" && override > 0) {
    return Math.max(1, Math.min(48, Math.floor(override)));
  }
  return Math.max(1, Math.min(48, g.noteCount));
}

/** Map unit-space (-1..1) to pixels centered on the canvas. */
function toPx(
  x: number, y: number,
  scale: number, rot: number,
  W: number, H: number,
): { x: number; y: number } {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const rx = x * c - y * s;
  const ry = x * s + y * c;
  const half = Math.min(W, H) / 2;
  return { x: W / 2 + rx * scale * half, y: H / 2 + ry * scale * half };
}

function spawnBurst(
  state: CustomSceneState,
  cx: number, cy: number,
  color: string,
  now: number,
  cfg: CustomSceneBlueprint["aesthetic"]["burst"],
): void {
  const count = Math.floor(cfg.count);
  for (let k = 0; k < count; k++) {
    const a = Math.random() * Math.PI * 2;
    const spd = cfg.baseSpeed * (0.5 + Math.random());
    const life = (cfg.lifespanMs / 1000) * (0.6 + Math.random() * 0.8);
    state.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      born: now,
      life,
      size: 1 + Math.random() * (1 + cfg.sizeVariance),
      color,
    });
  }
  // Cap runaway growth.
  if (state.particles.length > 2000) state.particles.splice(0, state.particles.length - 2000);
}

function spawnStardust(
  state: CustomSceneState,
  W: number, H: number,
  color: string,
  now: number,
  count: number,
): void {
  const c = Math.min(120, Math.floor(count));
  for (let k = 0; k < c; k++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 20 + Math.random() * 60;
    state.stardust.push({
      x: W / 2, y: H / 2,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      born: now,
      life: 2.5 + Math.random() * 2.5,
      size: 0.6 + Math.random() * 1.4,
      color,
    });
  }
}

function updateParticles(list: Particle[], now: number, drag: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const age = now - p.born;
    if (age >= p.life) {
      list.splice(i, 1);
      continue;
    }
    // Simple exponential drag (per-second).
    const decay = Math.exp(-drag * 0.016);
    p.vx *= decay;
    p.vy *= decay;
    p.x += p.vx * 0.016;
    p.y += p.vy * 0.016;
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  now: number,
): void {
  for (const p of list) {
    const age = now - p.born;
    const alpha = Math.max(0, 1 - age / p.life);
    ctx.fillStyle = withAlpha(p.color, alpha * 0.9);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ */
/*  Scene implementation                                              */
/* ------------------------------------------------------------------ */

export const customScene: Scene<CustomSceneState> = {
  id: "custom",

  init() {
    return makeState();
  },

  /**
   * Own the frame background. On the first frame of a session, paint
   * black; afterwards, fade previous frame by (1 - decay). At decay=0
   * this collapses to a full clear; at decay~0.95 it produces long
   * exposure ribbons that trace the path shapes.
   */
  preClear(ctx, g) {
    const bp = getActiveBlueprint();
    const decay = bp.aesthetic.trail.decay;
    const fade = Math.max(0.02, 1 - decay);
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0, 0, 0, ${fade.toFixed(3)})`;
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();
  },

  sample(state) {
    void state; // stateless — blueprint read live in draw()
  },

  /**
   * Audio triggers only. Visual reactions (bursts, pulses, climax) are
   * spawned inside `draw` using progress deltas so the preview canvas
   * (which doesn't run the scheduler) still gets the same aesthetic.
   */
  eventsIn(_state, t0, t1, g) {
    if (t1 <= t0) return [];
    const bp = getActiveBlueprint();
    const N = resolveTrackCount(bp, g);
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const slot = bp.voice.slot as VoiceSlotIndex;
    const events: TriggerEvent[] = [];
    for (let i = 0; i < N; i++) {
      const times = pathCrossings(bp, i, B, D, t0, t1);
      if (times.length === 0) continue;
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const hue = (i / Math.max(1, N)) * 0.9;
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

  draw(state, ctx, g) {
    const bp = getActiveBlueprint();
    const A = bp.aesthetic;
    const N = resolveTrackCount(bp, g);
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const t = g.globalTime;

    // ---- Detect new triggers since last draw (drives visuals only).
    const t0 = state.lastEventsScanUntil > 0 ? state.lastEventsScanUntil : Math.max(0, t - 0.05);
    const t1 = t;
    state.lastEventsScanUntil = t1;

    if (t1 > t0) {
      for (let i = 0; i < N; i++) {
        const times = pathCrossings(bp, i, B, D, t0, t1);
        if (times.length === 0) continue;
        const scale = trackScale(bp.layout, i, N);
        const rot = trackRotation(bp.layout, i);
        const color = paletteAt(A.palette, i, N);
        for (const et of times) {
          const p = progress(et, i, B, D);
          const pos = positionOn(bp.path, p);
          const px = toPx(pos.x, pos.y, scale, rot, g.W, g.H);
          spawnBurst(state, px.x, px.y, color, t, A.burst);
          if (A.pathPulse.enabled) {
            state.pulses.push({ trackIdx: i, born: t, color, startProgress: p });
            if (state.pulses.length > 128) state.pulses.splice(0, state.pulses.length - 128);
          }
        }
      }
    }

    // ---- Macro-cycle boundary — Big Bang climax detector.
    const cycleIndex = Math.floor(t / D);
    if (cycleIndex !== state.lastCycleIndex && t > 0.1) {
      state.lastCycleIndex = cycleIndex;
      const midColor = paletteMid(A.palette);
      if (A.climax.ambientFlash) {
        state.climaxUntil = t + 1.2;
        state.climaxColor = midColor;
      }
      if (A.climax.stardust && A.climax.stardustCount > 0) {
        spawnStardust(state, g.W, g.H, midColor, t, A.climax.stardustCount);
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // ---- Wireframe tracks.
    const polyline = samplePath(bp.path, 144);
    ctx.lineWidth = 0.8;
    for (let i = 0; i < N; i++) {
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const color = paletteAt(A.palette, i, N);
      ctx.strokeStyle = withAlpha(color, 0.22);
      ctx.beginPath();
      for (let k = 0; k < polyline.length; k++) {
        const p = polyline[k];
        const px = toPx(p.x, p.y, scale, rot, g.W, g.H);
        if (k === 0) ctx.moveTo(px.x, px.y);
        else ctx.lineTo(px.x, px.y);
      }
      ctx.stroke();
    }

    // ---- Axis-intersect trigger guide.
    if (bp.trigger.mode === "axisIntersect") {
      const half = Math.min(g.W, g.H) / 2;
      const pos = bp.trigger.position ?? 0;
      ctx.strokeStyle = "rgba(220, 240, 255, 0.22)";
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

    // ---- Path pulses — bright arc traveling along the track.
    if (A.pathPulse.enabled) {
      const PULSE_LIFE = 0.6;
      for (let k = state.pulses.length - 1; k >= 0; k--) {
        const pu = state.pulses[k];
        const age = t - pu.born;
        if (age >= PULSE_LIFE) {
          state.pulses.splice(k, 1);
          continue;
        }
        const i = pu.trackIdx;
        if (i >= N) continue;
        const scale = trackScale(bp.layout, i, N);
        const rot = trackRotation(bp.layout, i);
        const alpha = 1 - age / PULSE_LIFE;
        const head = pu.startProgress + age * A.pathPulse.speed;
        const tail = head - 0.08;
        const steps = 20;
        ctx.lineCap = "round";
        ctx.lineWidth = A.pathPulse.widthPx;
        ctx.strokeStyle = withAlpha(pu.color, alpha * 0.9);
        ctx.beginPath();
        for (let s = 0; s <= steps; s++) {
          const pn = tail + ((head - tail) * s) / steps;
          const posN = positionOn(bp.path, pn);
          const px = toPx(posN.x, posN.y, scale, rot, g.W, g.H);
          if (s === 0) ctx.moveTo(px.x, px.y);
          else ctx.lineTo(px.x, px.y);
        }
        ctx.stroke();
      }
      ctx.lineCap = "butt";
    }

    // ---- Note orbs — uniform radius + independent "living breath".
    const baseR = A.notes.baseRadiusPx;
    for (let i = 0; i < N; i++) {
      const p = progress(t, i, B, D);
      const pos = positionOn(bp.path, p);
      const scale = trackScale(bp.layout, i, N);
      const rot = trackRotation(bp.layout, i);
      const px = toPx(pos.x, pos.y, scale, rot, g.W, g.H);
      const color = paletteAt(A.palette, i, N);

      // Independent oscillator per note.
      const breath =
        A.notes.breathHz > 0
          ? 0.5 + 0.5 * Math.sin(t * A.notes.breathHz * Math.PI * 2 + i * 0.37)
          : 1;
      const alpha = 0.72 + A.notes.breathDepth * (breath - 0.5) * 2 * 0.4;

      // Glow halo.
      const glowR = baseR * 4;
      const grad = ctx.createRadialGradient(px.x, px.y, 0, px.x, px.y, glowR);
      grad.addColorStop(0, withAlpha(color, Math.min(1, alpha)));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px.x, px.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Solid core.
      ctx.fillStyle = withAlpha(color, Math.min(1, alpha + 0.15));
      ctx.beginPath();
      ctx.arc(px.x, px.y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Bursts.
    updateParticles(state.particles, t, A.burst.drag);
    drawParticles(ctx, state.particles, t);

    // ---- Stardust (climax field). Twinkle via sine.
    updateParticles(state.stardust, t, 0.4);
    for (const p of state.stardust) {
      const age = t - p.born;
      const alphaBase = Math.max(0, 1 - age / p.life);
      const twinkle = 0.6 + 0.4 * Math.sin(t * 6 + p.x * 0.05 + p.y * 0.05);
      ctx.fillStyle = withAlpha(p.color, alphaBase * twinkle);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Ambient climax flash — full-canvas radial breath.
    if (state.climaxUntil > t) {
      const remaining = state.climaxUntil - t;
      const flash = Math.min(1, remaining / 1.2);
      const grad = ctx.createRadialGradient(
        g.W / 2, g.H / 2, 0,
        g.W / 2, g.H / 2, Math.max(g.W, g.H) * 0.7,
      );
      grad.addColorStop(0, withAlpha(state.climaxColor, flash * 0.35));
      grad.addColorStop(1, withAlpha(state.climaxColor, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, g.W, g.H);
    }

    ctx.restore();
    state.lastTime = t;
  },
};