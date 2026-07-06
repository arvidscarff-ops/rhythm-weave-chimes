/**
 * Scene H — Radial Resonator (Phase-Alignment retrofit).
 *
 * N notes bound to fixed radial rays. Radial distance:
 *
 *   r_i(t) = (1 - cos(2π · progress(t, i, B, D))) / 2 · Rmax
 *
 * `r = 0` at every wrap → every note ignites the center in unison at
 * `t = k · D`. Triggers fire on center hits.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";
import type { PackId } from "@/lib/sound/packs";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
const SCALE_SEMIS = [0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22];
const NOTE_COUNT = 24;

type Note = {
  id: number;
  theta: number;
  pi: number;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  pack: PackId;
  prevR: number;
  lastFireT: number;
};

export type RadialResonatorState = {
  notes: Note[];
};

function buildNotes(): Note[] {
  const N = NOTE_COUNT;
  const packs: PackId[] = ["moss", "prism", "obsidian"];
  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    notes[i] = {
      id: i,
      theta: (i / N) * Math.PI * 2,
      pi: i,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SCALE_SEMIS[i % SCALE_SEMIS.length],
      hue: (i / N + 0.05) % 1,
      pack: packs[i % packs.length],
      prevR: 0,
      lastFireT: -Infinity,
    };
  }
  return notes;
}

function radialNorm(pi: number, t: number, B: number, D: number) {
  const p = progress(t, pi, B, D);
  return (1 - Math.cos(p * Math.PI * 2)) / 2;
}

export const radialResonatorScene: Scene<RadialResonatorState> = {
  id: "radialResonator",

  init(_g) {
    return { notes: buildNotes() };
  },

  sample(_state, _t, _g) {},

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const cx = g.W / 2;
    const cy = g.H / 2;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const N = state.notes.length;
    const scratch: number[] = [];
    for (const n of state.notes) {
      scratch.length = 0;
      crossings(n.pi, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const speedNorm = N > 1 ? n.pi / (N - 1) : 1;
      for (const tEv of scratch) {
        n.lastFireT = tEv;
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis + g.pitchSemis),
          x: cx,
          y: cy,
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
    const Rmax = Math.min(g.W, g.H) * 0.42;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    ctx.save();
    ctx.fillStyle = "rgba(15, 23, 42, 0.08)";
    ctx.fillRect(0, 0, g.W, g.H);
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = "screen";

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

    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "oklch(0.78 0.06 220 / 0.18)";
    ctx.beginPath();
    ctx.arc(cx, cy, Rmax, 0, Math.PI * 2);
    ctx.stroke();

    let minR = 1;
    for (const n of state.notes) {
      const rN = radialNorm(n.pi, t, B, D);
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

      ctx.lineWidth = 0.9 + flash * 0.8;
      ctx.strokeStyle = `oklch(0.82 0.16 ${hueDeg} / ${(0.32 + flash * 0.35).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const radius = 3 + flash * 4;
      const grad = ctx.createRadialGradient(x2, y2, 0, x2, y2, radius * 3);
      grad.addColorStop(0, `oklch(0.92 0.2 ${hueDeg} / ${(0.7 + flash * 0.25).toFixed(3)})`);
      grad.addColorStop(1, `oklch(0.6 0.16 ${hueDeg} / 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x2, y2, radius * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const ignition = Math.pow(1 - Math.min(1, minR * 6), 2);
    const ignR = 14 + ignition * 10;
    const ag = ctx.createRadialGradient(cx, cy, 0, cx, cy, ignR);
    ag.addColorStop(0, `oklch(0.96 0.10 240 / ${(0.55 + ignition * 0.4).toFixed(3)})`);
    ag.addColorStop(1, "oklch(0.6 0.06 240 / 0)");
    ctx.fillStyle = ag;
    ctx.beginPath();
    ctx.arc(cx, cy, ignR, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  },
};