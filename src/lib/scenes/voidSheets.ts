/**
 * Scene — Void Sheets.
 *
 * Death-zen field of stacked, translucent undulating "sheets" suspended
 * in darkness. Each note is bound to one sheet and travels outward from
 * a central ignition axis to a maximum distance, then returns — a full
 * out-and-back per rhythmic journey. Because each note completes a
 * different integer number of journeys per macro-cycle (via the shared
 * Phase-Alignment rule), diagonals, vertical constellations, wave-fronts,
 * and cluster hotspots continually emerge and dissolve.
 *
 * Rhythmic timing is NOT computed here — cadence comes entirely from
 * `phaseAlign.progress` / `phaseAlign.crossings` on the shared macro-
 * cycle. Geometry is a pure function of that progress. Trigger flashes
 * are visual-only and never modify rhythmic state.
 */

import type { Scene, TriggerEvent, VoiceSlotIndex } from "@/lib/engine/sceneTypes";
import { crossings, progress } from "@/lib/engine/phaseAlign";

const ROOT_HZ = 220;
const freqOf = (s: number) => ROOT_HZ * Math.pow(2, s / 12);
// Wide, gently ascending scale so the Big Bang chord reads as one
// suspended, non-dissonant "field".
const SEMIS = [0, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22, 24, 26, 27, 29, 31, 34, 36, 38, 39, 41, 43, 46, 48];
// Pale, desaturated warm/cool palette — no neon.
const HUES = [0.09, 0.11, 0.13, 0.55, 0.60, 0.65, 0.08, 0.12, 0.14, 0.58, 0.62, 0.66];

const SHEET_COUNT = 12;
// Normalized field extents.
const X_MIN = 0.10;
const X_MAX = 0.90;
const Y_MIN = 0.14;
const Y_MAX = 0.86;
const CENTER_X = 0.5;
const MAX_TRAVEL = 0.40; // (X_MAX - CENTER_X) roughly
const WAVE_FREQ = Math.PI * 2 * 1.35;
const SECONDARY_FREQ = Math.PI * 2 * 2.2;
const LAYER_PHASE = 0.32;
const SECONDARY_LAYER_PHASE = 0.17;

type SheetImpulse = {
  /** 0..1, decays with time; used only for rendering. */
  amp: number;
  /** scene-time the impulse fired. */
  t0: number;
  /** which side the trigger came from (visual only). */
  side: number;
};

type Note = {
  id: number;
  sheetIndex: number;
  side: 1 | -1;
  slot: VoiceSlotIndex;
  pitchSemis: number;
  hue: number;
  lastFireT: number;
};

export type VoidSheetsState = {
  cachedN: number;
  notes: Note[];
  impulses: SheetImpulse[];
  /** Latest scene-time the last macro-cycle boundary fired at. */
  lastBangT: number;
};

function buildNotes(N: number): Note[] {
  const notes: Note[] = new Array(N);
  for (let i = 0; i < N; i++) {
    notes[i] = {
      id: i,
      sheetIndex: i % SHEET_COUNT,
      // Deterministic left/right side per note identity.
      side: i % 2 === 0 ? -1 : 1,
      slot: (i % 6) as VoiceSlotIndex,
      pitchSemis: SEMIS[i % SEMIS.length],
      hue: HUES[i % HUES.length],
      lastFireT: -Infinity,
    };
  }
  return notes;
}

/** Normalized envelope: compressed near center, opens outward. */
function envelope(xn: number): number {
  const d = Math.min(1, Math.abs(xn - CENTER_X) / 0.5);
  const s = d * d * (3 - 2 * d); // smoothstep
  return Math.pow(s, 0.75);
}

/** Sheet Y in normalized coords for a given normalized X. */
function sheetYNorm(xn: number, sheetIndex: number): number {
  const baseY = Y_MIN + (Y_MAX - Y_MIN) * (sheetIndex / Math.max(1, SHEET_COUNT - 1));
  const amp = 0.024 + 0.018 * Math.sin(sheetIndex * 0.7);
  const amp2 = 0.010 + 0.006 * Math.cos(sheetIndex * 0.9);
  const e = envelope(xn);
  const primary = amp * e * Math.sin(WAVE_FREQ * xn + sheetIndex * LAYER_PHASE);
  const secondary = amp2 * e * Math.sin(SECONDARY_FREQ * xn - sheetIndex * SECONDARY_LAYER_PHASE);
  return baseY + primary + secondary;
}

