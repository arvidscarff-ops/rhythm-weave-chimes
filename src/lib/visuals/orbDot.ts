// Living "orb of light" — used everywhere we used to draw a note dot.
// Pure 2D canvas, additive blend, organic per-orb wobble + chromatic fringe.
//
// Travel speed is unchanged: the caller still positions the orb. This helper
// only paints what the dot looks like at (x, y).

const TAU = Math.PI * 2;

export type OrbOptions = {
  /** oklch template with "a" as the alpha placeholder, e.g. "oklch(0.82 0.18 195 / a)". */
  colorTpl: string;
  /** Base radius in CSS px (the "resting" disc). */
  radius?: number;
  /** 0..1 trigger energy (drives swell + flash). */
  energy?: number;
  /** Slow global time in seconds for breathing. */
  time?: number;
  /** Per-orb deterministic phase in [0, 2π). */
  phase?: number;
  /** 0..1 whether to render the soft outer halo (default 1). */
  haloAmount?: number;
};

function repl(tpl: string, a: number): string {
  // colorTpl looks like "oklch(0.82 0.18 195 / a)" — replace the lone "a" placeholder.
  return tpl.replace(/\/\s*a\)/, `/ ${a.toFixed(3)})`);
}

/**
 * Paint one fluid orb at (x, y). Layers (all additive):
 *   1. wide colored halo
 *   2. chromatic-aberration core (R/G/B offsets along a slowly rotating axis)
 *   3. white-hot center
 *   4. trigger flash bloom when energy > 0
 * The orb breathes via per-orb phase: eccentricity, rotation, hue alpha.
 */
export function drawOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  opts: OrbOptions,
) {
  const baseR = Math.max(2, opts.radius ?? 4);
  const energy = Math.max(0, Math.min(1.4, opts.energy ?? 0));
  const t = opts.time ?? 0;
  const ph = opts.phase ?? 0;
  const haloAmt = Math.max(0, Math.min(1, opts.haloAmount ?? 1));
  const tpl = opts.colorTpl;

  // breath drives eccentricity + alpha
  const breath = 0.5 + 0.5 * Math.sin(t * 0.6 + ph);
  const breathA = 0.75 + 0.35 * (breath * 2 - 1);
  const ecc = 1 + 0.10 * Math.sin(t * 0.9 + ph * 1.7);     // ±10%
  const eccAng = ph + t * 0.18;                            // slow drift
  const swellR = baseR * (1 + 0.20 * (breath * 2 - 1)) + energy * 4;

  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  // ---- 1) wide colored halo (eccentric) ----
  if (haloAmt > 0.01) {
    const haloR = swellR * 2.4 + 10;
    const ha = (0.06 + 0.06 * breath) * haloAmt;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(eccAng);
    ctx.scale(ecc, 1 / ecc);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    g.addColorStop(0, repl(tpl, ha));
    g.addColorStop(0.5, repl(tpl, ha * 0.45));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---- 2) chromatic-aberration core (Siri-style spectral fringe) ----
  // Tiny R/G/B offsets along a slowly rotating axis. Magnitude swells with energy.
  const split = 0.6 + energy * 1.8;
  const ang = t * 0.7 + ph;
  const ax = Math.cos(ang) * split;
  const ay = Math.sin(ang) * split;
  const coreR = swellR * 1.4 + 2;
  const coreA = (0.55 + 0.25 * breath) * (0.55 + energy * 0.45);
  const triad: Array<[number, number, string]> = [
    [ ax,  ay, `rgba(255, 90,140,${(coreA * 0.55).toFixed(3)})`], // R
    [-ax * 0.5,  ay * 0.5 + ax * 0.5, `rgba(120,255,180,${(coreA * 0.55).toFixed(3)})`], // G
    [-ax * 0.5, -ay * 0.5 - ax * 0.5, `rgba(120,180,255,${(coreA * 0.55).toFixed(3)})`], // B
  ];
  for (const [ox, oy, rgba] of triad) {
    const g = ctx.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, coreR);
    g.addColorStop(0, rgba);
    g.addColorStop(1, rgba.replace(/,[^,]+\)$/, ",0)"));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x + ox, y + oy, coreR, 0, TAU);
    ctx.fill();
  }

  // ---- 3) tinted body in the voice color, slightly eccentric ----
  {
    const bodyR = swellR + 4;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(eccAng + 0.7);
    ctx.scale(ecc, 1 / ecc);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, bodyR);
    g.addColorStop(0, repl(tpl, breathA * (0.55 + energy * 0.35)));
    g.addColorStop(0.45, repl(tpl, 0.28 + energy * 0.35));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // ---- 4) white-hot center — makes it read as light, not pigment ----
  {
    const hotR = Math.max(1.4, swellR * 0.55);
    const ha = 0.65 + energy * 0.35;
    const g = ctx.createRadialGradient(x, y, 0, x, y, hotR);
    g.addColorStop(0, `rgba(255,255,255,${ha.toFixed(3)})`);
    g.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, hotR, 0, TAU);
    ctx.fill();
  }

  // ---- 5) trigger flash bloom (decays via caller's energy) ----
  if (energy > 0.02) {
    const flR = swellR * 3.2 + 14;
    const g = ctx.createRadialGradient(x, y, 0, x, y, flR);
    g.addColorStop(0, repl(tpl, 0.5 * energy));
    g.addColorStop(0.5, repl(tpl, 0.18 * energy));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, flR, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = prevOp;
}

/** Convert a hue [0..1] into the same oklch template the wheel uses. */
export function hueToOrbTpl(hue: number, light = 0.84, chroma = 0.17): string {
  const deg = ((hue % 1) + 1) % 1 * 360;
  return `oklch(${light.toFixed(3)} ${chroma.toFixed(3)} ${deg.toFixed(1)} / a)`;
}