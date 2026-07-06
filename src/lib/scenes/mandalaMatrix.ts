/**
 * Scene E — Mandala Matrix (Phase-Alignment retrofit).
 *
 * 6-spoke hexagram. Each note rides a spoke; radial position is
 *
 *   u_i(t) = 0.5 - 0.5 * cos(2π · progress(t, i, B, D))
 *
 * so `u = 0` at every wrap (center = Big Bang anchor) and `u = 1` at
 * mid-cycle. Triggers fire on center crossings (unison). Outer-vertex
 * crossings still fire a high-octave shimmer for texture.
 */

import type { Scene, SceneGlobals, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const NUM_SPOKES = 6;

type Note = {
  spoke: number;
  pi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  lastFireT: number;
};

export type MandalaMatrixState = {
  notes: Note[];
  density: number;
};

function noteCount(density: number) {
  const raw = Math.round(6 + (density - 2) * 2.4);
  return Math.max(6, Math.min(30, Math.round(raw / 6) * 6));
}

function buildNotes(density: number): Note[] {
  const N = noteCount(density);
  const out: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    out[i] = {
      spoke: i % NUM_SPOKES,
      pi: i, // 0 = slowest, N-1 = fastest
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: (i / N + 0.55) % 1,
      lastFireT: -Infinity,
    };
  }
  return out;
}

function spokeU(pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  // 0 at wrap (unison center), 1 at mid-cycle.
  return 0.5 - 0.5 * Math.cos(p * Math.PI * 2);
}

export const mandalaMatrixScene: Scene<MandalaMatrixState> = {
  id: "mandalaMatrix",

  init(g) {
    return { notes: buildNotes(g.density ?? 5), density: g.density ?? 5 };
  },

  sample(state, _t, g) {
    const want = noteCount(g.density);
    if (want !== state.notes.length || state.density !== g.density) {
      state.notes = buildNotes(g.density);
      state.density = g.density;
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const R = Math.min(g.W, g.H) * 0.36;
    const N = state.notes.length;
    const scratch: number[] = [];
    for (const n of state.notes) {
      scratch.length = 0;
      crossings(n.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const angle = (n.spoke / NUM_SPOKES) * Math.PI * 2 - Math.PI / 2;
      const speedNorm = N > 1 ? n.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        n.lastFireT = tEv;
        // Wrap → center (u = 0). Center = low octave.
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis - 12 + g.pitchSemis),
          x: cx,
          y: cy,
          hue: n.hue,
          velocity: (0.55 + speedNorm * 0.4) * 0.9,
        });
        void angle;
        void R;
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const cx = g.W / 2;
    const cy = g.H / 2;
    const R = Math.min(g.W, g.H) * 0.36;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    // Slow trail fill.
    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Hexagram skeleton.
    const verts: { x: number; y: number }[] = [];
    for (let i = 0; i < NUM_SPOKES; i++) {
      const a = (i / NUM_SPOKES) * Math.PI * 2 - Math.PI / 2;
      verts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
    }

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.82 0.10 250 / 0.22)";
    for (const v of verts) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(v.x, v.y);
      ctx.stroke();
    }

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

    ctx.strokeStyle = "oklch(0.78 0.05 220 / 0.10)";
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    // Notes.
    for (const n of state.notes) {
      const u = spokeU(n.pi, t, B, D);
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