// Seed-driven organic light bursts. Each one renders a tiny domain-warped
// noise sprite (same recipe as the NeuralNoise background) into an offscreen
// canvas at spawn, then blits it additively for its lifetime.

import {
  loadNeuralSettings,
  presetById,
  subscribeNeuralSettings,
  type NeuralSettings,
} from "@/lib/neural/palette";

type Bloom = {
  alive: boolean;
  x: number; y: number;
  age: number;
  maxAge: number;
  energy: number;
  hue: number;
  r: number; g: number; b: number;
  // seed-driven jitter
  rot: number;            // sprite rotation
  scale: number;          // base sprite scale (multiplied by burst radius)
  ecc: number;            // halo eccentricity (>=1)
  eccAng: number;         // eccentricity axis
  offX: number; offY: number; // center asymmetry
  coreAng: number;        // chromatic split direction
  sprite: HTMLCanvasElement | null;
  spriteR: number;        // half-size of sprite in scene px
};

const MAX_BLOOMS = 10;
const SPRITE_PX = 96;
const blooms: Bloom[] = Array.from({ length: MAX_BLOOMS }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, energy: 1, hue: 0,
  r: 1, g: 1, b: 1, rot: 0, scale: 1, ecc: 1, eccAng: 0,
  offX: 0, offY: 0, coreAng: 0, sprite: null, spriteR: 0,
}));
let cursor = 0;

// --- Neural settings hookup (hue bias from active preset) ---
let neural: NeuralSettings | null = null;
if (typeof window !== "undefined") {
  neural = loadNeuralSettings();
  subscribeNeuralSettings((s) => { neural = s; });
}
function neuralHueBias(): number {
  if (!neural) return 0;
  const p = presetById(neural.presetId);
  // convert preset RGB to a hue-ish angle for the phosphor palette
  const [r, g, b] = p.color;
  return Math.atan2(g - b, r - g) + Math.PI; // 0..2π-ish
}

