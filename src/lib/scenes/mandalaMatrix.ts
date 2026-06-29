/**
 * Scene E — Mandala Matrix (Sacred Geometry).
 *
 * A 6-point hexagram skeleton (two overlapping triangles + 6 center spokes).
 * Notes ride the 6 spokes outward from the absolute center. Position along
 * a spoke is a pure cosine of scene-time scaled by a Fibonacci ratio:
 *
 *   u_i(t) = 0.5 - 0.5 * cos(2π · t / T_i)        (range [0, 1])
 *   T_i    = basePeriod(bpm) · ratio_i             (ratio_i ∈ {2,3,5,8,13})
 *
 * At t = 0 → u_i = 0 for every note → every note sits at the center origin
 * → universal Big Bang chord.
 *
 * Triggers fire when u crosses 0 (center, low octave) or 1 (outer vertex,
 * high octave). Crossings are enumerated analytically inside `eventsIn`
 * from the cosine roots.
 *
 * The scene owns its own slow alpha-decay trail fill — the only place a
 * scene is allowed to paint a full-canvas rectangle, and only at ~8 %
 * opacity per frame. The note trails additively "paint out" the glowing
 * lines of the hexagram matrix.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { speedCoeffs, phaseOffsets } from "@/lib/engine/polyrhythm";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const COOLDOWN = 0.12;
const NUM_SPOKES = 6;

type Note = {
  /** Spoke index 0..5 → angle = i · (2π / 6). */
  spoke: number;
  /** Period of the cosine sweep (scene seconds). Derived from the
   *  shared prime/φ velocity distribution. */
  period: number;
  /** Golden-ratio phase offset in [0, 1) (cosine cycles). */
  phaseOffset: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  /** Scene-time of most recent trigger (refractory + draw flash). */
  lastFireT: number;
  /** Cached velocity base (faster note = louder). */
  velocityBase: number;
};

export type MandalaMatrixState = {
  notes: Note[];
  /** Cached density so we can hot-reseed on dock changes. */
  density: number;
};

/** Map dock density (2..12) → note count (6..30), multiples of 6 for symmetry. */
function noteCount(density: number) {
  const raw = Math.round(6 + (density - 2) * 2.4);
  const snapped = Math.max(6, Math.min(30, Math.round(raw / 6) * 6));
  return snapped;
}

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 4.0;
}

function buildNotes(density: number, bpm: number): Note[] {
  const N = noteCount(density);
  const base = basePeriod(bpm);
  // Prime/φ-distributed coefficients ∈ (0, 1]. Period_i = base / coeff_i
  // so higher coeff = faster note. Coefficients are irrational-ish, so no
  // two notes share a rational period → polyrhythmic meander.
  const coeffs = speedCoeffs(N);
  const offsets = phaseOffsets(N);
  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = coeffs[i];
    const T = base / Math.max(1e-6, c);
    notes[i] = {
      spoke: i % NUM_SPOKES,
      period: T,
      phaseOffset: offsets[i],
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: (i / N + 0.55) % 1,
      lastFireT: -Infinity,
      // Faster coefficient → louder.
      velocityBase: 0.55 + c * 0.4,
    };
  }
  return notes;
}

/**
 * u(t) with a prime/φ phase offset folded into the cosine argument.
 * At t ≤ 0 we clamp u = 0 for every note so the universal Big Bang
 * chord still ignites from the absolute center, regardless of offset.
 */
function spokeU(period: number, phaseOffset: number, t: number) {
  if (t <= 0) return 0;
  return 0.5 - 0.5 * Math.cos(2 * Math.PI * (t / period + phaseOffset));
}

