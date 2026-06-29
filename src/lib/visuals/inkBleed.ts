/**
 * Soft, smoke-like radial ripple. Replaces hard `globalAlpha = 1` flashes
 * with an exponential alpha-decay curve so triggers feel like ink bleeding
 * into water rather than a stage strobe.
 *
 *   α(t) = α₀ · e^(-k·t)
 *   r(t) = r₀ · (1 + g·t)
 */

type Bleed = {
  x: number;
  y: number;
  r0: number;        // initial radius (px)
  growth: number;    // radial growth rate (1/s)
  alpha0: number;    // 0..1
  decay: number;     // exp-decay rate (1/s)
  t: number;         // seconds since spawn
  life: number;      // total seconds before cull
  hue: number;       // 0..1 → OKLCH hue 0..360
};

const POOL: Bleed[] = [];
const MAX = 64;

export function spawnInkBleed(
  x: number,
  y: number,
  opts: { hue?: number; energy?: number } = {},
) {
  const energy = Math.max(0.05, Math.min(1, opts.energy ?? 0.6));
  if (POOL.length >= MAX) POOL.shift();
  POOL.push({
    x,
    y,
    r0: 8 + energy * 18,
    growth: 80 + energy * 220,    // px/s, but multiplied by t below
    alpha0: 0.18 + energy * 0.42,
    decay: 1.6 + (1 - energy) * 1.4,
    t: 0,
    life: 1.6,
    hue: opts.hue ?? 0.55,
  });
}

export function updateInkBleeds(dt: number) {
  for (let i = POOL.length - 1; i >= 0; i--) {
    POOL[i].t += dt;
    if (POOL[i].t >= POOL[i].life) POOL.splice(i, 1);
  }
}

export function drawInkBleeds(ctx: CanvasRenderingContext2D) {
  if (POOL.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  for (const b of POOL) {
    const t = b.t;
    const alpha = b.alpha0 * Math.exp(-b.decay * t);
    if (alpha < 0.003) continue;
    const r = b.r0 + b.growth * t * 0.35;
    const hueDeg = (b.hue * 360) % 360;
    const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
    grad.addColorStop(0, `oklch(0.92 0.18 ${hueDeg} / ${alpha.toFixed(3)})`);
    grad.addColorStop(
      0.45,
      `oklch(0.78 0.22 ${hueDeg} / ${(alpha * 0.55).toFixed(3)})`,
    );
    grad.addColorStop(1, `oklch(0.6 0.18 ${hueDeg} / 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(b.x, b.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function clearInkBleeds() {
  POOL.length = 0;
}