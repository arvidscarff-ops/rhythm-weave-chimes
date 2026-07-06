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
export type BurstShape = "dot" | "ring" | "spark" | "streak" | "glow" | "fireSpark";
export type BurstColorMode = "palette" | "fixed" | "rainbow";
export type BurstBlendMode = "lighter" | "source-over";

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
    /** Alpha multiplier for the solid core (0..1). */
    noteOpacity: number;
    /** Alpha multiplier for the radial halo (0..1). */
    glowOpacity: number;
  };
  trail: {
    decay: number;          // 0..0.98 — canvas retention alpha
  };
  palette: {
    mode: PaletteMode;
    startHex: string;
    endHex: string;
    presetId?: PalettePresetId;
    /** When true, wireframe tracks use `lineColor` (single color) instead of the gradient. */
    lineColorEnabled: boolean;
    lineColor: string;      // hex
    lineOpacity: number;    // 0..1
  };
  burst: {
    count: number;               // 0..200 (per trigger)
    angleSpreadDeg: number;      // 0..360 — cone width around directionDeg
    directionDeg: number;        // 0..360 — emission axis (0 = up)
    baseSpeed: number;           // px/s
    speedVariance: number;       // 0..1 — random speed multiplier range
    drag: number;                // 0..12 — per-second exponential damp
    gravity: number;             // px/s^2, signed (positive = down)
    lifespanMs: number;          // 50..4000
    lifespanVariance: number;    // 0..1
    sizeStartPx: number;         // 0.5..12
    sizeEndPx: number;           // 0..12 (end-of-life radius; interpolated)
    sizeVariance: number;        // 0..3
    shape: BurstShape;
    colorMode: BurstColorMode;
    fixedColor: string;          // hex, used when colorMode = "fixed"
    opacityStart: number;        // 0..1
    opacityEnd: number;          // 0..1
    blendMode: BurstBlendMode;
    trailLength: number;         // 0..12 — motion-blur segments (0 = off)
  };
  /**
   * Fire-Spark shader (Jan Mróz, jaszunio15 — CC BY 3.0). Only used when
   * `burst.shape === "fireSpark"`. Rendered by a WebGL2 overlay layer.
   */
  fireSpark: {
    life: number;      // 0.4..4 s
    size: number;      // 0.05..0.6 — fraction of canvas width
    intensity: number; // 0..6
    tint: string;      // hex — multiplied over shader output
    speed: number;     // 0.1..5 — outward velocity multiplier (independent of life)
    ashRate: number;   // 0..4 — how many small orb "ash" flecks are emitted
    bloom: number;       // 0..3   — HDR bloom strength
    shimmer: number;     // 0..2   — heat-shimmer distortion
    trails: number;      // 0..0.97 — motion-trail persistence
    turbulence: number;  // 0..3   — curl-noise flow strength
    wind: number;        // -200..200 — upward push (px/s)
    afterglow: number;   // 0..2   — cooling-ember afterglow
    glow: number;        // 0..2   — reactive underlay glow
    chroma: number;      // 0..3   — chromatic aberration on hot cores (px)
  };
  pathPulse: {
    enabled: boolean;
    speed: number;          // 0.2..4  (revolutions/sec along path)
    widthPx: number;        // 1..8
    opacity: number;        // 0..1
  };
  climax: {
    ambientFlash: boolean;
    stardust: boolean;
    stardustCount: number;  // 0..80
    flashOpacity: number;   // 0..1
    stardustOpacity: number;// 0..1
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
  notes: { baseRadiusPx: 5, breathHz: 0.6, breathDepth: 0.3, noteOpacity: 1, glowOpacity: 1 },
  trail: { decay: 0.86 },
  palette: {
    mode: "gradient",
    startHex: "#7DF9FF",
    endHex: "#FF3EA5",
    lineColorEnabled: false,
    lineColor: "#8FD8FF",
    lineOpacity: 0.22,
  },
  burst: {
    count: 28,
    angleSpreadDeg: 360,
    directionDeg: 0,
    baseSpeed: 140,
    speedVariance: 0.5,
    drag: 2.4,
    gravity: 0,
    lifespanMs: 700,
    lifespanVariance: 0.4,
    sizeStartPx: 3,
    sizeEndPx: 0,
    sizeVariance: 1.4,
    shape: "glow",
    colorMode: "palette",
    fixedColor: "#FFFFFF",
    opacityStart: 0.9,
    opacityEnd: 0,
    blendMode: "lighter",
    trailLength: 0,
  },
  pathPulse: { enabled: true, speed: 1.6, widthPx: 3, opacity: 0.9 },
  fireSpark: {
    life: 1.5, size: 0.34, intensity: 4.0, tint: "#FF8A2B",
    speed: 1.0, ashRate: 1.0,
    bloom: 1.2, shimmer: 0.9, trails: 0.35, turbulence: 0.9,
    wind: 40, afterglow: 1.0, glow: 0.9, chroma: 1.2,
  },
  climax: {
    ambientFlash: true,
    stardust: true,
    stardustCount: 40,
    flashOpacity: 0.35,
    stardustOpacity: 1,
  },
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
  // Sample densely enough to catch every sign change of (coord - target).
  // Bug fix: previously stepDt was based solely on lap duration; for short
  // scan windows (a single 16 ms frame) the loop could skip the window
  // entirely and miss crossings. Now we cap stepDt to a fraction of the
  // window AND lap duration, and always evaluate the window endpoint.
  const window = Math.max(0, t1 - t0);
  if (window <= 0) return [];
  const laps = Math.max(1, Math.floor(B) + Math.max(0, Math.floor(i)));
  const lapDuration = D / laps;
  const stepDt = Math.max(
    0.001,
    Math.min(lapDuration / 128, 0.008, window),
  );
  const samples = Math.max(2, Math.ceil(window / stepDt));
  const dt = window / samples;
  const out: number[] = [];
  let prevT = t0;
  let prevVal = coordAtTime(blueprint, prevT, i, B, D, axis) - target;
  for (let s = 1; s <= samples; s++) {
    const t = t0 + s * dt;
    const v = coordAtTime(blueprint, t, i, B, D, axis) - target;
    if ((prevVal <= 0 && v > 0) || (prevVal >= 0 && v < 0)) {
      const denom = prevVal - v;
      const frac = denom === 0 ? 0 : prevVal / denom;
      out.push(prevT + (t - prevT) * frac);
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
      noteOpacity: clamp01(Number(nt.noteOpacity ?? d.notes.noteOpacity)),
      glowOpacity: clamp01(Number(nt.glowOpacity ?? d.notes.glowOpacity)),
    },
    trail: { decay: clampRange(Number(tr.decay ?? d.trail.decay), 0, 0.98) },
    palette: {
      mode: (pl.mode === "preset" ? "preset" : "gradient") as PaletteMode,
      startHex: typeof pl.startHex === "string" ? pl.startHex : d.palette.startHex,
      endHex: typeof pl.endHex === "string" ? pl.endHex : d.palette.endHex,
      presetId: typeof pl.presetId === "string" ? (pl.presetId as PalettePresetId) : undefined,
      lineColorEnabled: Boolean(pl.lineColorEnabled ?? d.palette.lineColorEnabled),
      lineColor: typeof pl.lineColor === "string" ? pl.lineColor : d.palette.lineColor,
      lineOpacity: clamp01(Number(pl.lineOpacity ?? d.palette.lineOpacity)),
    },
    burst: {
      count: clampRange(Number(br.count ?? d.burst.count), 0, 200),
      angleSpreadDeg: clampRange(Number(br.angleSpreadDeg ?? d.burst.angleSpreadDeg), 0, 360),
      directionDeg: clampRange(Number(br.directionDeg ?? d.burst.directionDeg), 0, 360),
      baseSpeed: clampRange(Number(br.baseSpeed ?? d.burst.baseSpeed), 0, 800),
      speedVariance: clamp01(Number(br.speedVariance ?? d.burst.speedVariance)),
      drag: clampRange(Number(br.drag ?? d.burst.drag), 0, 12),
      gravity: clampRange(Number(br.gravity ?? d.burst.gravity), -2000, 2000),
      lifespanMs: clampRange(Number(br.lifespanMs ?? d.burst.lifespanMs), 50, 4000),
      lifespanVariance: clamp01(Number(br.lifespanVariance ?? d.burst.lifespanVariance)),
      sizeStartPx: clampRange(Number(br.sizeStartPx ?? d.burst.sizeStartPx), 0.2, 24),
      sizeEndPx: clampRange(Number(br.sizeEndPx ?? d.burst.sizeEndPx), 0, 24),
      sizeVariance: clampRange(Number(br.sizeVariance ?? d.burst.sizeVariance), 0, 6),
      shape: (["dot", "ring", "spark", "streak", "glow", "fireSpark"].includes(br.shape as string)
        ? (br.shape as BurstShape)
        : d.burst.shape),
      colorMode: (["palette", "fixed", "rainbow"].includes(br.colorMode as string)
        ? (br.colorMode as BurstColorMode)
        : d.burst.colorMode),
      fixedColor: typeof br.fixedColor === "string" ? br.fixedColor : d.burst.fixedColor,
      opacityStart: clamp01(Number(br.opacityStart ?? d.burst.opacityStart)),
      opacityEnd: clamp01(Number(br.opacityEnd ?? d.burst.opacityEnd)),
      blendMode: (br.blendMode === "source-over" ? "source-over" : "lighter") as BurstBlendMode,
      trailLength: clampRange(Number(br.trailLength ?? d.burst.trailLength), 0, 12),
    },
    fireSpark: (() => {
      const fs = (a.fireSpark ?? {}) as Record<string, unknown>;
      return {
        life: clampRange(Number(fs.life ?? d.fireSpark.life), 0.2, 6),
        size: clampRange(Number(fs.size ?? d.fireSpark.size), 0.03, 0.8),
        intensity: clampRange(Number(fs.intensity ?? d.fireSpark.intensity), 0, 6),
        tint: typeof fs.tint === "string" ? fs.tint : d.fireSpark.tint,
        speed: clampRange(Number(fs.speed ?? d.fireSpark.speed), 0.1, 5),
        ashRate: clampRange(Number(fs.ashRate ?? d.fireSpark.ashRate), 0, 4),
        bloom:      clampRange(Number(fs.bloom      ?? d.fireSpark.bloom),      0, 3),
        shimmer:    clampRange(Number(fs.shimmer    ?? d.fireSpark.shimmer),    0, 2),
        trails:     clampRange(Number(fs.trails     ?? d.fireSpark.trails),     0, 0.97),
        turbulence: clampRange(Number(fs.turbulence ?? d.fireSpark.turbulence), 0, 3),
        wind:       clampRange(Number(fs.wind       ?? d.fireSpark.wind),      -200, 200),
        afterglow:  clampRange(Number(fs.afterglow  ?? d.fireSpark.afterglow),  0, 2),
        glow:       clampRange(Number(fs.glow       ?? d.fireSpark.glow),       0, 2),
        chroma:     clampRange(Number(fs.chroma     ?? d.fireSpark.chroma),     0, 3),
      };
    })(),
    pathPulse: {
      enabled: Boolean(pp.enabled ?? d.pathPulse.enabled),
      speed: clampRange(Number(pp.speed ?? d.pathPulse.speed), 0.05, 8),
      widthPx: clampRange(Number(pp.widthPx ?? d.pathPulse.widthPx), 0.5, 12),
      opacity: clamp01(Number(pp.opacity ?? d.pathPulse.opacity)),
    },
    climax: {
      ambientFlash: Boolean(cl.ambientFlash ?? d.climax.ambientFlash),
      stardust: Boolean(cl.stardust ?? d.climax.stardust),
      stardustCount: clampRange(Number(cl.stardustCount ?? d.climax.stardustCount), 0, 120),
      flashOpacity: clamp01(Number(cl.flashOpacity ?? d.climax.flashOpacity)),
      stardustOpacity: clamp01(Number(cl.stardustOpacity ?? d.climax.stardustOpacity)),
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