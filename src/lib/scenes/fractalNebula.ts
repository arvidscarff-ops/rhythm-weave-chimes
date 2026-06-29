/**
 * Scene G — Fractal Nebula (50 particles across 5 nested polygons).
 *
 *   L=0 Triangle (3)   moss      inner / fastest
 *   L=1 Square   (4)   moss
 *   L=2 Hexagon  (6)   prism
 *   L=3 Octagon  (8)   prism
 *   L=4 Dodecagon(12)  obsidian  outer / slowest
 *
 * 10 particles per layer (50 total). Each particle rides one edge of
 * its layer's polygon, u ∈ [0,1], with period
 *
 *   T_i = basePeriod(bpm) / (φ^(-L) · noise_i),
 *   noise_i = speedCoeffs(10)[i % 10]  // prime/φ within-layer disambiguator
 *
 * so outer layers are slower (φ^(-L)) but every particle inside a layer
 * still has a unique prime-distributed coefficient — no rational-ratio
 * clumping. A build-time anti-clump pass nudges any pair within ±0.1 %.
 *
 * Density gate: per-event hash-mod gate keeps `1 / (L+1)` of crossings,
 * so the outer dodecagon plays ~20 % of its crossings and the triangle
 * plays 100 %. The gate is deterministic (no `Math.random`) so the
 * scheduler's "same args → same events" contract holds.
 *
 * Visual "meander": a sin(globalTime) wobble is added to the rendered
 * `u` only — audio cadence stays clean, particles still breathe.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { speedCoeffs, phaseOffsets, PHI } from "@/lib/engine/polyrhythm";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const COOLDOWN = 0.08;

type LayerSpec = {
  vertices: number;
  radiusFrac: number;
  pack: PackId;
  /** Layer rotation rate, in units of ω_base. */
  omegaMul: number;
  pitchBase: number;
  hue: number;
};

const LAYERS: LayerSpec[] = [
  { vertices: 3,  radiusFrac: 0.14, pack: "moss",     omegaMul: 1.000,                pitchBase: +14, hue: 0.50 },
  { vertices: 4,  radiusFrac: 0.22, pack: "moss",     omegaMul: 1 / PHI,              pitchBase:  +7, hue: 0.58 },
  { vertices: 6,  radiusFrac: 0.30, pack: "prism",    omegaMul: 1 / (PHI * PHI),      pitchBase:   0, hue: 0.68 },
  { vertices: 8,  radiusFrac: 0.36, pack: "prism",    omegaMul: 1 / (PHI ** 3),       pitchBase:  -7, hue: 0.78 },
  { vertices: 12, radiusFrac: 0.42, pack: "obsidian", omegaMul: 1 / (PHI ** 4),       pitchBase: -14, hue: 0.86 },
];

const PARTICLES_PER_LAYER = 10;

type Particle = {
  id: number;
  layer: number;
  /** Edge index within layer (0..V-1). */
  edge: number;
  period: number;
  phaseOffset: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  lastFireT: number;
  velocityBase: number;
  /** Monotonic counter of emitted crossings; used by the density gate. */
  crossingIdx: number;
};

export type FractalNebulaState = {
  particles: Particle[];
};

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 4.0;
}
function baseOmega(bpm: number) {
  return (Math.PI * 2) / (basePeriod(bpm) * 6);
}

/** Deterministic xorshift-style int hash → 32-bit unsigned int. */
function hashInt(a: number, b: number) {
  let x = (a * 374761393 + b * 668265263) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177) | 0;
  x = (x ^ (x >>> 16)) | 0;
  return x >>> 0;
}

/** Per-layer / per-crossing density gate. L=0 keeps all; outer layers thin. */
function densityGate(particleId: number, k: number, layer: number) {
  const denom = layer + 1; // L=0 → 1, L=4 → 5
  if (denom <= 1) return true;
  return hashInt(particleId, k) % denom === 0;
}

/**
 * Anti-clump: walk every (i, j) pair; if two particles share a near-
 * rational period (|T_i / T_j - 1| < 0.001) push j by a golden ±1 %.
 */
function antiClump(periods: number[]): number[] {
  const out = periods.slice();
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const r = out[i] / out[j];
      if (Math.abs(r - 1) < 0.001) {
        const sign = ((j * PHI) % 1) < 0.5 ? -1 : 1;
        out[j] *= 1 + sign * 0.01;
      }
    }
  }
  return out;
}

