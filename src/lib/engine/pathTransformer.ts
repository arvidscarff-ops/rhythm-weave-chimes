/**
 * Path Transformer — maps normalized progress [0..1) to (x, y) in
 * unit space [-1..1] for any registered path type. Every custom scene
 * built in `/studio/builder` runs through this module so cadence
 * (via `phaseAlign`) stays perfectly aligned with geometry.
 *
 * Unit space convention: origin (0,0) at center, +x right, +y down
 * (matches canvas). The Scene Builder scales this into pixel space
 * per track using layout rules.
 */

import { crossings as phaseCrossings, progress as phaseProgress } from "@/lib/engine/phaseAlign";

export type PathType = "circle" | "line" | "polygon" | "lissajous";
export type TriggerMode = "boundary" | "axisIntersect";
export type SizingMode = "linear" | "exponential" | "constant";
export type PaletteMode = "gradient" | "preset";
export type PalettePresetId =
  | "neonCyberpunk"
  | "deepOcean"
  | "autumnHorizon"
  | "phosphorLime"
  | "violetDusk";

/** Aesthetic layer — pure presentation, does not affect timing. */
export type AestheticConfig = {
  background: {
    kind: "none" | "image" | "video";
    url: string;
    opacity: number;    // 0..1
    blurPx: number;     // 0..30
  };
  notes: {
    baseRadiusPx: number;   // 2..18
    breathHz: number;       // 0..2  (per-note independent sine)
    breathDepth: number;    // 0..0.6
  };
  trail: {
    decay: number;          // 0..0.98 — canvas retention alpha
  };
  palette: {
    mode: PaletteMode;
    startHex: string;
    endHex: string;
    presetId?: PalettePresetId;
  };
  burst: {
    count: number;          // 6..120
    baseSpeed: number;      // 20..400 px/s
    lifespanMs: number;     // 200..2000
    drag: number;           // 0..8   (higher = faster settle)
    sizeVariance: number;   // 0..3
  };
  pathPulse: {
    enabled: boolean;
    speed: number;          // 0.2..4  (revolutions/sec along path)
    widthPx: number;        // 1..8
  };
  climax: {
    ambientFlash: boolean;
    stardust: boolean;
    stardustCount: number;  // 0..80
  };
};

export type CustomSceneBlueprint = {
  version: 1;
  name: string;
  path: {
    type: PathType;
    /** Polygon: number of sides (3..12). */
    sides?: number;
    /** Line: axis direction. */
    axis?: "x" | "y";
    /** Lissajous: frequency multipliers + phase offset (radians). */
    freqX?: number;
    freqY?: number;
    phase?: number;
  };
  layout: {
    /** Optional override of noteCount; null → follow global cycle. */
    trackCount: number | null;
    sizing: SizingMode;
    /** Base radius / half-length in unit space (0..1). */
    baseSize: number;
    /** Per-track increment (linear/constant) or exponent base (exponential). */
    step: number;
    /** Per-track starting-orientation offset in degrees. */
    rotationOffsetDeg: number;
  };
  trigger: {
    mode: TriggerMode;
    /** axisIntersect: which axis line to check. */
    axis?: "x" | "y";
    /** axisIntersect: -1..1 offset from center along the OTHER axis. */
    position?: number;
  };
  voice: {
    /** 0..5 — dispatched through the active pack's slot. */
    slot: 0 | 1 | 2 | 3 | 4 | 5;
  };
  /** Aesthetic layer; optional in stored JSON (defaults filled on load). */
  aesthetic: AestheticConfig;
};

