/**
 * Scene A — Geometric String Network (Phase-Alignment retrofit).
 *
 * Anchors orbit slow Lissajous paths. Strings connect anchor pairs.
 * Particles sweep along each string with per-voice cadence dictated by
 * `phaseAlign.progress(t, i, B, D)` — voice `i` completes `B + i` full
 * traversals per macro-cycle, so every particle passes its anchor at
 * `t = k · D` in unison.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

type Anchor = {
  cx: number;
  cy: number;
  ax: number;
  ay: number;
  wx: number;
  wy: number;
  px: number;
  py: number;
};

type Particle = {
  stringIdx: number;
  /** Phase-Alignment voice index (0 = slowest, N-1 = fastest). */
  pi: number;
  /** +1 A→B or -1 B→A. */
  dir: 1 | -1;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  /** Last trigger scene-time; purely for visual flash. */
  lastFireT: number;
};

type StringEdge = { a: number; b: number };

export type StringNetState = {
  anchors: Anchor[];
  strings: StringEdge[];
  particles: Particle[];
  density: number;
  /** Nexus fires kept for visual variety; not part of Phase-Alignment. */
  lastNexusFireT: Map<string, number>;
  scratch: {
    anchors: { x: number; y: number }[];
    particles: { x: number; y: number; trail: { x: number; y: number }[] }[];
  };
};

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);

