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
  born: number;         // scene time seconds
  life: number;         // seconds
  sizeStart: number;    // px at birth
  sizeEnd: number;      // px at death
  color: string;        // hex
  /** Optional short position ring buffer for motion trails. */
  trail?: Array<{ x: number; y: number }>;
  trailLen?: number;
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
  if (count <= 0) return;
  // Emission cone: `directionDeg` is 0 = up (-y). Spread is total width.
  const dirRad = (cfg.directionDeg - 90) * (Math.PI / 180);
  const spreadRad = (cfg.angleSpreadDeg * Math.PI) / 180;
  const trailLen = Math.floor(cfg.trailLength);
  for (let k = 0; k < count; k++) {
    const a = dirRad + (Math.random() - 0.5) * spreadRad;
    const spd =
      cfg.baseSpeed *
      (1 + (Math.random() * 2 - 1) * cfg.speedVariance);
    const lifeBase = cfg.lifespanMs / 1000;
    const life = Math.max(
      0.02,
      lifeBase * (1 + (Math.random() * 2 - 1) * cfg.lifespanVariance),
    );
    const vr = 1 + (Math.random() * 2 - 1) * Math.min(1, cfg.sizeVariance / 3);
    const c = pickBurstColor(cfg, color, k);
    state.particles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd,
      born: now,
      life,
      sizeStart: Math.max(0.1, cfg.sizeStartPx * vr),
      sizeEnd: Math.max(0, cfg.sizeEndPx * vr),
      color: c,
      trail: trailLen > 0 ? [] : undefined,
      trailLen: trailLen > 0 ? trailLen : undefined,
    });
  }
  // Hard cap.
  if (state.particles.length > 2500) {
    state.particles.splice(0, state.particles.length - 2500);
  }
}

function pickBurstColor(
  cfg: CustomSceneBlueprint["aesthetic"]["burst"],
  paletteColor: string,
  seed: number,
): string {
  if (cfg.colorMode === "fixed") return cfg.fixedColor;
  if (cfg.colorMode === "rainbow") {
    const h = ((seed * 47) % 360);
    return hslHex(h, 90, 60);
  }
  return paletteColor;
}

function hslHex(h: number, s: number, l: number): string {
  const S = s / 100, L = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => L - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, "0");
  return `#${to(f(0))}${to(f(8))}${to(f(4))}`;
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
  updateParticlesDt(list, now, drag, 0, 0.016);
}

