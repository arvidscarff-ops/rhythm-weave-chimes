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
  /** Cached resolved px-space position (computed each frame). */
  x: number;
  y: number;
};

type Particle = {
  stringIdx: number;
  /** Position along string, 0..1. */
  t: number;
  /** Cycles per second along string (sign = direction). */
  rate: number;
  /** Voice slot to fire when particle wraps. */
  slot: VoiceSlotIndex;
  /** Pitch in semis relative to root A3. */
  pitchSemis: number;
  /** Short trail of recent (x,y) for additive fade lines. */
  trail: { x: number; y: number }[];
  /** Hue 0..1. */
  hue: number;
};

type StringEdge = {
  a: number;
  b: number;
  /** Last computed nearest-distance to each other string (for nexus). */
  nexusCool: number; // seconds remaining before another nexus trigger
};

export type StringNetState = {
  anchors: Anchor[];
  strings: StringEdge[];
  particles: Particle[];
  /** Seconds since scene started, for orbit phase. */
  clock: number;
  /** Cached density to detect dock changes. */
  density: number;
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
      x: 0,
      y: 0,
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
      out.push({ a: i, b: j, nexusCool: 0 });
    }
  }
  return out;
}

function makeParticles(strings: StringEdge[]): Particle[] {
  // Two particles per string, opposing directions, harmonic rates.
  const ratios = [0.18, 0.27, 0.36, 0.45]; // cycles/sec (slow)
  const slots: VoiceSlotIndex[] = [0, 1, 2, 3, 4, 5];
  const out: Particle[] = [];
  strings.forEach((_, idx) => {
    out.push({
      stringIdx: idx,
      t: Math.random(),
      rate: ratios[idx % ratios.length],
      slot: slots[(idx * 2) % slots.length],
      pitchSemis: [0, 5, 7, 10, 12, 17][idx % 6],
      trail: [],
      hue: 0.52 + idx * 0.07,
    });
    out.push({
      stringIdx: idx,
      t: Math.random(),
      rate: -ratios[(idx + 1) % ratios.length],
      slot: slots[(idx * 2 + 1) % slots.length],
      pitchSemis: [-5, -3, 0, 3, 7, 12][idx % 6],
      trail: [],
      hue: 0.86 - idx * 0.05,
    });
  });
  return out;
}

/** Project normalized anchor coords into pixel space for the current frame. */
function projectAnchors(state: StringNetState, g: SceneGlobals) {
  const { W, H } = g;
  const t = state.clock;
  for (const a of state.anchors) {
    const nx = a.cx + a.ax * Math.sin(a.wx * t + a.px);
    const ny = a.cy + a.ay * Math.cos(a.wy * t + a.py);
    a.x = nx * W;
    a.y = ny * H;
  }
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
    return {
      anchors,
      strings,
      particles: makeParticles(strings),
      clock: 0,
      density,
    };
  },

  update(state, dt, g) {
    // Hot-reseed when dock density changes.
    const targetN = anchorCount(g.density);
    if (targetN !== state.anchors.length) {
      state.anchors = makeAnchors(targetN);
      state.strings = makeStrings(targetN);
      state.particles = makeParticles(state.strings);
      state.density = g.density;
    }
    state.clock += dt;
    projectAnchors(state, g);

    const events: TriggerEvent[] = [];
    const speed = g.speed;

    // Particle travel + endpoint-wrap triggers.
    for (const p of state.particles) {
      const prevT = p.t;
      p.t += p.rate * dt * speed;
      const wrapped =
        (prevT < 1 && p.t >= 1) ||
        (prevT > 0 && p.t <= 0) ||
        (prevT < 0 && p.t >= 0) ||
        (prevT > 1 && p.t <= 1);
      if (p.t > 1) p.t -= 1;
      if (p.t < 0) p.t += 1;

      // Project particle position for trail + event xy.
      const s = state.strings[p.stringIdx];
      const A = state.anchors[s.a];
      const B = state.anchors[s.b];
      const px = lerp(A.x, B.x, p.t);
      const py = lerp(A.y, B.y, p.t);
      p.trail.push({ x: px, y: py });
      if (p.trail.length > 14) p.trail.shift();

      if (wrapped) {
        events.push({
          slot: p.slot,
          freq: freqOf(p.pitchSemis + g.pitchSemis),
          x: px,
          y: py,
          hue: p.hue,
          velocity: 0.7,
        });
      }
    }

    // Nexus detection: any two strings whose nearest-approach < threshold
    // and not currently cooling down → fire a soft atmo event at the
    // midpoint of their closest approach.
    const NEXUS_PX = 18;
    for (let i = 0; i < state.strings.length; i++) {
      const si = state.strings[i];
      si.nexusCool = Math.max(0, si.nexusCool - dt);
      if (si.nexusCool > 0) continue;
      const Ai = state.anchors[si.a];
      const Bi = state.anchors[si.b];
      for (let j = i + 1; j < state.strings.length; j++) {
        const sj = state.strings[j];
        const Aj = state.anchors[sj.a];
        const Bj = state.anchors[sj.b];
        // Cheap proxy: distance from each endpoint of sj to segment si.
        const d1 = segDistSq(Ai.x, Ai.y, Bi.x, Bi.y, Aj.x, Aj.y);
        const d2 = segDistSq(Ai.x, Ai.y, Bi.x, Bi.y, Bj.x, Bj.y);
        const dmin = Math.sqrt(Math.min(d1, d2));
        if (dmin < NEXUS_PX) {
          si.nexusCool = 0.8;
          sj.nexusCool = 0.8;
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
      const A = state.anchors[s.a];
      const B = state.anchors[s.b];
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
    for (const a of state.anchors) {
      const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 22);
      grad.addColorStop(0, "oklch(0.95 0.12 195 / 0.65)");
      grad.addColorStop(1, "oklch(0.6 0.15 240 / 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Particles + trails.
    for (const p of state.particles) {
      const trail = p.trail;
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