/**
 * Scene A — Geometric String Network.
 *
 * Physics:
 *   N anchor nodes orbit slow Lissajous paths. Strings are pairs of
 *   anchors. Particles travel along each string parameter t ∈ [0,1] at
 *   per-string speeds derived from harmonic ratios.
 *
 * Triggers:
 *   - Endpoint wrap: when a particle's t crosses 0 or 1, fire a voice.
 *   - Nexus: when two strings' nearest-approach distance dips under a
 *     threshold, fire a softer "atmo" voice once until they separate.
 *
 * Render:
 *   - Strings drawn with additive `screen` blend + 0.5px line weight, so
 *     overlapping strings glow naturally at their intersections.
 *   - Particles leave short Bezier-fade trails.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";

type Anchor = {
  /** Lissajous orbit center, in normalized [0..1] canvas coords. */
  cx: number;
  cy: number;
  /** Orbit radii (normalized). */
  ax: number;
  ay: number;
  /** Orbit angular freqs (rad/s) — kept low for slow drift. */
  wx: number;
  wy: number;
  /** Phase offsets. */
  px: number;
  py: number;
};

type Particle = {
  stringIdx: number;
  /**
   * Phase-Zero initial position along string at scene-time t = 0.
   * Live position is derived as `(t0 + rate * sceneT) mod 1`.
   */
  t0: number;
  /** Cycles per second along string (sign = direction). */
  rate: number;
  /** Voice slot to fire when particle wraps. */
  slot: VoiceSlotIndex;
  /** Pitch in semis relative to root A3. */
  pitchSemis: number;
  /** Hue 0..1. */
  hue: number;
};

type StringEdge = {
  a: number;
  b: number;
};

export type StringNetState = {
  anchors: Anchor[];
  strings: StringEdge[];
  particles: Particle[];
  /** Cached density to detect dock changes. */
  density: number;
  /**
   * Last scene-time at which each string-pair fired a nexus event.
   * Mutated only by `eventsIn` in strict t-order; replayed deterministically
   * for a given (state, t-history) trace. Not serialized — on hydrate the
   * map is empty and the next collision fires immediately, which matches
   * the "Big Bang" semantics on Phase-Zero reset.
   */
  lastNexusFireT: Map<string, number>;
  /** Per-particle ephemeral render scratch — populated by `sample`. */
  scratch: {
    anchors: { x: number; y: number }[];
    particles: { x: number; y: number; trail: { x: number; y: number }[] }[];
  };
};

const ROOT_HZ = 220; // A3
function freqOf(semis: number) {
  return ROOT_HZ * Math.pow(2, semis / 12);
}

function makeAnchors(n: number): Anchor[] {
  // Ring of n anchors around the canvas centroid, each on its own Lissajous.
  const out: Anchor[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    out.push({
      cx: 0.5 + Math.cos(a) * 0.22,
      cy: 0.5 + Math.sin(a) * 0.22,
      ax: 0.05,
      ay: 0.05,
      wx: 0.14 + (i % 3) * 0.05,
      wy: 0.19 + (i % 4) * 0.04,
      px: i * 1.1,
      py: i * 0.7 + 0.4,
    });
  }
  return out;
}

/** Map dock density (2..12) → anchor count (3..6). */
function anchorCount(density: number) {
  return Math.max(3, Math.min(6, Math.round(3 + (density - 2) * 0.3)));
}

function makeStrings(n: number): StringEdge[] {
  const out: StringEdge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      out.push({ a: i, b: j });
    }
  }
  return out;
}

function makeParticles(strings: StringEdge[]): Particle[] {
  // Two particles per string, opposing directions, harmonic rates.
  // Phase-Zero: every particle starts at t0 = 0 so they all hit the
  // "B" anchor as the universal Big Bang.
  const ratios = [0.18, 0.27, 0.36, 0.45]; // cycles/sec (slow)
  const slots: VoiceSlotIndex[] = [0, 1, 2, 3, 4, 5];
  const out: Particle[] = [];
  strings.forEach((_, idx) => {
    out.push({
      stringIdx: idx,
      t0: 0,
      rate: ratios[idx % ratios.length],
      slot: slots[(idx * 2) % slots.length],
      pitchSemis: [0, 5, 7, 10, 12, 17][idx % 6],
      hue: 0.52 + idx * 0.07,
    });
    out.push({
      stringIdx: idx,
      t0: 0,
      rate: -ratios[(idx + 1) % ratios.length],
      slot: slots[(idx * 2 + 1) % slots.length],
      pitchSemis: [-5, -3, 0, 3, 7, 12][idx % 6],
      hue: 0.86 - idx * 0.05,
    });
  });
  return out;
}