function toPx(xn: number, yn: number, W: number, H: number) {
  return { x: xn * W, y: yn * H };
}

/** Convert current normalized progress into travel ∈ [0,1] (out+back). */
function travelOf(p: number): number {
  return p <= 0.5 ? p * 2 : (1 - p) * 2;
}

export const voidSheetsScene: Scene<VoidSheetsState> = {
  id: "voidSheets",

  init(g) {
    const N = g.noteCount;
    return {
      cachedN: N,
      notes: buildNotes(N),
      impulses: new Array(SHEET_COUNT).fill(null).map(() => ({ amp: 0, t0: -Infinity, side: 1 })),
      lastBangT: -Infinity,
    };
  },

  sample(state, _t, g) {
    if (state.cachedN !== g.noteCount) {
      state.cachedN = g.noteCount;
      state.notes = buildNotes(g.noteCount);
    }
  },

  eventsIn(state, t0, t1, g) {
    const events: TriggerEvent[] = [];
    if (t1 <= t0) return events;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;
    const cx = g.W * CENTER_X;
    const scratch: number[] = [];
    for (const n of state.notes) {
      scratch.length = 0;
      crossings(n.id, B, D, t0, t1, scratch);
      if (scratch.length === 0) continue;
      const yPx = sheetYNorm(CENTER_X, n.sheetIndex) * g.H;
      // Faster (higher id) voices ride the top of the mix.
      const N = state.notes.length;
      const speedNorm = N > 1 ? n.id / (N - 1) : 1;
      for (const tEv of scratch) {
        n.lastFireT = tEv;
        // Fire a sheet-local impulse for visual response.
        const imp = state.impulses[n.sheetIndex];
        imp.amp = Math.min(1, imp.amp + 0.6);
        imp.t0 = tEv;
        imp.side = n.side;
        if (tEv > state.lastBangT) state.lastBangT = tEv - (tEv % D);
        events.push({
          slot: n.slot,
          freq: freqOf(n.pitchSemis + g.pitchSemis),
          x: cx,
          y: yPx,
          hue: n.hue,
          // Restrained energy — this is a meditative scene, not fireworks.
          velocity: 0.35 + speedNorm * 0.35,
        });
      }
    }
    return events;
  },

  draw(state, ctx, g) {
    const W = g.W;
    const H = g.H;
    const t = g.globalTime;
    const B = g.baseLaps;
    const D = g.macroCycleSeconds;

    // Deep charcoal wash — long-exposure fade of the previous frame so
    // note halos leave a faint breath-trail without accumulating grime.
    ctx.save();
    ctx.fillStyle = "rgba(6, 7, 10, 0.28)";
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    // Decay sheet impulses (visual only).
    for (const imp of state.impulses) {
      // exp decay with tau ≈ 1.4s
      const age = Math.max(0, t - imp.t0);
      imp.amp = Math.exp(-age * 0.7) * (imp.amp > 0 ? 1 : 0) * (age < 6 ? 1 : 0);
      // Guard: recompute from t0 so scrubbing works.
      imp.amp = age < 6 ? Math.exp(-age * 0.7) : 0;
    }

    // Global cycle proximity → the whole field brightens slightly near
    // Phase Zero. cycFrac ∈ [0,1); ignition = 1 at the boundary, decays.
    const cycFrac = (((t % D) + D) % D) / D;
    const nearBang = Math.max(1 - cycFrac, cycFrac); // closeness to 0 or 1
    const ignition = Math.pow(nearBang, 8); // narrow spike near boundary

    // ---- Sheets ----
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const SAMPLES = 96;
    for (let s = 0; s < SHEET_COUNT; s++) {
      const hueBase = 40; // warm neutral
      const imp = state.impulses[s];
      const impAge = Math.max(0, t - imp.t0);
      const impStrength = imp.amp;

      // Broad glow pass (very low alpha).
      const glowAlpha = 0.03 + impStrength * 0.06 + ignition * 0.02;
      ctx.lineWidth = 3.2;
      ctx.strokeStyle = `oklch(0.85 0.02 ${hueBase} / ${glowAlpha.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= SAMPLES; i++) {
        const xn = X_MIN + (X_MAX - X_MIN) * (i / SAMPLES);
        let yn = sheetYNorm(xn, s);
        // Trigger-driven ripple: sine packet propagating out from center,
        // exponentially damped in distance.
        const dCenter = Math.abs(xn - CENTER_X);
        const ripple =
          impStrength *
          0.010 *
          Math.sin(dCenter * 28 - impAge * 6.5) *
          Math.exp(-dCenter * 5.5);
        yn += ripple;
        const p = toPx(xn, yn, W, H);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // Main hairline pass.
      const lineAlpha = 0.14 + impStrength * 0.28 + ignition * 0.10;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = `oklch(0.92 0.03 ${hueBase} / ${lineAlpha.toFixed(3)})`;
      ctx.beginPath();
      for (let i = 0; i <= SAMPLES; i++) {
        const xn = X_MIN + (X_MAX - X_MIN) * (i / SAMPLES);
        let yn = sheetYNorm(xn, s);
        const dCenter = Math.abs(xn - CENTER_X);
        const ripple =
          impStrength *
          0.010 *
          Math.sin(dCenter * 28 - impAge * 6.5) *
          Math.exp(-dCenter * 5.5);
        yn += ripple;
        const p = toPx(xn, yn, W, H);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // ---- Ignition axis ----
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const axisX = CENTER_X * W;
    const axisTop = Y_MIN * H;
    const axisBot = Y_MAX * H;
    // Base seam — very faint.
    const baseAxisA = 0.05 + ignition * 0.35;
    const axGrad = ctx.createLinearGradient(axisX, axisTop, axisX, axisBot);
    axGrad.addColorStop(0, `oklch(0.9 0.02 60 / 0)`);
    axGrad.addColorStop(0.5, `oklch(0.95 0.02 60 / ${baseAxisA.toFixed(3)})`);
    axGrad.addColorStop(1, `oklch(0.9 0.02 60 / 0)`);
    ctx.strokeStyle = axGrad;
    ctx.lineWidth = 0.8 + ignition * 1.2;
    ctx.beginPath();
    ctx.moveTo(axisX, axisTop);
    ctx.lineTo(axisX, axisBot);
    ctx.stroke();

    // Per-impulse local axis glow.
    for (let s = 0; s < SHEET_COUNT; s++) {
      const imp = state.impulses[s];
      if (imp.amp < 0.01) continue;
      const yPx = sheetYNorm(CENTER_X, s) * H;
      const rad = 24 + imp.amp * 40;
      const g2 = ctx.createRadialGradient(axisX, yPx, 0, axisX, yPx, rad);
      g2.addColorStop(0, `oklch(0.96 0.06 60 / ${(0.35 * imp.amp).toFixed(3)})`);
      g2.addColorStop(1, `oklch(0.7 0.03 60 / 0)`);
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(axisX, yPx, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // ---- Notes ----
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const n of state.notes) {
      const p = progress(t, n.id, B, D);
      const travel = travelOf(p);
      const xn = CENTER_X + n.side * travel * MAX_TRAVEL;
      const yn = sheetYNorm(xn, n.sheetIndex);
      const px = xn * W;
      const py = yn * H;

      const nearWrap = Math.min(p, 1 - p);
      const flash = Math.max(0, 1 - nearWrap * 18);
      const hueDeg = (n.hue * 360) % 360;
      const core = 2.4 + flash * 3.6;
      const halo = core * 4.5;

      // Halo
      const hg = ctx.createRadialGradient(px, py, 0, px, py, halo);
      hg.addColorStop(0, `oklch(0.92 0.10 ${hueDeg} / ${(0.55 + flash * 0.35).toFixed(3)})`);
      hg.addColorStop(0.5, `oklch(0.82 0.08 ${hueDeg} / ${(0.18 + flash * 0.2).toFixed(3)})`);
      hg.addColorStop(1, `oklch(0.6 0.05 ${hueDeg} / 0)`);
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(px, py, halo, 0, Math.PI * 2);
      ctx.fill();

      // Bright core
      const cg = ctx.createRadialGradient(px, py, 0, px, py, core);
      cg.addColorStop(0, `oklch(0.98 0.05 ${hueDeg} / 0.95)`);
      cg.addColorStop(1, `oklch(0.9 0.05 ${hueDeg} / 0)`);
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(px, py, core, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Suppress unused warnings.
    void state.lastBangT;
  },
};
