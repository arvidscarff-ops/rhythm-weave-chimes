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
  // Caller's `radius` is treated as the old baseline; we lift it ~40% so the
  // cluster reads as a clearly bigger orb without touching call sites.
  const baseR = Math.max(2, (opts.radius ?? 4) * 1.4);
  const energy = Math.max(0, Math.min(1.4, opts.energy ?? 0));
  const t = opts.time ?? 0;
  const ph = opts.phase ?? 0;
  const haloAmt = Math.max(0, Math.min(1, opts.haloAmount ?? 1));
  const tpl = opts.colorTpl;

  // Cluster outer radius — what the eye reads as the orb's size.
  const R = baseR * (1 + 0.10 * Math.sin(t * 0.6 + ph)) + energy * 5;

  const prevOp = ctx.globalCompositeOperation;
  ctx.globalCompositeOperation = "lighter";

  // ---- 1) thin colored halo (keeps it grounded in the voice color) ----
  if (haloAmt > 0.01) {
    const haloR = R * 2.2 + 8;
    const ha = (0.04 + 0.03 * (0.5 + 0.5 * Math.sin(t * 0.6 + ph))) * haloAmt;
    const g = ctx.createRadialGradient(x, y, 0, x, y, haloR);
    g.addColorStop(0, repl(tpl, ha));
    g.addColorStop(0.5, repl(tpl, ha * 0.45));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, haloR, 0, TAU);
    ctx.fill();
  }

  // ---- helper: draw one soft dot (white-hot core → voice-color edge) ----
  const drawDot = (dx: number, dy: number, dr: number, alpha: number) => {
    if (dr < 0.4 || alpha < 0.01) return;
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, dr);
    g.addColorStop(0, `rgba(255,255,255,${(alpha).toFixed(3)})`);
    g.addColorStop(0.55, repl(tpl, alpha * 0.75));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, TAU);
    ctx.fill();
  };

  // ---- 2) outer dot ring (14 dots, clockwise drift, organic in/out) ----
  const N_OUT = 14;
  const dotR = R * 0.32;
  const spin = t * 0.35 + ph;
  for (let i = 0; i < N_OUT; i++) {
    const a = (i / N_OUT) * TAU + spin;
    const breathe = 1 + 0.18 * Math.sin(t * 1.2 + i * 1.7 + ph);
    const rr = R * breathe;
    const dx = x + Math.cos(a) * rr;
    const dy = y + Math.sin(a) * rr;
    const alpha = (0.55 + 0.35 * Math.sin(t * 0.9 + i + ph)) * (0.85 + energy * 0.4);
    drawDot(dx, dy, dotR, alpha);
  }

  // ---- 3) inner counter-rotating ring (8 dots, half speed, opposite dir) ----
  const N_IN = 8;
  const innerR = R * 0.55;
  const innerDotR = R * 0.26;
  const innerSpin = -t * 0.18 + ph * 1.3;
  for (let i = 0; i < N_IN; i++) {
    const a = (i / N_IN) * TAU + innerSpin;
    const breathe = 1 + 0.22 * Math.sin(t * 1.4 - i * 1.3 + ph * 0.7);
    const rr = innerR * breathe;
    const dx = x + Math.cos(a) * rr;
    const dy = y + Math.sin(a) * rr;
    const alpha = (0.5 + 0.4 * Math.sin(t * 1.1 - i + ph)) * (0.9 + energy * 0.4);
    drawDot(dx, dy, innerDotR, alpha);
  }

  // ---- 4) soft white-hot core — unifies the cluster into one orb ----
  {
    const hotR = Math.max(2, R * 0.5);
    const ha = 0.55 + energy * 0.4;
    const g = ctx.createRadialGradient(x, y, 0, x, y, hotR);
    g.addColorStop(0, `rgba(255,255,255,${ha.toFixed(3)})`);
    g.addColorStop(0.6, repl(tpl, 0.35 + energy * 0.3));
    g.addColorStop(1, repl(tpl, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, hotR, 0, TAU);
    ctx.fill();
  }

  ctx.globalCompositeOperation = prevOp;
}

/** Convert a hue [0..1] into the same oklch template the wheel uses. */
export function hueToOrbTpl(hue: number, light = 0.84, chroma = 0.17): string {
  const deg = ((hue % 1) + 1) % 1 * 360;
  return `oklch(${light.toFixed(3)} ${chroma.toFixed(3)} ${deg.toFixed(1)} / a)`;
}