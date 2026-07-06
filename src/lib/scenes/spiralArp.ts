/**
 * Scene C — Spiral Arpeggiator (Phase-Alignment retrofit).
 *
 * N playheads ride the same Archimedean spiral from outer to inner and
 * back. Voice `i` completes `B + i` full spiral traversals per macro-
 * cycle. All playheads sit at the outer end at every `t = k · D`.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];

type Playhead = {
  pi: number;
  slot: VoiceSlotIndex;
  hue: number;
  lastFireT: number;
};

export type SpiralArpState = {
  a: number;
  b: number;
  turns: number;
  playheads: Playhead[];
  density: number;
};

function spiralTurns(density: number) {
  return Math.max(3, Math.min(10, Math.round(3 + (density - 2) * 0.7)));
}
function playheadCount(density: number) {
  return Math.max(3, Math.min(8, Math.round(3 + (density - 2) * 0.5)));
}

function buildPlayheads(N: number): Playhead[] {
  const hues = [0.55, 0.78, 0.18, 0.05, 0.42, 0.62, 0.88, 0.32];
  const slots: VoiceSlotIndex[] = [0, 2, 4, 1, 3, 5, 0, 2];
  const out: Playhead[] = new Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = {
      pi: i, // 0 = slowest, N-1 = fastest
      slot: slots[i % slots.length],
      hue: hues[i % hues.length],
      lastFireT: -Infinity,
    };
  }
  return out;
}

const thetaMax = (turns: number) => turns * Math.PI * 2;
const radiusAt = (state: SpiralArpState, theta: number) => state.a + state.b * theta;

function reseed(state: SpiralArpState, g: { W: number; H: number; density: number }) {
  const turns = spiralTurns(g.density ?? 5);
  const maxR = Math.min(g.W, g.H) * 0.42;
  const tMax = thetaMax(turns);
  state.turns = turns;
  state.b = maxR / tMax;
  state.a = 6;
  state.density = g.density ?? 5;
  const wantN = playheadCount(g.density ?? 5);
  if (state.playheads.length !== wantN) state.playheads = buildPlayheads(wantN);
}

/** Progress → (theta, r). progress=0 at outer end, ramps inward and back. */
function playheadPos(state: SpiralArpState, pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  // Triangle: 0 → 1 → 0 within the lap, so playhead returns to outer at wrap.
  const uSpiral = p < 0.5 ? p * 2 : (1 - p) * 2;
  const tMax = thetaMax(state.turns);
  const theta = tMax * (1 - uSpiral); // outer (uSpiral=0) → theta=tMax
  const r = radiusAt(state, theta);
  return { theta, r };
}

export const spiralArpScene: Scene<SpiralArpState> = {
  id: "spiralArp",

  init(g) {
    const state: SpiralArpState = {
      a: 6,
      b: 1,
      turns: 3,
      density: g.density ?? 5,
      playheads: buildPlayheads(playheadCount(g.density ?? 5)),
    };
    reseed(state, g);
    return state;
  },

  sample(state, _t, g) {
    if (spiralTurns(g.density) !== state.turns || playheadCount(g.density) !== state.playheads.length) {
      reseed(state, g);
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    if (spiralTurns(g.density) !== state.turns || playheadCount(g.density) !== state.playheads.length) {
      reseed(state, g);
    }
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const N = state.playheads.length;
    const scratch: number[] = [];
    const tMax = thetaMax(state.turns);
    const rOuter = radiusAt(state, tMax);
    for (const p of state.playheads) {
      scratch.length = 0;
      crossings(p.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      // Wraps land at outer end (theta = tMax).
      const x = cx + Math.cos(tMax) * rOuter;
      const y = cy + Math.sin(tMax) * rOuter;
      const speedNorm = N > 1 ? p.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        p.lastFireT = tEv;
        events.push({
          slot: p.slot,
          freq: freqOf(SCALE_SEMIS[p.pi % SCALE_SEMIS.length] + g.pitchSemis),
          x,
          y,
          hue: p.hue,
          velocity: 0.55 + speedNorm * 0.4,
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const tMax = thetaMax(state.turns);
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Spiral track — 3 additive passes for halo.
    const passes = [
      { w: 0.5, a: 0.65, hue: 200 },
      { w: 1.4, a: 0.16, hue: 220 },
      { w: 3.4, a: 0.05, hue: 260 },
    ];
    for (const pass of passes) {
      ctx.lineWidth = pass.w;
      ctx.strokeStyle = `oklch(0.85 0.14 ${pass.hue} / ${pass.a.toFixed(2)})`;
      ctx.beginPath();
      const N = 240;
      for (let i = 0; i <= N; i++) {
        const theta = (i / N) * tMax;
        const r = radiusAt(state, theta);
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    for (const p of state.playheads) {
      const { theta, r } = playheadPos(state, p.pi, t, B, D);
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r;
      const hueDeg = (p.hue * 360) % 360;
      const flash = Math.max(0, Math.exp(-(t - p.lastFireT) * 3.2));
      const radius = 14 + flash * 8;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `oklch(0.95 0.2 ${hueDeg} / ${(0.85 + flash * 0.1).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },
};