// --- PRNG + noise ---
function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number, seed: number) {
  let h = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return h - Math.floor(h);
}
function smoothstep(t: number) { return t * t * (3 - 2 * t); }
function vnoise(x: number, y: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi,        yf = y - yi;
  const a = hash2(xi,     yi,     seed);
  const b = hash2(xi + 1, yi,     seed);
  const c = hash2(xi,     yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  const u = smoothstep(xf), v = smoothstep(yf);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}
function fbm(x: number, y: number, seed: number) {
  let amp = 0.55, freq = 1.0, sum = 0;
  for (let i = 0; i < 3; i++) {
    sum += amp * vnoise(x * freq, y * freq, seed + i * 19.7);
    freq *= 2.05; amp *= 0.55;
  }
  return sum;
}

// --- Phosphor palette (light-biased: floor lifted so no channel goes dark) ---
function phosphorColor(s: number): [number, number, number] {
  // Tint around white. Each channel sits in ~[0.78, 1.0], so the bloom always
  // reads as "light with a hue" rather than a saturated dark color.
  let r = 0.88 + 0.12 * Math.cos(s);
  let g = 0.88 + 0.12 * Math.cos(s + 1.0);
  let b = 0.88 + 0.12 * Math.cos(s + 8.0);
  // Normalize toward the brightest channel so the overall luminance stays high.
  const m = Math.max(r, g, b);
  if (m > 0) { const k = 1 / m; r *= k; g *= k; b *= k; }
  // Pull back toward white a touch for that "incandescent" feel.
  const w = 0.35;
  return [r * (1 - w) + w, g * (1 - w) + w, b * (1 - w) + w];
}

// --- Sprite renderer: domain-warped noise → phosphor colorize → RGBA ---
function renderSprite(seed: number, hue: number, energy: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = SPRITE_PX; c.height = SPRITE_PX;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const img = ctx.createImageData(SPRITE_PX, SPRITE_PX);
  const data = img.data;
  const rnd = mulberry32(Math.floor(seed * 1e6));
  const warpScale = 1.6 + rnd() * 1.2;
  const warpAmt = 0.8 + rnd() * 0.9;
  const baseScale = 2.4 + rnd() * 1.4;
  const threshold = 0.32 + rnd() * 0.18;
  const filaments = 0.55 + rnd() * 0.4;
  const cx = SPRITE_PX / 2, cy = SPRITE_PX / 2;
  const invR = 1 / (SPRITE_PX * 0.5);

  for (let y = 0; y < SPRITE_PX; y++) {
    for (let x = 0; x < SPRITE_PX; x++) {
      const dx = (x - cx) * invR;
      const dy = (y - cy) * invR;
      const rr = Math.sqrt(dx * dx + dy * dy);
      const i = (y * SPRITE_PX + x) * 4;
      if (rr > 1.05) { data[i + 3] = 0; continue; }
      const px = dx * baseScale, py = dy * baseScale;
      // domain warp
      const wx = fbm(px + 5.2, py + 1.3, seed) * 2 - 1;
      const wy = fbm(px + 9.1, py + 7.7, seed + 3.3) * 2 - 1;
      const n = fbm(px + wx * warpAmt * warpScale, py + wy * warpAmt * warpScale, seed + 1.7);
      // filament contour
      const fil = Math.pow(Math.max(0, n - threshold) / (1 - threshold), 1.4);
      // radial soft mask
      const mask = Math.pow(1 - Math.min(1, rr), 1.6);
      const v = fil * mask * filaments * (0.7 + 0.6 * energy);
      if (v < 0.005) { data[i + 3] = 0; continue; }
      // Emissive-only: keep RGB pinned to a bright tint so the additive
      // blit never deposits dark colored pigment. Noise drives ALPHA only,
      // and bright cores lift the tint all the way to white-hot.
      const [r, g, b] = phosphorColor(hue + n * 1.4 + rr * 0.6);
      const hot = Math.min(1, v * 1.8);
      const rr2 = r * (1 - hot) + 1 * hot;
      const gg2 = g * (1 - hot) + 1 * hot;
      const bb2 = b * (1 - hot) + 1 * hot;
      data[i]     = Math.round(rr2 * 255);
      data[i + 1] = Math.round(gg2 * 255);
      data[i + 2] = Math.round(bb2 * 255);
      data[i + 3] = Math.min(255, Math.round(Math.min(1, v * 1.35) * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

const reduced = typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(): Bloom {
  // prefer dead slots; otherwise overwrite oldest
  for (let i = 0; i < MAX_BLOOMS; i++) {
    const b = blooms[(cursor + i) % MAX_BLOOMS];
    if (!b.alive) { cursor = (cursor + i + 1) % MAX_BLOOMS; return b; }
  }
  let oldest = blooms[0];
  for (const b of blooms) if (b.age / b.maxAge > oldest.age / oldest.maxAge) oldest = b;
  return oldest;
}

export type BurstOptions = {
  hue?: number;     // 0..1
  energy?: number;  // 0..1, gain-like
};

export function spawnBurst(x: number, y: number, opts: BurstOptions = {}) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  const energy = Math.max(0.25, Math.min(1.2, opts.energy ?? 0.7));
  const seed = Math.random();
  const rnd = mulberry32(Math.floor(seed * 1e9));
  const hue = ((opts.hue ?? rnd()) * Math.PI * 2) + neuralHueBias() * 0.45 + rnd() * 0.9;

  const b = pick();
  b.alive = true;
  b.x = x; b.y = y;
  b.age = 0;
  b.maxAge = (0.85 + 0.25 * energy) * (0.85 + rnd() * 0.3);
  b.energy = energy;
  b.hue = hue;
  const [r, g, bl] = phosphorColor(hue);
  b.r = r; b.g = g; b.b = bl;
  b.rot = rnd() * Math.PI * 2;
  b.scale = 0.85 + rnd() * 0.55;
  b.ecc = 1.0 + rnd() * 0.25;
  b.eccAng = rnd() * Math.PI;
  b.offX = (rnd() - 0.5) * 6;
  b.offY = (rnd() - 0.5) * 6;
  b.coreAng = rnd() * Math.PI * 2;
  b.sprite = reduced ? null : renderSprite(seed, hue, energy);
  b.spriteR = (40 + 70 * energy) * b.scale;
}

export function updateBursts(dt: number) {
  if (dt <= 0) return;
  for (const b of blooms) {
    if (!b.alive) continue;
    b.age += dt;
    if (b.age >= b.maxAge) b.alive = false;
  }
}

// envelope: fast attack, eased release
function envelope(t: number, attack: number, sustain: number) {
  if (t < attack) {
    const k = t / attack;
    return k * k * (3 - 2 * k); // smoothstep
  }
  const k = Math.max(0, (1 - (t - attack) / Math.max(1e-3, sustain)));
  return k * k; // ease-out cubic-ish
}

export function drawBursts(ctx: CanvasRenderingContext2D) {
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";

  for (const b of blooms) {
    if (!b.alive) continue;
    const t = b.age;
    const energy = b.energy;
    const R = Math.round(b.r * 255);
    const G = Math.round(b.g * 255);
    const B = Math.round(b.b * 255);

    // ---- Halo (dominant silhouette, slight eccentricity) ----
    const haloLife = envelope(t, 0.12, 0.75);
    if (haloLife > 0.001) {
      const baseR = 36 + 60 * energy;
      const radius = baseR * (1 + (t / b.maxAge) * 0.55) * (0.85 + b.scale * 0.25);
      const a = haloLife * 0.5;
      ctx.save();
      ctx.translate(b.x + b.offX * 0.4, b.y + b.offY * 0.4);
      ctx.rotate(b.eccAng);
      ctx.scale(b.ecc, 1 / b.ecc);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      grad.addColorStop(0.25, `rgba(${R},${G},${B},${a * 0.55})`);
      grad.addColorStop(0.6, `rgba(${R},${G},${B},${a * 0.18})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- Core flash with chromatic-aberration triad (seeded direction) ----
    const coreLife = envelope(t, 0.05, 0.22);
    if (coreLife > 0.001) {
      const cx0 = b.x + b.offX;
      const cy0 = b.y + b.offY;
      const coreR = (4 + 10 * energy) * (0.85 + coreLife * 0.4);
      const a = coreLife * 0.85;
      const ca = b.coreAng;
      const splitMag = 1.4 + (1 - coreLife) * 0.8;
      const offsets: Array<[number, number, string]> = [
        [Math.cos(ca)             * splitMag, Math.sin(ca)             * splitMag,
          `rgba(255,${Math.round(60 + G * 0.2)},${Math.round(60 + B * 0.2)},${a * 0.7})`],
        [Math.cos(ca + 2.094)     * splitMag, Math.sin(ca + 2.094)     * splitMag,
          `rgba(${Math.round(60 + R * 0.2)},255,${Math.round(60 + B * 0.2)},${a * 0.7})`],
        [Math.cos(ca + 4.188)     * splitMag, Math.sin(ca + 4.188)     * splitMag,
          `rgba(${Math.round(60 + R * 0.2)},${Math.round(60 + G * 0.2)},255,${a * 0.7})`],
      ];
      for (const [ox, oy, color] of offsets) {
        const grad = ctx.createRadialGradient(cx0 + ox, cy0 + oy, 0, cx0 + ox, cy0 + oy, coreR);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color.replace(/,[^,]+\)$/, ",0)"));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx0 + ox, cy0 + oy, coreR, 0, Math.PI * 2);
        ctx.fill();
      }
      const wa = coreLife * 0.85;
      const wgrad = ctx.createRadialGradient(cx0, cy0, 0, cx0, cy0, coreR * 0.7);
      wgrad.addColorStop(0, `rgba(255,255,255,${wa})`);
      wgrad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = wgrad;
      ctx.beginPath();
      ctx.arc(cx0, cy0, coreR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Noise-cloud sprite (organic filaments) ----
    const spriteLife = envelope(t, 0.08, 0.88);
    if (spriteLife > 0.001 && b.sprite) {
      const grow = 1 + (t / b.maxAge) * 0.35;
      const size = b.spriteR * 2 * grow;
      ctx.save();
      ctx.globalAlpha = Math.min(1, spriteLife * 0.85);
      ctx.translate(b.x + b.offX, b.y + b.offY);
      ctx.rotate(b.rot + t * 0.25);
      ctx.drawImage(b.sprite, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
  }

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}