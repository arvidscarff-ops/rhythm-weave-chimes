// Phosphor-inspired additive particle bursts triggered on note hits.
// Pixel-aligned with the scene canvas; cheap 2D additive sprites.

type Particle = {
  alive: boolean;
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  r: number; g: number; b: number;
  flash: boolean;
};

const POOL = 480;
const MAX_BURSTS = 12;
const pool: Particle[] = Array.from({ length: POOL }, () => ({
  alive: false, x: 0, y: 0, vx: 0, vy: 0,
  life: 0, maxLife: 1, size: 1, r: 1, g: 1, b: 1, flash: false,
}));
let cursor = 0;
let burstCount = 0;

const reduced = typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(): Particle {
  for (let i = 0; i < POOL; i++) {
    const p = pool[(cursor + i) % POOL];
    if (!p.alive) { cursor = (cursor + i + 1) % POOL; return p; }
  }
  const p = pool[cursor]; cursor = (cursor + 1) % POOL; return p;
}

// Phosphor palette: cos(s + vec4(0,1,8,0)) → iridescent cyan/magenta/amber
function phosphorColor(s: number, t: [number, number, number]) {
  // r=cos(s), g=cos(s+1), b=cos(s+8) mapped [-1,1] -> [0.15,1]
  const r = 0.575 + 0.425 * Math.cos(s);
  const g = 0.575 + 0.425 * Math.cos(s + 1.0);
  const b = 0.575 + 0.425 * Math.cos(s + 8.0);
  t[0] = r; t[1] = g; t[2] = b;
}

export type BurstOptions = {
  /** 0..1 hue-ish phase; usually derived from ring/slot index */
  hue?: number;
  /** 0..1 loudness; scales count, size, speed */
  energy?: number;
};

export function spawnBurst(x: number, y: number, opts: BurstOptions = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (burstCount >= MAX_BURSTS) {
    // age out the oldest alive particles slightly faster
    for (const p of pool) if (p.alive) p.life = Math.min(p.life, p.maxLife * 0.35);
  }
  burstCount = Math.min(MAX_BURSTS, burstCount + 1);

  const energy = Math.max(0.25, Math.min(1.2, opts.energy ?? 0.7));
  const hue = (opts.hue ?? Math.random()) * Math.PI * 2;

  if (reduced) {
    const p = pick();
    p.alive = true; p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.maxLife = 0.55; p.life = p.maxLife;
    p.size = 22 * energy;
    const rgb: [number, number, number] = [1, 1, 1];
    phosphorColor(hue, rgb);
    p.r = rgb[0]; p.g = rgb[1]; p.b = rgb[2]; p.flash = true;
    return;
  }

  // Central flash core
  {
    const p = pick();
    p.alive = true; p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.maxLife = 0.22 + 0.12 * energy; p.life = p.maxLife;
    p.size = 14 + 26 * energy;
    const rgb: [number, number, number] = [1, 1, 1];
    phosphorColor(hue, rgb);
    p.r = rgb[0]; p.g = rgb[1]; p.b = rgb[2]; p.flash = true;
  }

  const count = Math.round(12 + 12 * energy);
  const baseSpeed = 60 + 140 * energy;
  const baseLife = 0.62 + 0.32 * energy;

  for (let i = 0; i < count; i++) {
    const p = pick();
    p.alive = true;
    p.x = x; p.y = y;
    // jittered direction with a tiny curl tangent
    const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.55;
    const sp = baseSpeed * (0.55 + Math.random() * 0.75);
    const curl = (Math.random() - 0.5) * 0.6;
    const ca = a + curl;
    p.vx = Math.cos(ca) * sp;
    p.vy = Math.sin(ca) * sp;
    p.maxLife = baseLife * (0.7 + Math.random() * 0.6);
    p.life = p.maxLife;
    p.size = 2.4 + Math.random() * 3.4 * (0.6 + energy * 0.7);
    const rgb: [number, number, number] = [1, 1, 1];
    phosphorColor(hue + a * 0.45 + Math.random() * 0.6, rgb);
    p.r = rgb[0]; p.g = rgb[1]; p.b = rgb[2]; p.flash = false;
  }
}

export function updateBursts(dt: number) {
  if (dt <= 0) return;
  const drag = Math.exp(-dt * 2.6); // ease-out deceleration
  let anyAlive = false;
  for (const p of pool) {
    if (!p.alive) continue;
    p.life -= dt;
    if (p.life <= 0) { p.alive = false; continue; }
    p.vx *= drag; p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    anyAlive = true;
  }
  if (!anyAlive) burstCount = 0;
}

export function drawBursts(ctx: CanvasRenderingContext2D) {
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";
  for (const p of pool) {
    if (!p.alive) continue;
    const k = Math.max(0, p.life / p.maxLife); // 1 -> 0
    // ease-out cubic alpha
    const a = (k * k) * (p.flash ? 0.9 : 0.55);
    const radius = p.size * (p.flash ? (1.0 + (1 - k) * 0.4) : (0.4 + k * 1.1));
    const r = Math.round(p.r * 255);
    const g = Math.round(p.g * 255);
    const b = Math.round(p.b * 255);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
    grad.addColorStop(0, `rgba(${r},${g},${b},${a})`);
    grad.addColorStop(0.45, `rgba(${r},${g},${b},${a * 0.35})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}