export const DEFAULT_AESTHETIC: AestheticConfig = {
  background: { kind: "none", url: "", opacity: 0.6, blurPx: 8 },
  notes: { baseRadiusPx: 5, breathHz: 0.6, breathDepth: 0.3 },
  trail: { decay: 0.86 },
  palette: {
    mode: "gradient",
    startHex: "#7DF9FF",
    endHex: "#FF3EA5",
  },
  burst: {
    count: 28,
    baseSpeed: 140,
    lifespanMs: 700,
    drag: 2.4,
    sizeVariance: 1.4,
  },
  pathPulse: { enabled: true, speed: 1.6, widthPx: 3 },
  climax: { ambientFlash: true, stardust: true, stardustCount: 40 },
};

export const DEFAULT_BLUEPRINT: CustomSceneBlueprint = {
  version: 1,
  name: "Untitled",
  path: { type: "circle" },
  layout: {
    trackCount: null,
    sizing: "linear",
    baseSize: 0.15,
    step: 0.08,
    rotationOffsetDeg: 0,
  },
  trigger: { mode: "boundary" },
  voice: { slot: 0 },
  aesthetic: DEFAULT_AESTHETIC,
};

/**
 * Position on a unit-normalized path for progress ∈ [0, 1).
 * Progress 0 sits at the "trigger anchor" of each shape (12 o'clock for
 * circle, left endpoint for line, first vertex for polygon, phase 0 for
 * lissajous) so the Big Bang chord lands on every path's anchor.
 */
export function positionOn(
  path: CustomSceneBlueprint["path"],
  p: number,
): { x: number; y: number } {
  const t = ((p % 1) + 1) % 1;
  switch (path.type) {
    case "circle": {
      const a = -Math.PI / 2 + t * Math.PI * 2;
      return { x: Math.cos(a), y: Math.sin(a) };
    }
    case "line": {
      // -1 → +1 → -1 (ping-pong) so both endpoints trigger cleanly at
      // wrap boundaries. Sound plays on p=0 (boundary), matching the
      // universal Big Bang anchor at t=0.
      const v = t < 0.5 ? -1 + t * 4 : 3 - t * 4; // -1..1..-1
      return path.axis === "y" ? { x: 0, y: v } : { x: v, y: 0 };
    }
    case "polygon": {
      const sides = Math.max(3, Math.min(12, Math.floor(path.sides ?? 3)));
      const segT = t * sides;
      const segIdx = Math.floor(segT) % sides;
      const segFrac = segT - Math.floor(segT);
      const a0 = -Math.PI / 2 + (segIdx / sides) * Math.PI * 2;
      const a1 = -Math.PI / 2 + ((segIdx + 1) / sides) * Math.PI * 2;
      const x0 = Math.cos(a0);
      const y0 = Math.sin(a0);
      const x1 = Math.cos(a1);
      const y1 = Math.sin(a1);
      return { x: x0 + (x1 - x0) * segFrac, y: y0 + (y1 - y0) * segFrac };
    }
    case "lissajous": {
      const fx = path.freqX ?? 3;
      const fy = path.freqY ?? 2;
      const ph = path.phase ?? Math.PI / 2;
      const a = t * Math.PI * 2;
      return { x: Math.sin(fx * a + ph), y: Math.sin(fy * a) };
    }
  }
}

/** Sample the whole path as a polyline for wireframe drawing. */
export function samplePath(
  path: CustomSceneBlueprint["path"],
  segments = 128,
): Array<{ x: number; y: number }> {
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= segments; i++) {
    out.push(positionOn(path, i / segments));
  }
  return out;
}

/**
 * Per-track size multiplier applied to the unit path.
 * `constant` uses `baseSize + step * i` (stacking side-by-side); the
 * others multiply/exponentiate.
 */
export function trackScale(
  layout: CustomSceneBlueprint["layout"],
  i: number,
  N: number,
): number {
  const b = Math.max(0.02, layout.baseSize);
  const s = layout.step;
  const norm = N > 1 ? i / (N - 1) : 0;
  switch (layout.sizing) {
    case "linear":
      return b + s * norm;
    case "exponential":
      return b * Math.pow(1 + Math.max(0, s), i);
    case "constant":
      return b + s * i;
  }
}

