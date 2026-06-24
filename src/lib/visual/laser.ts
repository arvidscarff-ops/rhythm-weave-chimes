/**
 * Laser rendering primitives.
 *
 * Designed to be called *inside* a render pass that has already set
 * `ctx.globalCompositeOperation = "lighter"` — every stroke and fill in
 * here assumes additive blending. That's what gives lines a hot white
 * core that bleeds into a saturated halo and atmospheric haze, like the
 * Imagine Peace Tower / laser-show reference photos.
 */

export type LaserColorKey = "green" | "red" | "cyan" | "magenta" | "amber" | "blue";

export interface LaserPalette {
  /** Hot near-white tinted core. */
  core: [number, number, number];
  /** Saturated mid glow. */
  glow: [number, number, number];
  /** Deep atmospheric haze. */
  haze: [number, number, number];
}

export const LASER_COLORS: Record<LaserColorKey, LaserPalette> = {
  green:   { core: [225, 255, 230], glow: [110, 255, 140], haze: [40, 200, 90] },
  red:     { core: [255, 220, 220], glow: [255, 90, 90],   haze: [220, 40, 60] },
  cyan:    { core: [220, 250, 255], glow: [110, 230, 255], haze: [40, 170, 230] },
  magenta: { core: [255, 220, 245], glow: [255, 110, 220], haze: [210, 40, 180] },
  amber:   { core: [255, 240, 215], glow: [255, 180, 80],  haze: [220, 120, 30] },
  blue:    { core: [220, 230, 255], glow: [120, 160, 255], haze: [60, 100, 230] },
};

