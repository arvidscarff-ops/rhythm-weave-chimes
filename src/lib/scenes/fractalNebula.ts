/**
 * Scene G — Fractal Nebula (Phase-Alignment retrofit).
 *
 * 50 particles across 5 nested polygons. Each particle rides one edge
 * of its layer's polygon with `u_i(t) = 0.5 - 0.5 · cos(2π · progress)`,
 * so `u = 0` (vertex A) at every wrap → every particle sits on a
 * polygon vertex in unison at `t = k · D`.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress, cycleFraction } from "@/lib/engine/phaseAlign";
import { PHI } from "@/lib/engine/polyrhythm";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];

type LayerSpec = {
  vertices: number;
  radiusFrac: number;
  pack: PackId;
  /** Layer rotation rate, in cycles per macro-cycle. Integer keeps unison. */
  rotLapsPerCycle: number;
  pitchBase: number;
  hue: number;
};

const LAYERS: LayerSpec[] = [
  { vertices: 3,  radiusFrac: 0.14, pack: "moss",     rotLapsPerCycle: 4, pitchBase: +14, hue: 0.50 },
  { vertices: 4,  radiusFrac: 0.22, pack: "moss",     rotLapsPerCycle: 3, pitchBase:  +7, hue: 0.58 },
  { vertices: 6,  radiusFrac: 0.30, pack: "prism",    rotLapsPerCycle: 2, pitchBase:   0, hue: 0.68 },
  { vertices: 8,  radiusFrac: 0.36, pack: "prism",    rotLapsPerCycle: 1, pitchBase:  -7, hue: 0.78 },
  { vertices: 12, radiusFrac: 0.42, pack: "obsidian", rotLapsPerCycle: 1, pitchBase: -14, hue: 0.86 },
];

const PARTICLES_PER_LAYER = 10;

type Particle = {
  id: number;
  layer: number;
  edge: number;
  /** Phase-Alignment voice index. */
  pi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  lastFireT: number;
};

export type FractalNebulaState = {
  particles: Particle[];
};

function buildParticles(): Particle[] {
  const total = LAYERS.length * PARTICLES_PER_LAYER;
  const particles: Particle[] = new Array(total);
  // pi order: inner layer = fastest (higher pi). Reversed so L=0 gets high pi.
  for (let L = 0; L < LAYERS.length; L++) {
    const spec = LAYERS[L];
    for (let k = 0; k < PARTICLES_PER_LAYER; k++) {
      const i = L * PARTICLES_PER_LAYER + k;
      // Higher pi for inner layers (fastest).
      const pi = (LAYERS.length - 1 - L) * PARTICLES_PER_LAYER + k;
      particles[i] = {
        id: i,
        layer: L,
        edge: k % spec.vertices,
        pi,
        slot: (i % 6) as VoiceSlotIndex,
        pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length] + spec.pitchBase,
        hue: (spec.hue + (k / PARTICLES_PER_LAYER) * 0.06) % 1,
        pack: spec.pack,
        lastFireT: -Infinity,
      };
    }
  }
  return particles;
}

function vertexAngle(i: number, V: number) {
  return (i / V) * Math.PI * 2 - Math.PI / 2;
}

function layerRotation(spec: LayerSpec, t: number, D: number) {
  // Integer laps per macro-cycle → rotation returns to 0 at t=k·D,
  // preserving unison for particles that live on vertices at wrap.
  return cycleFraction(t, D) * Math.PI * 2 * spec.rotLapsPerCycle;
}

function edgePos(
  spec: LayerSpec,
  edge: number,
  u: number,
  rotation: number,
  cx: number,
  cy: number,
  minR: number,
) {
  const V = spec.vertices;
  const r = minR * spec.radiusFrac;
  const aA = vertexAngle(edge, V) + rotation;
  const aB = vertexAngle((edge + 1) % V, V) + rotation;
  const Ax = cx + Math.cos(aA) * r;
  const Ay = cy + Math.sin(aA) * r;
  const Bx = cx + Math.cos(aB) * r;
  const By = cy + Math.sin(aB) * r;
  return { x: Ax + (Bx - Ax) * u, y: Ay + (By - Ay) * u };
}

function particleU(pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  return 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
}