export const mandalaMatrixScene: Scene<MandalaMatrixState> = {
  id: "mandalaMatrix",

  init(g) {
    return {
      notes: buildNotes(g.density ?? 5, g.bpm),
      density: g.density ?? 5,
    };
  },

  sample(state, _t, g) {
    const want = noteCount(g.density);
    if (want !== state.notes.length || state.density !== g.density) {
      state.notes = buildNotes(g.density, g.bpm);
      state.density = g.density;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const want = noteCount(g.density);
    if (want !== state.notes.length || state.density !== g.density) {
      state.notes = buildNotes(g.density, g.bpm);
      state.density = g.density;
    }
    const cx = g.W / 2;
    const cy = g.H / 2;
    const R = Math.min(g.W, g.H) * 0.36;

    for (const n of state.notes) {
      const T = n.period;
      if (T <= 0) continue;
      // u(t) = 0.5 - 0.5·cos(2π·(t/T + φ))
      //   center  (u=0) → t/T + φ = k        ⇒ t = (k - φ)·T
      //   vertex  (u=1) → t/T + φ = k + 0.5  ⇒ t = (k + 0.5 - φ)·T
      // Enumerate both anchor families inside [t0, t1). The t=0 Big Bang
      // is preserved by always injecting tEv = 0 when it falls in the
      // window — `spokeU` clamps to 0 there irrespective of φ.
      const hits: { tEv: number; outer: boolean }[] = [];
      const collect = (offset: number, outer: boolean) => {
        // Solve k·T + (offset - φ)·T ∈ [t0, t1).
        const shift = (offset - n.phaseOffset) * T;
        const firstK = Math.ceil((t0 - shift) / T);
        const lastK = Math.floor((t1 - shift) / T);
        for (let k = firstK; k <= lastK; k++) {
          const tEv = k * T + shift;
          if (tEv >= t0 && tEv < t1) hits.push({ tEv, outer });
        }
      };
      collect(0, false); // center crossings
      collect(0.5, true); // outer-vertex crossings
      // Big Bang anchor: every note fires from the center at t=0.
      if (t0 <= 0 && 0 < t1) hits.push({ tEv: 0, outer: false });
      hits.sort((a, b) => a.tEv - b.tEv);

      for (const { tEv, outer } of hits) {
        if (tEv - n.lastFireT < COOLDOWN) continue;
        n.lastFireT = tEv;
        const angle = (n.spoke / NUM_SPOKES) * Math.PI * 2 - Math.PI / 2;
        const r = outer ? R : 0;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        // Center = low octave (-12), outer = high octave (+12).
        const octave = outer ? 12 : -12;
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis + octave + g.pitchSemis),
          x,
          y,
          hue: n.hue,
          velocity: n.velocityBase * (outer ? 1 : 0.85),
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const R = Math.min(g.W, g.H) * 0.36;
    const t = g.globalTime;

    // Slow alpha-decay trail fill — the Mandala's signature look.
    // Only place a scene paints a full-canvas rect, at ~8% opacity.
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Hexagram skeleton — 6 outer vertices.
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < NUM_SPOKES; i++) {
      const a = (i / NUM_SPOKES) * Math.PI * 2 - Math.PI / 2;
      verts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
    }

    // Spokes (center ↔ vertex).
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.82 0.10 250 / 0.22)";
    for (const v of verts) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }

    // Two overlapping triangles (the Star of David).
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.85 0.12 195 / 0.20)";
    const drawTri = (a: number, b: number, c: number) => {
      ctx.beginPath();
      ctx.moveTo(verts[a].x, verts[a].y);
      ctx.lineTo(verts[b].x, verts[b].y);
      ctx.lineTo(verts[c].x, verts[c].y);
      ctx.closePath();
      ctx.stroke();
    };
    drawTri(0, 2, 4);
    drawTri(1, 3, 5);

    // Soft outer circle.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.05 220 / 0.10)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Notes — orbs on their spokes.
    for (const n of state.notes) {
      const u = spokeU(n.period, n.phaseOffset, t);
      const angle = (n.spoke / NUM_SPOKES) * Math.PI * 2 - Math.PI / 2;
      const r = R * u;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      const hueDeg = (n.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - n.lastFireT) * 2.8));
      const radius = 5 + flash * 6;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 3);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Center dot — soft anchor.
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
    ag.addColorStop(0, "oklch(0.95 0.08 240 / 0.7)");
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};