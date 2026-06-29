/**
 * Scene F — Metatron Lattice (fractal nested polygons, 25 notes).
 *
 * Four concentric regular polygons sit centered on the canvas:
 *
 *   layer 0 — Triangle   (3 verts, 3 edges)  inner   pack=moss
 *   layer 1 — Square     (4 verts, 4 edges)         pack=moss
 *   layer 2 — Hexagon    (6 verts, 6 edges)         pack=prism
 *   layer 3 — Dodecagon (12 verts,12 edges) outer   pack=obsidian
 *
 *   total edges = 3 + 4 + 6 + 12 = 25  →  one note per edge.
 *
 * Each note rides its edge segment from vertex A to vertex B and back
 * via a cosine of scene-time, with a prime/φ-distributed period (see
 * `polyrhythm.ts`) so no two notes share a rational cadence. At t = 0
 * every note rests on its A vertex — the play-time emergent chord
 * fires as one scheduler-tick coincidence.
 *
 * Layer rotation: each layer spins as a whole at ω_layer (inner fast,
 * outer slow) — purely visual; ignition timing is fixed in the edge's
 * local frame, so the layer rotation does not desync the polyrhythm.
 *
 * Each layer's events carry a `pack` override so the scheduler routes
 * inner layers to moss and the outer dodecagon to obsidian.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { speedCoeffs, phaseOffsets } from "@/lib/engine/polyrhythm";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const COOLDOWN = 0.10;

type LayerSpec = {
  vertices: number;
  /** Radius as a fraction of `min(W, H) * 0.42`. */
  radiusFrac: number;
  pack: PackId;
  /** Layer rotation rate, in units of ω_base (1 = inner, 0.25 = outer). */
  omegaMul: number;
  /** Pitch offset added to each note's scale degree on this layer. */
  pitchBase: number;
  /** Hue for the polygon outline + notes (0..1). */
  hue: number;
};

const LAYERS: LayerSpec[] = [
  { vertices: 3,  radiusFrac: 0.16, pack: "moss",     omegaMul: 1.00, pitchBase: +12, hue: 0.50 },
  { vertices: 4,  radiusFrac: 0.26, pack: "moss",     omegaMul: 0.66, pitchBase:  +5, hue: 0.58 },
  { vertices: 6,  radiusFrac: 0.34, pack: "prism",    omegaMul: 0.50, pitchBase:  -2, hue: 0.72 },
  { vertices: 12, radiusFrac: 0.42, pack: "obsidian", omegaMul: 0.25, pitchBase: -12, hue: 0.86 },
];

type Note = {
  /** Layer index 0..3. */
  layer: number;
  /** Edge index within this layer (0..vertices-1); A=vert[i], B=vert[(i+1)%V]. */
  edge: number;
  period: number;
  phaseOffset: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  lastFireT: number;
  velocityBase: number;
};

export type MetatronLatticeState = {
  notes: Note[];
};

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 4.0;
}

/** ω_base for layer rotation (rad/sec). One inner-layer revolution per ~6× basePeriod. */
function baseOmega(bpm: number) {
  return (Math.PI * 2) / (basePeriod(bpm) * 6);
}

/**
 * Anti-clump pass: prime/φ already disambiguates wrapping past the
 * 12-prime table, but at N=25 two distant coefficients can still land
 * inside ±0.1% of each other and re-cluster. Walk the list once and
 * push any near-rational neighbor off by a deterministic golden nudge.
 */
const PHI = (1 + Math.sqrt(5)) / 2;
function antiClump(coeffs: number[]): number[] {
  const out = coeffs.slice();
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const ratio = out[i] / out[j];
      if (Math.abs(ratio - 1) < 0.001) {
        const nudge = ((j * PHI) % 1 - 0.5) * 0.04;
        out[j] = Math.max(0.05, Math.min(1, out[j] * (1 + nudge)));
      }
    }
  }
  return out;
}