/** Rendered u — adds a tiny cycle-preserving wobble for organic feel. */
function particleURender(pi: number, t: number, B: number, D: number) {
  const u = particleU(pi, t, B, D);
  // Wobble is a function of the macro-cycle phase (returns to 0 at wrap).
  const cf = cycleFraction(t, D);
  const wob = Math.sin(cf * Math.PI * 2 * 3) * 0.03 * Math.sin(pi * PHI);
  return Math.max(0, Math.min(1, u + wob));
}

export const fractalNebulaScene: Scene<FractalNebulaState> = {
  id: "fractalNebula",

  init(_g) {
    return { particles: buildParticles() };
  },

  sample(_state, _t, _g) {},

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const minR = Math.min(g.W, g.H) * 0.42;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const N = state.particles.length;
    const scratch: number[] = [];
    for (const p of state.particles) {
      scratch.length = 0;
      crossings(p.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const spec = LAYERS[p.layer];
      const speedNorm = N > 1 ? p.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        p.lastFireT = tEv;
        const rotation = layerRotation(spec, tEv, D);
        const { x, y } = edgePos(spec, p.edge, 0, rotation, cx, cy, minR);
        events.push({
          slot: p.slot,
          freq: freqOf(p.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: p.hue,
          velocity: 0.5 + speedNorm * 0.4,
          pack: p.pack,
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const minR = Math.min(g.W, g.H) * 0.42;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const layerVerts: { x: number; y: number }[][] = LAYERS.map((spec) => {
      const r = minR * spec.radiusFrac;
      const rot = layerRotation(spec, t, D);
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i < spec.vertices; i++) {
        const a = vertexAngle(i, spec.vertices) + rot;
        out.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      return out;
    });

    ctx.lineWidth = 0.5;
    for (let L = 0; L < LAYERS.length; L++) {
      const spec = LAYERS[L];
      const verts = layerVerts[L];
      const hueDeg = (spec.hue * 360) % 360;
      ctx.strokeStyle = `oklch(0.82 0.10 ${hueDeg} / 0.26)`;
      ctx.beginPath();
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.strokeStyle = "oklch(0.78 0.06 220 / 0.08)";
    for (let L = 0; L < LAYERS.length - 1; L++) {
      const inner = layerVerts[L];
      const outer = layerVerts[L + 1];
      for (const iv of inner) {
        let bestA = 0, bestB = 0, dA = Infinity, dB = Infinity;
        for (let j = 0; j < outer.length; j++) {
          const dx = outer[j].x - iv.x;
          const dy = outer[j].y - iv.y;
          const d = dx * dx + dy * dy;
          if (d < dA) { dB = dA; bestB = bestA; dA = d; bestA = j; }
          else if (d < dB) { dB = d; bestB = j; }
        }
        for (const j of [bestA, bestB]) {
          ctx.beginPath();
          ctx.moveTo(iv.x, iv.y);
          ctx.lineTo(outer[j].x, outer[j].y);
          ctx.stroke();
        }
      }
    }

    for (const p of state.particles) {
      const u = particleURender(p.pi, t, B, D);
      const spec = LAYERS[p.layer];
      const rotation = layerRotation(spec, t, D);
      const { x, y } = edgePos(spec, p.edge, u, rotation, cx, cy, minR);
      const hueDeg = (p.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - p.lastFireT) * 2.8));
      const radius = 3 + flash * 4;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      grad.addColorStop(0, `oklch(0.85 0.18 ${hueDeg} / ${(0.45 + flash * 0.25).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.55 0.16 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "hard-light";
    for (const p of state.particles) {
      const u = particleURender(p.pi, t, B, D);
      const spec = LAYERS[p.layer];
      const rotation = layerRotation(spec, t, D);
      const { x, y } = edgePos(spec, p.edge, u, rotation, cx, cy, minR);
      const hueDeg = (p.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - p.lastFireT) * 2.8));
      const radius = 2.2 + flash * 2.4;
      ctx.fillStyle = `oklch(0.95 0.2 ${hueDeg} / ${(0.75 + flash * 0.2).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 12);
    ag.addColorStop(0, "oklch(0.95 0.08 240 / 0.7)");
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};