/** Per-track rotation offset in radians. */
export function trackRotation(
  layout: CustomSceneBlueprint["layout"],
  i: number,
): number {
  return (layout.rotationOffsetDeg * Math.PI) / 180 * i;
}

/**
 * Trigger scene-times for voice `i` in (t0, t1].
 * - boundary: reuses phaseAlign.crossings (fires at every wrap → 0).
 * - axisIntersect: scans laps in the window and root-finds sign changes
 *   of the coordinate on the OTHER axis.
 */
export function crossings(
  blueprint: CustomSceneBlueprint,
  i: number,
  B: number,
  D: number,
  t0: number,
  t1: number,
): number[] {
  if (blueprint.trigger.mode === "boundary") {
    return phaseCrossings(i, B, D, t0, t1);
  }
  const axis = blueprint.trigger.axis ?? "x";
  const target = blueprint.trigger.position ?? 0;
  // Sample this voice's progress densely and detect sign changes of
  // (coord - target). Density = ~64 samples per lap keeps missed
  // crossings negligible for all supported path types.
  const laps = Math.max(1, Math.floor(B) + Math.max(0, Math.floor(i)));
  const lapDuration = D / laps;
  const stepDt = Math.max(0.002, lapDuration / 64);
  const out: number[] = [];
  let prevT = t0;
  let prevVal = coordAtTime(blueprint, prevT, i, B, D, axis) - target;
  for (let t = t0 + stepDt; t <= t1; t += stepDt) {
    const v = coordAtTime(blueprint, t, i, B, D, axis) - target;
    if (prevVal === 0 || (prevVal < 0 && v > 0) || (prevVal > 0 && v < 0)) {
      // Linear interpolate crossing time.
      const frac = prevVal / (prevVal - v);
      const tc = prevT + (t - prevT) * frac;
      out.push(tc);
    }
    prevT = t;
    prevVal = v;
  }
  return out;
}

function coordAtTime(
  bp: CustomSceneBlueprint,
  t: number,
  i: number,
  B: number,
  D: number,
  axis: "x" | "y",
): number {
  const p = phaseProgress(t, i, B, D);
  const pos = positionOn(bp.path, p);
  // Apply per-track rotation so axisIntersect respects rotationOffset.
  const rot = trackRotation(bp.layout, i);
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  const x = pos.x * c - pos.y * s;
  const y = pos.x * s + pos.y * c;
  return axis === "x" ? x : y;
}

/** Zod-lite runtime validator so LocalStorage loads never crash. */
export function validateBlueprint(raw: unknown): CustomSceneBlueprint | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.version !== 1) return null;
  const path = r.path as Record<string, unknown> | undefined;
  const layout = r.layout as Record<string, unknown> | undefined;
  const trigger = r.trigger as Record<string, unknown> | undefined;
  const voice = r.voice as Record<string, unknown> | undefined;
  if (!path || !layout || !trigger || !voice) return null;
  const type = path.type as PathType;
  if (!["circle", "line", "polygon", "lissajous"].includes(type)) return null;
  const sizing = layout.sizing as SizingMode;
  if (!["linear", "exponential", "constant"].includes(sizing)) return null;
  const mode = trigger.mode as TriggerMode;
  if (!["boundary", "axisIntersect"].includes(mode)) return null;
  return {
    version: 1,
    name: String(r.name ?? "Untitled"),
    path: {
      type,
      sides: typeof path.sides === "number" ? path.sides : undefined,
      axis: path.axis === "y" ? "y" : path.axis === "x" ? "x" : undefined,
      freqX: typeof path.freqX === "number" ? path.freqX : undefined,
      freqY: typeof path.freqY === "number" ? path.freqY : undefined,
      phase: typeof path.phase === "number" ? path.phase : undefined,
    },
    layout: {
      trackCount: typeof layout.trackCount === "number" ? layout.trackCount : null,
      sizing,
      baseSize: Number(layout.baseSize ?? 0.15),
      step: Number(layout.step ?? 0.08),
      rotationOffsetDeg: Number(layout.rotationOffsetDeg ?? 0),
    },
    trigger: {
      mode,
      axis: trigger.axis === "y" ? "y" : "x",
      position: typeof trigger.position === "number" ? trigger.position : 0,
    },
    voice: {
      slot: (Math.max(0, Math.min(5, Math.floor(Number(voice.slot ?? 0)))) as 0 | 1 | 2 | 3 | 4 | 5),
    },
    aesthetic: mergeAesthetic(r.aesthetic),
  };
}