function makeAnchors(n: number): Anchor[] {
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

function anchorCount(density: number) {
  return Math.max(3, Math.min(6, Math.round(3 + (density - 2) * 0.3)));
}

function makeStrings(n: number): StringEdge[] {
  const out: StringEdge[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) out.push({ a: i, b: j });
  return out;
}

function makeParticles(strings: StringEdge[]): Particle[] {
  const slots: VoiceSlotIndex[] = [0, 1, 2, 3, 4, 5];
  const out: Particle[] = [];
  strings.forEach((_, idx) => {
    out.push({
      stringIdx: idx,
      pi: 0,
      dir: 1,
      slot: slots[(idx * 2) % slots.length],
      pitchSemis: [0, 5, 7, 10, 12, 17][idx % 6],
      hue: 0.52 + idx * 0.07,
      lastFireT: -Infinity,
    });
    out.push({
      stringIdx: idx,
      pi: 0,
      dir: -1,
      slot: slots[(idx * 2 + 1) % slots.length],
      pitchSemis: [-5, -3, 0, 3, 7, 12][idx % 6],
      hue: 0.86 - idx * 0.05,
      lastFireT: -Infinity,
    });
  });
  return out;
}

function bindParticlesLeftToRight(
  particles: Particle[],
  strings: StringEdge[],
  anchors: Anchor[],
  W: number,
  H: number,
): void {
  const midX = strings.map((s) => {
    const A = anchorAt(anchors[s.a], 0, W, H);
    const B = anchorAt(anchors[s.b], 0, W, H);
    return (A.x + B.x) * 0.5;
  });
  const stringOrder = strings.map((_, i) => i).sort((a, b) => midX[a] - midX[b]);
  const N = particles.length;
  for (let k = 0; k < N; k++) {
    const sIdx = stringOrder[Math.floor(k / 2) % stringOrder.length];
    particles[k].stringIdx = sIdx;
    // Highest pi (fastest) → leftmost string.
    particles[k].pi = N - 1 - k;
  }
}

function anchorAt(a: Anchor, t: number, W: number, H: number) {
  const nx = a.cx + a.ax * Math.sin(a.wx * t + a.px);
  const ny = a.cy + a.ay * Math.cos(a.wy * t + a.py);
  return { x: nx * W, y: ny * H };
}

function particleU(p: Particle, t: number, B: number, D: number) {
  const u = progress(t, p.pi, B, D);
  return p.dir === 1 ? u : 1 - u;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

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
    bindParticlesLeftToRight(particles, strings, anchors, _g.W, _g.H);
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
    const targetN = anchorCount(g.density);
    if (targetN !== state.anchors.length) {
      state.anchors = makeAnchors(targetN);
      state.strings = makeStrings(targetN);
      state.particles = makeParticles(state.strings);
      bindParticlesLeftToRight(state.particles, state.strings, state.anchors, g.W, g.H);
      state.density = g.density;
      state.scratch.anchors = state.anchors.map(() => ({ x: 0, y: 0 }));
      state.scratch.particles = state.particles.map(() => ({ x: 0, y: 0, trail: [] }));
      state.lastNexusFireT.clear();
    }
    const { W, H, baseLaps: B, macroCycleSeconds: D } = g;
    for (let i = 0; i < state.anchors.length; i++) {
      const p = anchorAt(state.anchors[i], t, W, H);
      state.scratch.anchors[i].x = p.x;
      state.scratch.anchors[i].y = p.y;
    }
    const TRAIL_DUR = 0.6;
    const TRAIL_STEPS = 14;
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const s = state.strings[p.stringIdx];
      const A = state.scratch.anchors[s.a];
      const B_ = state.scratch.anchors[s.b];
      const u = particleU(p, t, B, D);
      const sc = state.scratch.particles[i];
      sc.x = lerp(A.x, B_.x, u);
      sc.y = lerp(A.y, B_.y, u);
      const trail = sc.trail;
      trail.length = 0;
      for (let k = TRAIL_STEPS - 1; k >= 0; k--) {
        const tk = t - (k / (TRAIL_STEPS - 1)) * TRAIL_DUR;
        const Ak = anchorAt(state.anchors[s.a], tk, W, H);
        const Bk = anchorAt(state.anchors[s.b], tk, W, H);
        const uk = particleU(p, tk, B, D);
        trail.push({ x: lerp(Ak.x, Bk.x, uk), y: lerp(Ak.y, Bk.y, uk) });
      }
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const N = state.particles.length;
    const scratch: number[] = [];
    for (const p of state.particles) {
      scratch.length = 0;
      crossings(p.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const s = state.strings[p.stringIdx];
      for (const tEv of scratch) {
        p.lastFireT = tEv;
        // Wraps land at u = 0 → position at anchor A (dir=1) or B (dir=-1).
        const anchor = p.dir === 1 ? state.anchors[s.a] : state.anchors[s.b];
        const pt = anchorAt(anchor, tEv, g.W, g.H);
        const speedNorm = N > 1 ? p.pi / (N - 1) : 1;
        events.push({
          slot: p.slot,
          freq: freqOf(p.pitchSemis + g.pitchSemis),
          x: pt.x,
          y: pt.y,
          hue: p.hue,
          velocity: 0.45 + speedNorm * 0.5,
        });
      }
    }

    // Nexus events — visual bonus, cadence NOT part of Phase-Alignment.
    const NEXUS_PX = 18;
    const NEXUS_COOL = 0.8;
    const tm = (t0 + t1) * 0.5;
    const anc = state.anchors.map((a) => anchorAt(a, tm, g.W, g.H));
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

  draw(state, ctx, g) {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.lineWidth = 0.5;
    for (const s of state.strings) {
      const A = state.scratch.anchors[s.a];
      const B = state.scratch.anchors[s.b];
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

    for (const a of state.scratch.anchors) {
      const grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, 22);
      grad.addColorStop(0, "oklch(0.95 0.12 195 / 0.65)");
      grad.addColorStop(1, "oklch(0.6 0.15 240 / 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(a.x, a.y, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      const sc = state.scratch.particles[i];
      const trail = sc.trail;
      if (trail.length < 2) continue;
      const hueDeg = (p.hue * 360) % 360;
      const flash = Math.max(0, Math.min(1, Math.exp(-(g.globalTime - p.lastFireT) * 3.0)));
      for (let k = 1; k < trail.length; k++) {
        const a = k / trail.length;
        ctx.strokeStyle = `oklch(0.9 0.18 ${hueDeg} / ${(a * 0.5).toFixed(2)})`;
        ctx.lineWidth = 0.8 + a * 1.4;
        ctx.beginPath();
        ctx.moveTo(trail[k - 1].x, trail[k - 1].y);
        ctx.lineTo(trail[k].x, trail[k].y);
        ctx.stroke();
      }
      const last = trail[trail.length - 1];
      const radius = 6 + flash * 6;
      const grad = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, radius);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.7 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(last.x, last.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },
};