function buildParticles(bpm: number): Particle[] {
  const base = basePeriod(bpm);
  const total = LAYERS.length * PARTICLES_PER_LAYER;
  const offsets = phaseOffsets(total);
  const inLayerNoise = speedCoeffs(PARTICLES_PER_LAYER); // length 10

  // First pass: build periods (un-nudged).
  const rawPeriods: number[] = new Array(total);
  for (let L = 0; L < LAYERS.length; L++) {
    const layerSpeed = Math.pow(PHI, -L);
    for (let k = 0; k < PARTICLES_PER_LAYER; k++) {
      const i = L * PARTICLES_PER_LAYER + k;
      const noise = inLayerNoise[k % inLayerNoise.length];
      const V = layerSpeed * noise;
      rawPeriods[i] = base / Math.max(1e-6, V);
    }
  }
  const periods = antiClump(rawPeriods);

  const particles: Particle[] = new Array(total);
  for (let L = 0; L < LAYERS.length; L++) {
    const spec = LAYERS[L];
    for (let k = 0; k < PARTICLES_PER_LAYER; k++) {
      const i = L * PARTICLES_PER_LAYER + k;
      const edge = k % spec.vertices;
      // velocityBase: faster (smaller period) → louder.
      const layerSpeed = Math.pow(PHI, -L);
      const noise = inLayerNoise[k % inLayerNoise.length];
      const V = layerSpeed * noise;
      particles[i] = {
        id: i,
        layer: L,
        edge,
        period: periods[i],
        phaseOffset: offsets[i],
        slot: (i % 6) as VoiceSlotIndex,
        pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length] + spec.pitchBase,
        hue: (spec.hue + (k / PARTICLES_PER_LAYER) * 0.06) % 1,
        pack: spec.pack,
        lastFireT: -Infinity,
        velocityBase: 0.50 + Math.min(1, V) * 0.45,
        crossingIdx: 0,
      };
    }
  }
  return particles;
}

function vertexAngle(i: number, V: number) {
  return (i / V) * Math.PI * 2 - Math.PI / 2;
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

/** Pure u(t) — audio path. */
function particleU(period: number, phaseOffset: number, t: number) {
  if (t <= 0) return 0;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / period + phaseOffset));
}

/** Rendered u — adds the visual-only "meander" wobble. */
const WOBBLE_PERIOD_S = 3.7;
const WOBBLE_AMP = 0.04;
function particleURender(period: number, phaseOffset: number, t: number) {
  const u = particleU(period, phaseOffset, t);
  if (t <= 0) return u;
  const wob = Math.sin(2 * Math.PI * (t / WOBBLE_PERIOD_S + phaseOffset)) * WOBBLE_AMP;
  return Math.max(0, Math.min(1, u + wob));
}

export const fractalNebulaScene: Scene<FractalNebulaState> = {
  id: "fractalNebula",

  init(g) {
    return { particles: buildParticles(g.bpm) };
  },

  sample(_state, _t, _g) {
    // Fixed-density scene; nothing to hot-reseed here.
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const minR = Math.min(g.W, g.H) * 0.42;
    const omegaB = baseOmega(g.bpm);

    for (const p of state.particles) {
      const T = p.period;
      if (T <= 0) continue;
      // u(t) = 0.5 - 0.5·cos(2π·(t/T + φ))
      //   A (u=0) → t/T + φ = k        ⇒ t = (k - φ)·T
      //   B (u=1) → t/T + φ = k + 0.5  ⇒ t = (k + 0.5 - φ)·T
      const hits: { tEv: number; atA: boolean }[] = [];
      const collect = (offset: number, atA: boolean) => {
        const shift = (offset - p.phaseOffset) * T;
        const firstK = Math.ceil((t0 - shift) / T);
        const lastK = Math.floor((t1 - shift) / T);
        for (let k = firstK; k <= lastK; k++) {
          const tEv = k * T + shift;
          if (tEv >= t0 && tEv < t1) hits.push({ tEv, atA });
        }
      };
      collect(0, true);
      collect(0.5, false);
      hits.sort((a, b) => a.tEv - b.tEv);

      const spec = LAYERS[p.layer];
      for (const { tEv, atA } of hits) {
        const myK = p.crossingIdx++;
        if (tEv - p.lastFireT < COOLDOWN) continue;
        if (!densityGate(p.id, myK, p.layer)) continue;
        p.lastFireT = tEv;
        const rotation = omegaB * spec.omegaMul * tEv;
        const u = atA ? 0 : 1;
        const { x, y } = edgePos(spec, p.edge, u, rotation, cx, cy, minR);
        events.push({
          slot: p.slot,
          freq: freqOf(p.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: p.hue,
          velocity: p.velocityBase * (atA ? 1 : 0.85),
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
    const omegaB = baseOmega(g.bpm);

    // Heavier trail-wipe for 50-particle density.
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.18)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    // --- Lattice scaffolding on additive `screen` ---
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Compute all layer vertex positions once.
    const layerVerts: { x: number; y: number }[][] = LAYERS.map((spec) => {
      const r = minR * spec.radiusFrac;
      const rot = omegaB * spec.omegaMul * t;
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

    // Inter-layer connectors: each inner vertex → its 2 nearest outer.
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

    // Particle halos / trails on `screen`.
    for (const p of state.particles) {
      const u = particleURender(p.period, p.phaseOffset, t);
      const spec = LAYERS[p.layer];
      const rotation = omegaB * spec.omegaMul * t;
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

    // Particle heads on `hard-light` — punch above the additive halo.
    ctx.save();
    ctx.globalCompositeOperation = "hard-light";
    for (const p of state.particles) {
      const u = particleURender(p.period, p.phaseOffset, t);
      const spec = LAYERS[p.layer];
      const rotation = omegaB * spec.omegaMul * t;
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

    // Center anchor (above everything, neutral blend).
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