function updateParticlesDt(
  list: Particle[],
  now: number,
  drag: number,
  gravity: number,
  dt: number,
): void {
  const clampedDt = Math.min(0.05, Math.max(0, dt)); // avoid tab-restore jumps
  if (clampedDt === 0) {
    // Still reap dead particles so runaway lists get cleared even if paused.
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      if (now - p.born >= p.life) list.splice(i, 1);
    }
    return;
  }
  const decay = Math.exp(-drag * clampedDt);
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    const age = now - p.born;
    if (age >= p.life) {
      list.splice(i, 1);
      continue;
    }
    p.vx *= decay;
    p.vy = p.vy * decay + gravity * clampedDt;
    if (p.trail && p.trailLen && p.trailLen > 0) {
      p.trail.push({ x: p.x, y: p.y });
      if (p.trail.length > p.trailLen) p.trail.shift();
    }
    p.x += p.vx * clampedDt;
    p.y += p.vy * clampedDt;
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  now: number,
): void {
  // Legacy stardust path — simple soft dot.
  for (const p of list) {
    const age = now - p.born;
    const t = Math.max(0, Math.min(1, age / p.life));
    const alpha = (1 - t) * 0.9;
    const r = p.sizeStart + (p.sizeEnd - p.sizeStart) * t;
    ctx.fillStyle = withAlpha(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, r), 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Rich burst renderer. Draws by shape and interpolates alpha/size over
 * lifetime. Uses per-particle trails when configured.
 */
function drawBurst(
  ctx: CanvasRenderingContext2D,
  list: Particle[],
  now: number,
  cfg: CustomSceneBlueprint["aesthetic"]["burst"],
): void {
  if (list.length === 0) return;
  const prev = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = cfg.blendMode;
  for (const p of list) {
    const age = now - p.born;
    const t = Math.max(0, Math.min(1, age / p.life));
    const alpha = cfg.opacityStart + (cfg.opacityEnd - cfg.opacityStart) * t;
    if (alpha <= 0.001) continue;
    const r = Math.max(0.1, p.sizeStart + (p.sizeEnd - p.sizeStart) * t);

    // Optional motion trail — draw first so head sits on top.
    if (p.trail && p.trail.length > 1) {
      ctx.strokeStyle = withAlpha(p.color, alpha * 0.6);
      ctx.lineWidth = Math.max(0.5, r);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    switch (cfg.shape) {
      case "dot": {
        ctx.fillStyle = withAlpha(p.color, alpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "ring": {
        ctx.strokeStyle = withAlpha(p.color, alpha);
        ctx.lineWidth = Math.max(0.5, r * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case "spark": {
        // 4-point sparkle: cross-shaped line.
        ctx.strokeStyle = withAlpha(p.color, alpha);
        ctx.lineWidth = Math.max(0.5, r * 0.5);
        ctx.lineCap = "round";
        const l = r * 2.2;
        ctx.beginPath();
        ctx.moveTo(p.x - l, p.y); ctx.lineTo(p.x + l, p.y);
        ctx.moveTo(p.x, p.y - l); ctx.lineTo(p.x, p.y + l);
        ctx.stroke();
        break;
      }
      case "streak": {
        // Elongated in direction of velocity.
        const spd = Math.hypot(p.vx, p.vy);
        if (spd < 0.01) break;
        const nx = p.vx / spd, ny = p.vy / spd;
        const len = r * 4;
        ctx.strokeStyle = withAlpha(p.color, alpha);
        ctx.lineWidth = Math.max(0.5, r * 0.8);
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - nx * len, p.y - ny * len);
        ctx.lineTo(p.x + nx * 0.5, p.y + ny * 0.5);
        ctx.stroke();
        break;
      }
      case "glow":
      default: {
        const glow = r * 3;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glow);
        g.addColorStop(0, withAlpha(p.color, alpha));
        g.addColorStop(0.4, withAlpha(p.color, alpha * 0.5));
        g.addColorStop(1, withAlpha(p.color, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, glow, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  }
  ctx.globalCompositeOperation = prev;
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
    // Real frame dt (seconds), clamped for tab-visibility jumps.
    const dt = state.lastTime > 0 ? Math.max(0, t - state.lastTime) : 1 / 60;

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
      const stroke = A.palette.lineColorEnabled
        ? A.palette.lineColor
        : paletteAt(A.palette, i, N);
      ctx.strokeStyle = withAlpha(stroke, A.palette.lineOpacity);
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
        ctx.strokeStyle = withAlpha(pu.color, alpha * A.pathPulse.opacity);
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
      grad.addColorStop(0, withAlpha(color, Math.min(1, alpha) * A.notes.glowOpacity));
      grad.addColorStop(1, withAlpha(color, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px.x, px.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      // Solid core.
      ctx.fillStyle = withAlpha(color, Math.min(1, alpha + 0.15) * A.notes.noteOpacity);
      ctx.beginPath();
      ctx.arc(px.x, px.y, baseR, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Bursts.
    updateParticlesDt(state.particles, t, A.burst.drag, A.burst.gravity, dt);
    drawBurst(ctx, state.particles, t, A.burst);

    // ---- Stardust (climax field). Twinkle via sine.
    updateParticlesDt(state.stardust, t, 0.4, 0, dt);
    for (const p of state.stardust) {
      const age = t - p.born;
      const alphaBase = Math.max(0, 1 - age / p.life);
      const twinkle = 0.6 + 0.4 * Math.sin(t * 6 + p.x * 0.05 + p.y * 0.05);
      ctx.fillStyle = withAlpha(p.color, alphaBase * twinkle * A.climax.stardustOpacity);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.sizeStart, 0, Math.PI * 2);
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
      grad.addColorStop(0, withAlpha(state.climaxColor, flash * A.climax.flashOpacity));
      grad.addColorStop(1, withAlpha(state.climaxColor, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, g.W, g.H);
    }

    ctx.restore();
    state.lastTime = t;
  },
};