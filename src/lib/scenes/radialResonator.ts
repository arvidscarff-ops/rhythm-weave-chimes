/**
 * Scene H — Radial Resonator (elastic radial bounce, center-ignition).
 *
 * Distinct from the Metatron Lattice and the Fractal Nebula: notes do
 * not traverse polygon edges or nested vertices. Instead each note
 * `i` is bound to a fixed radial ray at angle θ_i = (i/N)·2π emitted
 * from the canvas center. Its radial distance over scene-time follows
 * a rectified-sine bounce
 *
 *   r_i(t) = | sin(ω_i · t + φ_i) | · R_max
 *
 * so every note starts at r=0 at t=0 (Big Bang chord) and the center
 * (r ≈ 0) is the sole ignition point. Per-note ω_i is prime/φ-spread
 * via `speedCoeffs(N)` (same anti-clump table used by Metatron and
 * Fractal Nebula) so no two rays share a rational period.
 *
 * Center-crossings occur when ω·t + φ = k·π → t_k = (k·π − φ)/ω.
 * `eventsIn` enumerates the k whose t_k falls in [t0, t1) for each
 * ray. A stochastic-stagger pass nudges ω on trailing notes by ±1 %
 * when ≥3 events would land inside the same 20 ms tick, so the
 * "everyone hits the center together" thud becomes a fast cascade.
 *
 * Visual: the ray itself is not drawn; the long-tail trail buffer
 * (translucent dark wipe each frame + `screen` blending) accumulates
 * the head's path into a "flower" of fading spokes. The central
 * ignition disk pulses brighter when `min_i r_i` is near zero.
 *
 * Boundaries: this module does NOT import from `metatronLattice.ts`
 * or `fractalNebula.ts`, and contains no lattice/vertex helpers.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { speedCoeffs, phaseOffsets, PHI } from "@/lib/engine/polyrhythm";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];

/** Notes whose t_k differ by less than this collapse → stagger. */
const CLUMP_WINDOW_S = 0.020;
const CLUMP_THRESHOLD = 3;
/** Per-note refractory window for the center ignition. */
const COOLDOWN = 0.08;

const NOTE_COUNT = 24;

type Note = {
  id: number;
  /** Radial angle in radians (fixed). */
  theta: number;
  /** Angular speed for the rectified-sine bounce, rad/sec. Mutable
   *  because the stagger pass may perturb it. */
  omega: number;
  /** Phase offset φ_i (radians). */
  phi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  /** Previous-frame radial distance — used for trail stroke. */
  prevR: number;
  lastFireT: number;
  velocityBase: number;
};

export type RadialResonatorState = {
  notes: Note[];
  /** Persistent monotonic counter — used by the stagger hash. */
  staggerSeed: number;
};

function basePeriod(bpm: number) {
  return (60 / Math.max(20, bpm)) * 4.0;
}

/** ω_base for the slowest ray (the longest bounce). */
function baseOmega(bpm: number) {
  // One full center-to-Rmax-to-center round trip per basePeriod for
  // the slowest note (c_min ≈ 0.18 from the prime table). The factor
  // π (not 2π) because the rectified sine cycles every π.
  return Math.PI / basePeriod(bpm);
}

function buildNotes(bpm: number): Note[] {
  const N = NOTE_COUNT;
  const coeffsRaw = speedCoeffs(N).slice().sort((a, b) => b - a);
  const offsets = phaseOffsets(N);
  const omegaB = baseOmega(bpm);

  // Pack rotation across moss/prism/obsidian by index group so each
  // ring of rays sonifies through a different pack.
  const packs: PackId[] = ["moss", "prism", "obsidian"];

  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    const c = coeffsRaw[i];
    notes[i] = {
      id: i,
      theta: (i / N) * Math.PI * 2,
      omega: omegaB * (0.5 + c * 1.5), // map (0,1] → [0.5, 2.0]·ω_base
      phi: offsets[i] * Math.PI * 2,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: (i / N + 0.05) % 1,
      pack: packs[i % packs.length],
      prevR: 0,
      lastFireT: -Infinity,
      velocityBase: 0.55 + c * 0.4,
    };
  }
  return notes;
}

/** Rectified-sine radial position, normalized to [0,1]. */
function radialNorm(note: Note, t: number) {
  if (t <= 0) return 0;
  return Math.abs(Math.sin(note.omega * t + note.phi));
}

/** Deterministic hash → small signed perturbation in [-1, +1]. */
function hashSigned(a: number, b: number) {
  let x = (a * 374761393 + b * 668265263) | 0;
  x = (x ^ (x >>> 13)) | 0;
  x = Math.imul(x, 1274126177) | 0;
  x = (x ^ (x >>> 16)) | 0;
  return ((x >>> 0) / 0xffffffff) * 2 - 1;
}

