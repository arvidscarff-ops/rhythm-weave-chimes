/**
 * Scene F — Metatron Lattice (Phase-Alignment retrofit).
 *
 * 4 nested polygons (3-4-6-12 verts = 25 edges). One note per edge.
 * `u(t) = 0.5 - 0.5·cos(2π·progress)` — every note rests on vertex A
 * of its edge at every macro-cycle boundary (unison Big Bang chord).
 * Layer rotation uses integer laps per macro-cycle so vertices return
 * to their t=0 positions at wrap.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress, cycleFraction } from "@/lib/engine/phaseAlign";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];

type LayerSpec = {
  vertices: number;
  radiusFrac: number;
  pack: PackId;
  rotLapsPerCycle: number;
  pitchBase: number;
  hue: number;
};

const LAYERS: LayerSpec[] = [
  { vertices: 3,  radiusFrac: 0.16, pack: "moss",     rotLapsPerCycle: 4, pitchBase: +12, hue: 0.50 },
  { vertices: 4,  radiusFrac: 0.26, pack: "moss",     rotLapsPerCycle: 3, pitchBase:  +5, hue: 0.58 },
  { vertices: 6,  radiusFrac: 0.34, pack: "prism",    rotLapsPerCycle: 2, pitchBase:  -2, hue: 0.72 },
  { vertices: 12, radiusFrac: 0.42, pack: "obsidian", rotLapsPerCycle: 1, pitchBase: -12, hue: 0.86 },
];

type Note = {
  layer: number;
  edge: number;
  pi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  lastFireT: number;
};

export type MetatronLatticeState = {
  notes: Note[];
};

function buildNotes(): Note[] {
  const edgeSlots: { layer: number; edge: number }[] = [];
  for (let L = 0; L < LAYERS.length; L++) {
    for (let e = 0; e < LAYERS[L].vertices; e++) edgeSlots.push({ layer: L, edge: e });
  }
  const N = edgeSlots.length;
  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const { layer, edge } = edgeSlots[i];
    const spec = LAYERS[layer];
    // Inner layers first → higher pi (faster).
    const pi = N - 1 - i;
    notes[i] = {
      layer,
      edge,
      pi,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length] + spec.pitchBase,
      hue: (spec.hue + (edge / Math.max(1, spec.vertices)) * 0.05) % 1,
      pack: spec.pack,
      lastFireT: -Infinity,
    };
  }
  return notes;
}

function vertexAngle(i: number, V: number) {
  return (i / V) * Math.PI * 2 - Math.PI / 2;
}

function layerRotation(spec: LayerSpec, t: number, D: number) {
  return cycleFraction(t, D) * Math.PI * 2 * spec.rotLapsPerCycle;
}

function edgePos(
  layer: LayerSpec,
  edge: number,
  u: number,
  rotation: number,
  cx: number,
  cy: number,
  minR: number,
) {
  const V = layer.vertices;
  const r = minR * layer.radiusFrac;
  const aA = vertexAngle(edge, V) + rotation;
  const aB = vertexAngle((edge + 1) % V, V) + rotation;
  const Ax = cx + Math.cos(aA) * r;
  const Ay = cy + Math.sin(aA) * r;
  const Bx = cx + Math.cos(aB) * r;
  const By = cy + Math.sin(aB) * r;
  return { x: Ax + (Bx - Ax) * u, y: Ay + (By - Ay) * u };
}

function noteU(pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  return 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
}

export const metatronLatticeScene: Scene<MetatronLatticeState> = {
  id: "metatronLattice",

  init(_g) {
    return { notes: buildNotes() };
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
    const N = state.notes.length;
    const scratch: number[] = [];
    for (const n of state.notes) {
      scratch.length = 0;
      crossings(n.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const spec = LAYERS[n.layer];
      const speedNorm = N > 1 ? n.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        n.lastFireT = tEv;
        const rotation = layerRotation(spec, tEv, D);
        const { x, y } = edgePos(spec, n.edge, 0, rotation, cx, cy, minR);
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: n.hue,
          velocity: 0.55 + speedNorm * 0.4,
          pack: n.pack,
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
    ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
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
      ctx.strokeStyle = `oklch(0.82 0.10 ${hueDeg} / 0.28)`;
      ctx.beginPath();
      for (let i = 0; i < verts.length; i++) {
        const v = verts[i];
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.06 220 / 0.10)";
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

    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    ag.addColorStop(0, "oklch(0.95 0.08 240 / 0.7)");
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    for (const n of state.notes) {
      const u = noteU(n.pi, t, B, D);
      const spec = LAYERS[n.layer];
      const rotation = layerRotation(spec, t, D);
      const { x, y } = edgePos(spec, n.edge, u, rotation, cx, cy, minR);
      const hueDeg = (n.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - n.lastFireT) * 2.8));
      const radius = 4 + flash * 5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};