const rgba = (c: [number, number, number], a: number) =>
  `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

/* ----- Deterministic per-element shimmer ----- */

export function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

/** Smooth, low-amplitude shimmer in [-1..1]. */
export function shimmer(t: number, seed: number, hz = 7): number {
  const a = Math.sin(t * hz + seed * 31.7);
  const b = Math.sin(t * (hz * 0.41) + seed * 12.3);
  return (a * 0.65 + b * 0.35);
}

/** Intensity multiplier (sparkle gating), in [0.78..1.05]. */
export function flicker(t: number, seed: number): number {
  return 0.92 + 0.08 * shimmer(t, seed, 11) + 0.05 * shimmer(t, seed + 7.7, 27);
}

/* ----- Stroke helpers (multi-pass laser) ----- */

interface LineOpts {
  intensity?: number;   // 0..1+, scales brightness
  width?: number;       // core width (px), default 0.75
  seed?: number;        // for shimmer
  t?: number;           // time in seconds
  jitter?: number;      // perpendicular wobble px, default 0.35
}

export function drawLaserLine(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number, x2: number, y2: number,
  pal: LaserPalette, opts: LineOpts = {},
) {
  const I = opts.intensity ?? 1;
  const seed = opts.seed ?? 0;
  const t = opts.t ?? 0;
  const jitter = opts.jitter ?? 0.35;
  const fl = flicker(t, seed);

  // perpendicular jitter offset
  const dx = x2 - x1, dy = y2 - y1;
  const L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const j = shimmer(t, seed) * jitter;
  const ox = nx * j, oy = ny * j;

  ctx.lineCap = "round";

  // Haze (wide, low alpha)
  ctx.lineWidth = 14;
  ctx.strokeStyle = rgba(pal.haze, 0.05 * I);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(pal.haze, 0.09 * I);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();

  // Bloom
  ctx.lineWidth = 4;
  ctx.strokeStyle = rgba(pal.glow, 0.18 * I * fl);
  ctx.beginPath(); ctx.moveTo(x1 + ox, y1 + oy); ctx.lineTo(x2 + ox, y2 + oy); ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = rgba(pal.glow, 0.40 * I * fl);
  ctx.beginPath(); ctx.moveTo(x1 + ox, y1 + oy); ctx.lineTo(x2 + ox, y2 + oy); ctx.stroke();

  // Core filament
  ctx.lineWidth = opts.width ?? 0.85;
  ctx.strokeStyle = rgba(pal.core, Math.min(1, 0.95 * I * fl));
  ctx.beginPath(); ctx.moveTo(x1 + ox, y1 + oy); ctx.lineTo(x2 + ox, y2 + oy); ctx.stroke();
}

export function drawLaserArc(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  pal: LaserPalette, opts: LineOpts = {},
) {
  const I = opts.intensity ?? 1;
  const seed = opts.seed ?? 0;
  const t = opts.t ?? 0;
  const fl = flicker(t, seed);
  // radial breathing: shifts the ring radius by ±0.35px
  const rWobble = shimmer(t, seed, 3.5) * 0.35;
  const R = r + rWobble;

  ctx.lineCap = "round";
  const passes: [number, [number, number, number], number][] = [
    [14, pal.haze, 0.045 * I],
    [8,  pal.haze, 0.08  * I],
    [4,  pal.glow, 0.16  * I * fl],
    [2,  pal.glow, 0.36  * I * fl],
    [opts.width ?? 0.85, pal.core, Math.min(1, 0.95 * I * fl)],
  ];
  for (const [w, c, a] of passes) {
    ctx.lineWidth = w;
    ctx.strokeStyle = rgba(c, a);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawLaserPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  pal: LaserPalette, opts: LineOpts = {},
) {
  if (pts.length < 2) return;
  const I = opts.intensity ?? 1;
  const seed = opts.seed ?? 0;
  const t = opts.t ?? 0;
  const fl = flicker(t, seed);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const passes: [number, [number, number, number], number][] = [
    [12, pal.haze, 0.05 * I],
    [6,  pal.glow, 0.18 * I * fl],
    [2,  pal.glow, 0.40 * I * fl],
    [opts.width ?? 0.85, pal.core, Math.min(1, 0.95 * I * fl)],
  ];
  for (const [w, c, a] of passes) {
    ctx.lineWidth = w;
    ctx.strokeStyle = rgba(c, a);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
  }
}

/* ----- Burn dot (laser endpoint / emitter) ----- */

export function drawBurnDot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, pal: LaserPalette,
  intensity = 1, baseRadius = 6,
) {
  const R = baseRadius + intensity * 4;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R * 3);
  g.addColorStop(0,    rgba(pal.core, 0.95 * intensity));
  g.addColorStop(0.18, rgba(pal.glow, 0.70 * intensity));
  g.addColorStop(0.55, rgba(pal.haze, 0.22 * intensity));
  g.addColorStop(1,    rgba(pal.haze, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, R * 3, 0, Math.PI * 2);
  ctx.fill();
}

/* ----- Starburst (4-point cross flare for hits) ----- */

export function drawStarburst(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, pal: LaserPalette,
  life: number, // 0..1, 1 = fresh, 0 = gone
  size = 90,
) {
  if (life <= 0) return;
  // ease-out cubic
  const e = 1 - Math.pow(1 - life, 2.2);
  const len = size * (0.4 + 0.6 * e);
  const alpha = life;

  // horizontal & vertical thin flares
  const drawFlare = (x1: number, y1: number, x2: number, y2: number) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0,   rgba(pal.glow, 0));
    g.addColorStop(0.5, rgba(pal.core, 0.75 * alpha));
    g.addColorStop(1,   rgba(pal.glow, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  drawFlare(x - len, y, x + len, y);
  drawFlare(x, y - len, x, y + len);

  // diagonal softer flares (smaller)
  const dlen = len * 0.55;
  const drawSoft = (x1: number, y1: number, x2: number, y2: number) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0,   rgba(pal.glow, 0));
    g.addColorStop(0.5, rgba(pal.glow, 0.45 * alpha));
    g.addColorStop(1,   rgba(pal.glow, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  };
  drawSoft(x - dlen, y - dlen, x + dlen, y + dlen);
  drawSoft(x - dlen, y + dlen, x + dlen, y - dlen);

  // hot core
  const cr = 2 + 6 * e;
  const cg = ctx.createRadialGradient(x, y, 0, x, y, cr * 4);
  cg.addColorStop(0,   rgba(pal.core, alpha));
  cg.addColorStop(0.3, rgba(pal.glow, 0.55 * alpha));
  cg.addColorStop(1,   rgba(pal.glow, 0));
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(x, y, cr * 4, 0, Math.PI * 2); ctx.fill();
}

/* ----- Sparkle pool (the constant "glitter" along beams) ----- */

export interface Sparkle {
  x: number; y: number;
  life: number;        // remaining seconds
  max: number;         // initial life
  size: number;        // px
}

export function spawnSparkle(pool: Sparkle[], x: number, y: number, max = 80) {
  if (pool.length >= max) return;
  const life = 0.18 + Math.random() * 0.22;
  pool.push({ x, y, life, max: life, size: 1.2 + Math.random() * 2.4 });
}

export function updateSparkles(pool: Sparkle[], dt: number) {
  for (let i = pool.length - 1; i >= 0; i--) {
    pool[i].life -= dt;
    if (pool[i].life <= 0) pool.splice(i, 1);
  }
}

export function drawSparkles(
  ctx: CanvasRenderingContext2D,
  pool: Sparkle[], pal: LaserPalette,
) {
  for (const s of pool) {
    const k = s.life / s.max; // 1→0
    const a = Math.pow(k, 1.4);
    const r = s.size * (1 + (1 - k) * 1.4);
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 3);
    g.addColorStop(0,   rgba(pal.core, a));
    g.addColorStop(0.4, rgba(pal.glow, a * 0.55));
    g.addColorStop(1,   rgba(pal.glow, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(s.x, s.y, r * 3, 0, Math.PI * 2); ctx.fill();
  }
}

/** Spawn sparkles randomly along an arc. */
export function sparkleArc(
  pool: Sparkle[], cx: number, cy: number, r: number,
  ratePerSec: number, dt: number, max = 80,
) {
  const expected = ratePerSec * dt;
  let n = Math.floor(expected);
  if (Math.random() < expected - n) n++;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    spawnSparkle(pool, cx + Math.cos(a) * r, cy + Math.sin(a) * r, max);
  }
}

/** Spawn sparkles randomly along a line segment. */
export function sparkleLine(
  pool: Sparkle[], x1: number, y1: number, x2: number, y2: number,
  ratePerSec: number, dt: number, max = 80,
) {
  const expected = ratePerSec * dt;
  let n = Math.floor(expected);
  if (Math.random() < expected - n) n++;
  for (let i = 0; i < n; i++) {
    const t = Math.random();
    spawnSparkle(pool, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, max);
  }
}