export const radialResonatorScene: Scene<RadialResonatorState> = {
  id: "radialResonator",

  init(g) {
    return { notes: buildNotes(g.bpm), staggerSeed: 0 };
  },

  sample(_state, _t, _g) {
    // Fixed-density scene; nothing to hot-reseed.
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;

    // Collect candidate center-crossings: t_k = (k·π − φ) / ω.
    type Hit = { tEv: number; note: Note; k: number };
    const hits: Hit[] = [];
    for (const n of state.notes) {
      if (n.omega <= 0) continue;
      const firstK = Math.ceil((t0 * n.omega + n.phi) / Math.PI);
      const lastK = Math.floor((t1 * n.omega + n.phi) / Math.PI);
      for (let k = firstK; k <= lastK; k++) {
        const tEv = (k * Math.PI - n.phi) / n.omega;
        if (tEv >= t0 && tEv < t1) hits.push({ tEv, note: n, k });
      }
    }
    hits.sort((a, b) => a.tEv - b.tEv);

    // Stochastic stagger: ≥CLUMP_THRESHOLD events inside 20 ms → push
    // trailing notes' ω by ±1 % (deterministic).
    for (let i = 0; i < hits.length; i++) {
      let j = i;
      while (j < hits.length && hits[j].tEv - hits[i].tEv < CLUMP_WINDOW_S) j++;
      const cluster = j - i;
      if (cluster >= CLUMP_THRESHOLD) {
        // i is the head; nudge every trailing note in the cluster.
        for (let m = i + 1; m < j; m++) {
          const n = hits[m].note;
          const sign = hashSigned(n.id, state.staggerSeed) >= 0 ? 1 : -1;
          n.omega *= 1 + sign * 0.01;
          // Recompute this single hit's tEv from the new ω so the
          // event order within the window cascades cleanly.
          hits[m].tEv = (hits[m].k * Math.PI - n.phi) / n.omega;
        }
        state.staggerSeed = (state.staggerSeed + 1) | 0;
        i = j - 1; // skip past the cluster
      }
    }
    hits.sort((a, b) => a.tEv - b.tEv);

    for (const { tEv, note: n } of hits) {
      if (tEv < t0 || tEv >= t1) continue;
      if (tEv - n.lastFireT < COOLDOWN) continue;
      n.lastFireT = tEv;
      events.push({
        slot: n.slot,
        freq: freqOf(n.pitchSemis + g.pitchSemis),
        x: cx,
        y: cy,
        hue: n.hue,
        velocity: n.velocityBase,
        pack: n.pack,
      });
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const Rmax = Math.min(g.W, g.H) * 0.42;
    const t = g.globalTime;

    // Trail buffer: translucent dark wipe so trails fade organically.
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Static radial scaffolding: one faint spoke per note from center
    // to Rmax, mirroring the polygon-outline scaffolding in the
    // Metatron Lattice / Fractal Nebula scenes.
    ctx.lineWidth = 0.5;
    for (const n of state.notes) {
      const cosT = Math.cos(n.theta);
      const sinT = Math.sin(n.theta);
      const hueDeg = (n.hue * 360) % 360;
      ctx.strokeStyle = `oklch(0.78 0.08 ${hueDeg} / 0.22)`;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + cosT * Rmax, cy + sinT * Rmax);
      ctx.stroke();
    }

    // Outer ring (Rmax boundary) — soft cyan, matches lattice palette.
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.06 220 / 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, Rmax, 0, Math.PI * 2);
    ctx.stroke();

    // Stroke a short ray-aligned segment from prev-r to current-r
    // for each note — accumulates into a fading spoke pattern.
    let minR = 1;
    for (const n of state.notes) {
      const rN = radialNorm(n, t);
      const r = rN * Rmax;
      const rPrev = n.prevR;
      n.prevR = r;
      if (rN < minR) minR = rN;

      const cosT = Math.cos(n.theta);
      const sinT = Math.sin(n.theta);
      const x1 = cx + cosT * rPrev;
      const y1 = cy + sinT * rPrev;
      const x2 = cx + cosT * r;
      const y2 = cy + sinT * r;
      const hueDeg = (n.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - n.lastFireT) * 2.4));

      // Trail segment.
      ctx.lineWidth = 0.9 + flash * 0.8;
      ctx.strokeStyle = `oklch(0.82 0.16 ${hueDeg} / ${(0.32 + flash * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Head halo.
      const radius = 3 + flash * 4;
      const grad = ctx.createRadialGradient(x2, y2, 0, x2, y2, radius * 3);
      grad.addColorStop(0, `oklch(0.92 0.2 ${hueDeg} / ${(0.7 + flash * 0.25).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.16 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x2, y2, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ignition circle: brighter when any note is near the center.
    const ignition = Math.pow(1 - Math.min(1, minR * 6), 2); // 0..1
    const ignR = 14 + ignition * 10;
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, ignR);
    ag.addColorStop(0, `oklch(0.96 0.10 240 / ${(0.55 + ignition * 0.4).toFixed(3)})`);
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, ignR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Reference: silence unused PHI import warning if tree-shaken.
    void PHI;
  },
};