function mergeAesthetic(raw: unknown): AestheticConfig {
  const d = DEFAULT_AESTHETIC;
  if (!raw || typeof raw !== "object") return { ...d };
  const a = raw as Record<string, unknown>;
  const bg = (a.background ?? {}) as Record<string, unknown>;
  const nt = (a.notes ?? {}) as Record<string, unknown>;
  const tr = (a.trail ?? {}) as Record<string, unknown>;
  const pl = (a.palette ?? {}) as Record<string, unknown>;
  const br = (a.burst ?? {}) as Record<string, unknown>;
  const pp = (a.pathPulse ?? {}) as Record<string, unknown>;
  const cl = (a.climax ?? {}) as Record<string, unknown>;
  return {
    background: {
      kind: (["none", "image", "video"].includes(bg.kind as string) ? bg.kind : d.background.kind) as
        AestheticConfig["background"]["kind"],
      url: typeof bg.url === "string" ? bg.url : d.background.url,
      opacity: clamp01(Number(bg.opacity ?? d.background.opacity)),
      blurPx: clampRange(Number(bg.blurPx ?? d.background.blurPx), 0, 30),
    },
    notes: {
      baseRadiusPx: clampRange(Number(nt.baseRadiusPx ?? d.notes.baseRadiusPx), 1, 30),
      breathHz: clampRange(Number(nt.breathHz ?? d.notes.breathHz), 0, 4),
      breathDepth: clampRange(Number(nt.breathDepth ?? d.notes.breathDepth), 0, 1),
    },
    trail: { decay: clampRange(Number(tr.decay ?? d.trail.decay), 0, 0.98) },
    palette: {
      mode: (pl.mode === "preset" ? "preset" : "gradient") as PaletteMode,
      startHex: typeof pl.startHex === "string" ? pl.startHex : d.palette.startHex,
      endHex: typeof pl.endHex === "string" ? pl.endHex : d.palette.endHex,
      presetId: typeof pl.presetId === "string" ? (pl.presetId as PalettePresetId) : undefined,
    },
    burst: {
      count: clampRange(Number(br.count ?? d.burst.count), 0, 200),
      baseSpeed: clampRange(Number(br.baseSpeed ?? d.burst.baseSpeed), 0, 800),
      lifespanMs: clampRange(Number(br.lifespanMs ?? d.burst.lifespanMs), 50, 4000),
      drag: clampRange(Number(br.drag ?? d.burst.drag), 0, 12),
      sizeVariance: clampRange(Number(br.sizeVariance ?? d.burst.sizeVariance), 0, 6),
    },
    pathPulse: {
      enabled: Boolean(pp.enabled ?? d.pathPulse.enabled),
      speed: clampRange(Number(pp.speed ?? d.pathPulse.speed), 0.05, 8),
      widthPx: clampRange(Number(pp.widthPx ?? d.pathPulse.widthPx), 0.5, 12),
    },
    climax: {
      ambientFlash: Boolean(cl.ambientFlash ?? d.climax.ambientFlash),
      stardust: Boolean(cl.stardust ?? d.climax.stardust),
      stardustCount: clampRange(Number(cl.stardustCount ?? d.climax.stardustCount), 0, 120),
    },
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function clampRange(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}