function buildNotes(bpm: number): Note[] {
  // 25 edges total. Order: inner → outer so fastest coefficients
  // (already prime-distributed, sorted desc) land on the inner layers.
  const edgeSlots: { layer: number; edge: number }[] = [];
  for (let L = 0; L < LAYERS.length; L++) {
    for (let e = 0; e < LAYERS[L].vertices; e++) edgeSlots.push({ layer: L, edge: e });
  }
  const N = edgeSlots.length; // 25
  const coeffsRaw = speedCoeffs(N).slice().sort((a, b) => b - a);
  const coeffs = antiClump(coeffsRaw);
  const offsets = phaseOffsets(N);
  const base = basePeriod(bpm);

  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const { layer, edge } = edgeSlots[i];
    const spec = LAYERS[layer];
    const c = coeffs[i];
    notes[i] = {
      layer,
      edge,
      period: base / Math.max(1e-6, c),
      phaseOffset: offsets[i],
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length] + spec.pitchBase,
      hue: (spec.hue + (edge / Math.max(1, spec.vertices)) * 0.05) % 1,
      pack: spec.pack,
      lastFireT: -Infinity,
      velocityBase: 0.55 + c * 0.4,
    };
  }
  return notes;
}

/**
 * Polygon vertex i (local frame, before layer rotation), in radians.
 * Vertex 0 sits at the top (-π/2) for visual consistency with mandala.
 */
function vertexAngle(i: number, V: number) {
  return (i / V) * Math.PI * 2 - Math.PI / 2;
}

/** Position along edge at param u ∈ [0,1], in pixel space. */
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

function noteU(period: number, phaseOffset: number, t: number) {
  if (t <= 0) return 0;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / period + phaseOffset));
}

export const metatronLatticeScene: Scene<MetatronLatticeState> = {
  id: "metatronLattice",

  init(g) {
    return { notes: buildNotes(g.bpm) };
  },

  sample(_state, _t, _g) {
    // Fixed-density scene — nothing to hot-reseed here.
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const minR = Math.min(g.W, g.H) * 0.42;
    const omegaB = baseOmega(g.bpm);

    for (const n of state.notes) {
      const T = n.period;
      if (T <= 0) continue;
      // u(t) = 0.5 - 0.5·cos(2π·(t/T + φ))
      //   A-vertex  (u=0) → t/T + φ = k        ⇒ t = (k - φ)·T
      //   B-vertex  (u=1) → t/T + φ = k + 0.5  ⇒ t = (k + 0.5 - φ)·T
      const hits: { tEv: number; atA: boolean }[] = [];
      const collect = (offset: number, atA: boolean) => {
        const shift = (offset - n.phaseOffset) * T;
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

      const spec = LAYERS[n.layer];
      for (const { tEv, atA } of hits) {
        if (tEv - n.lastFireT < COOLDOWN) continue;
        n.lastFireT = tEv;
        const rotation = omegaB * spec.omegaMul * tEv;
        const u = atA ? 0 : 1;
        const { x, y } = edgePos(spec, n.edge, u, rotation, cx, cy, minR);
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: n.hue,
          velocity: n.velocityBase * (atA ? 1 : 0.85),
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
    const omegaB = baseOmega(g.bpm);

    // Tighter trail-fill than mandala — 25 notes need a heavier wipe.
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.15)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // --- Lattice scaffolding: spokes from center through every vertex,
    //     plus inter-layer connectors from each inner vertex to its two
    //     nearest outer-layer vertices (rotated per layer). Purely
    //     decorative; the audio is bound to polygon edges only.
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

    // Polygon outlines.
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

    // Inter-layer connectors: each inner vertex → its 2 nearest outer.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.06 220 / 0.10)";
    for (let L = 0; L < LAYERS.length - 1; L++) {
      const inner = layerVerts[L];
      const outer = layerVerts[L + 1];
      for (const iv of inner) {
        // Find two nearest outer vertices by squared distance.
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

    // Center anchor.
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 14);
    ag.addColorStop(0, "oklch(0.95 0.08 240 / 0.7)");
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();

    // Notes (orbs on their edges).
    for (const n of state.notes) {
      const u = noteU(n.period, n.phaseOffset, t);
      const spec = LAYERS[n.layer];
      const rotation = omegaB * spec.omegaMul * t;
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