/** Pure: anchor pixel position at scene-time t. */
function anchorAt(a: Anchor, t: number, W: number, H: number) {
  const nx = a.cx + a.ax * Math.sin(a.wx * t + a.px);
  const ny = a.cy + a.ay * Math.cos(a.wy * t + a.py);
  return { x: nx * W, y: ny * H };
}

/** Pure: particle parameter position at scene-time t (in [0, 1)). */
function particleT(p: Particle, t: number) {
  const u = p.t0 + p.rate * t;
  return u - Math.floor(u);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** Squared distance from segment (p1→p2) to point q. */
function segDistSq(p1x: number, p1y: number, p2x: number, p2y: number, qx: number, qy: number) {
  const dx = p2x - p1x;
  const dy = p2y - p1y;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((qx - p1x) * dx + (qy - p1y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = p1x + dx * t;
  const cy = p1y + dy * t;
  return (qx - cx) * (qx - cx) + (qy - cy) * (qy - cy);
}

export const stringNetworkScene: Scene<StringNetState> = {
  id: "stringNet",

  init(_g) {
    const density = _g.density ?? 5;
    const anchors = makeAnchors(anchorCount(density));
    const strings = makeStrings(anchors.length);
    const particles = makeParticles(strings);
    return {
      anchors,
      strings,
      particles,
      density,
      lastNexusFireT: new Map(),
      scratch: {
        anchors: anchors.map(() => ({ x: 0, y: 0 })),
        particles: particles.map(() => ({ x: 0, y: 0, trail: [] })),
      },
    };
  },

  sample(state, t, g) {
    // Hot-reseed when dock density changes.
    const targetN = anchorCount(g.density);
    if (targetN !== state.anchors.length) {
      state.anchors = makeAnchors(targetN);
      state.strings = makeStrings(targetN);
      state.particles = makeParticles(state.strings);
      state.density = g.density;
      state.scratch.anchors = state.anchors.map(() => ({ x: 0, y: 0 }));
      state.scratch.particles = state.particles.map(() => ({ x: 0, y: 0, trail: [] }));
      state.lastNexusFireT.clear();
    }
    const { W, H } = g;
    // Anchors at time t.
    for (let i = 0; i < state.anchors.length; i++) {
      const p = anchorAt(state.anchors[i], t, W, H);
      state.scratch.anchors[i].x = p.x;
      state.scratch.anchors[i].y = p.y;
    }
    // Particles + derived trails (sample backward in time).
    const TRAIL_DUR = 0.6;
    const TRAIL_STEPS = 14;
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const s = state.strings[p.stringIdx];
      const A = state.scratch.anchors[s.a];
      const B = state.scratch.anchors[s.b];
      const u = particleT(p, t);
      const sc = state.scratch.particles[i];
      sc.x = lerp(A.x, B.x, u);
      sc.y = lerp(A.y, B.y, u);
      // Trail derived from the same pure function — no per-frame mutation.
      const trail = sc.trail;
      trail.length = 0;
      for (let k = TRAIL_STEPS - 1; k >= 0; k--) {
        const tk = t - (k / (TRAIL_STEPS - 1)) * TRAIL_DUR;
        const Ak = anchorAt(state.anchors[s.a], tk, W, H);
        const Bk = anchorAt(state.anchors[s.b], tk, W, H);
        const uk = particleT(p, tk);
        trail.push({ x: lerp(Ak.x, Bk.x, uk), y: lerp(Ak.y, Bk.y, uk) });
      }
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;

    // Particle endpoint-wrap triggers — analytical solve.
    // u(t) = t0p + rate * t  ; wraps each time u crosses an integer.
    // Count integers strictly inside (u(t0), u(t1)] for rate > 0, mirrored
    // for rate < 0.
    for (const p of state.particles) {
      const u0 = p.t0 + p.rate * t0;
      const u1 = p.t0 + p.rate * t1;
      if (p.rate === 0) continue;
      const lo = Math.min(u0, u1);
      const hi = Math.max(u0, u1);
      // Integers k with lo < k <= hi
      const firstK = Math.floor(lo) + 1;
      const lastK = Math.floor(hi);
      for (let k = firstK; k <= lastK; k++) {
        // Solve k = p.t0 + p.rate * tEv → tEv (kept for future per-event
        // scheduling; right now the scheduler schedules at horizon).
        // const tEv = (k - p.t0) / p.rate;
        const s = state.strings[p.stringIdx];
        const A = anchorAt(state.anchors[s.a], (k - p.t0) / p.rate, g.W, g.H);
        const B = anchorAt(state.anchors[s.b], (k - p.t0) / p.rate, g.W, g.H);
        // Wrap point is at u = integer → param 0 or 1 alternating.
        const u = k - Math.floor(k);
        const x = lerp(A.x, B.x, u);
        const y = lerp(A.y, B.y, u);
        events.push({
          slot: p.slot,
          freq: freqOf(p.pitchSemis + g.pitchSemis),
          x,
          y,
          hue: p.hue,
          velocity: 0.7,
        });
      }
    }

    // Nexus events — sampled predicate at window midpoint with a 0.8 s
    // per-pair cooldown. Deterministic because the scheduler advances
    // [t0, t1) windows strictly in scene-time order.
    const NEXUS_PX = 18;
    const NEXUS_COOL = 0.8;
    const tm = (t0 + t1) * 0.5;
    // Resolve anchors at midpoint once.
    const anc: { x: number; y: number }[] = state.anchors.map((a) =>
      anchorAt(a, tm, g.W, g.H),
    );
    for (let i = 0; i < state.strings.length; i++) {
      const si = state.strings[i];
      const Ai = anc[si.a];
      const Bi = anc[si.b];
      for (let j = i + 1; j < state.strings.length; j++) {
        const sj = state.strings[j];
        const key = `${i}_${j}`;
        const last = state.lastNexusFireT.get(key) ?? -Infinity;
        if (tm - last < NEXUS_COOL) continue;
        const Aj = anc[sj.a];
        const Bj = anc[sj.b];
        const d1 = segDistSq(Ai.x, Ai.y, Bi.x, Bi.y, Aj.x, Aj.y);
        const d2 = segDistSq(Ai.x, Ai.y, Bi.x, Bi.y, Bj.x, Bj.y);
        const dmin = Math.sqrt(Math.min(d1, d2));
        if (dmin < NEXUS_PX) {
          state.lastNexusFireT.set(key, tm);
          const mx = (Ai.x + Bi.x + Aj.x + Bj.x) * 0.25;
          const my = (Ai.y + Bi.y + Aj.y + Bj.y) * 0.25;
          events.push({
            slot: 5 as VoiceSlotIndex,
            freq: freqOf(-5 + g.pitchSemis),
            x: mx,
            y: my,
            hue: 0.12,
            velocity: 0.95,
          });
          break;
        }
      }
    }

    return events;
  },

  draw(state, ctx, _g) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    // Strings — 0.5px additive lines (compounding glow where they cross).
    ctx.lineWidth = 0.5;
    for (const s of state.strings) {
      const A = state.scratch.anchors[s.a];
      const B = state.scratch.anchors[s.b];
      // Three faintly offset passes so additive blend builds a halo.
      const passes = [
        { w: 0.5, a: 0.6, hue: 200 },
        { w: 1.2, a: 0.18, hue: 220 },
        { w: 3.0, a: 0.06, hue: 260 },
      ];
      for (const pass of passes) {
        ctx.lineWidth = pass.w;
        ctx.strokeStyle = `oklch(0.85 0.14 ${pass.hue} / ${pass.a.toFixed(2)})`;
        ctx.beginPath();
        ctx.moveTo(A.x, A.y);
        ctx.lineTo(B.x, B.y);
        ctx.stroke();
      }
    }

    // Anchor dots (soft).
    for (const a of state.scratch.anchors) {
      const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 22);
      grad.addColorStop(0, "oklch(0.95 0.12 195 / 0.65)");
      grad.addColorStop(1, "oklch(0.6 0.15 240 / 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles + trails.
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const sc = state.scratch.particles[i];
      const trail = sc.trail;
      if (trail.length < 2) continue;
      const hueDeg = (p.hue * 360) % 360;
      // Trail: fading polyline.
      for (let i = 1; i < trail.length; i++) {
        const a = i / trail.length;
        ctx.strokeStyle = `oklch(0.9 0.18 ${hueDeg} / ${(a * 0.5).toFixed(2)})`;
        ctx.lineWidth = 0.8 + a * 1.4;
        ctx.beginPath();
        ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
        ctx.lineTo(trail[i].x, trail[i].y);
        ctx.stroke();
      }
      // Head.
      const last = trail[trail.length - 1];
      const grad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 6);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / 0.9)`);
      grad.addColorStop(1, `oklch(0.7 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};