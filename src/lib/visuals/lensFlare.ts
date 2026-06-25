// Organic, subtle, note-tinted lens flare overlay.
// Subscribes to flashBus: every note emits a quiet "breath" of light that
// inherits the note's hue. No rectangles — soft elliptical halos, hand-drawn
// bezier filaments, and the rare ghost orb when energy is high.

import { flashBus, type NeuralFlash } from "@/lib/neural/flashBus";
import {
  loadNeuralSettings,
  subscribeNeuralSettings,
  presetById,
  type NeuralSettings,
} from "@/lib/neural/palette";

type Flare = {
  alive: boolean;
  x: number;        // normalized 0..1
  y: number;        // normalized 0..1
  age: number;
  maxAge: number;
  energy: number;
  hue: number | null; // 0..1 if note carried color
  seed: number;
  angle: number;      // base ellipse rotation
  rotDrift: number;   // radians over lifetime
  aspect: number;     // ellipse aspect (1..2.4)
  filamentCount: number;
};

const MAX_FLARES = 24;
const flares: Flare[] = Array.from({ length: MAX_FLARES }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, energy: 0,
  hue: null, seed: 0, angle: 0, rotDrift: 0, aspect: 1.6, filamentCount: 3,
}));
let cursor = 0;

let neural: NeuralSettings | null = null;
if (typeof window !== "undefined") {
  neural = loadNeuralSettings();
  subscribeNeuralSettings((s) => { neural = s; });
}

function paletteRGB(): [number, number, number] {
  if (!neural) return [0.85, 0.95, 1];
  const p = presetById(neural.presetId);
  const a = p.color;
  const b = p.colorB ?? a;
  const mix: [number, number, number] = [
    Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2]),
  ];
  const lift = 0.5;
  return [
    Math.min(1, mix[0] * (1 - lift) + lift),
    Math.min(1, mix[1] * (1 - lift) + lift),
    Math.min(1, mix[2] * (1 - lift) + lift),
  ];
}

// HSL -> RGB (h,s,l in 0..1), returning floats 0..1
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

const reducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(): Flare {
  for (let i = 0; i < MAX_FLARES; i++) {
    const idx = (cursor + i) % MAX_FLARES;
    if (!flares[idx].alive) { cursor = (idx + 1) % MAX_FLARES; return flares[idx]; }
  }
  const f = flares[cursor];
  cursor = (cursor + 1) % MAX_FLARES;
  return f;
}

function spawnFromFlash(f: NeuralFlash) {
  if (reducedMotion) return;
  const fl = pick();
  const seed = (Math.floor(f.t) ^ Math.floor(f.x * 9301) ^ Math.floor(f.y * 4937)) >>> 0;
  const rnd = mulberry32(seed);
  fl.alive = true;
  fl.x = f.x;
  fl.y = f.y;
  fl.age = 0;
  fl.maxAge = 1.1 + rnd() * 0.7;             // 1.1..1.8s — longer, gentler
  fl.energy = 0.5 + f.intensity * 0.5;
  fl.hue = typeof f.hue === "number" ? f.hue : null;
  fl.seed = seed;
  fl.angle = rnd() * Math.PI * 2;            // any direction, not just horizontal
  fl.rotDrift = (rnd() - 0.5) * 0.5;         // ±~0.25 rad over life
  fl.aspect = 1.2 + rnd() * 1.2;             // 1.2..2.4
  fl.filamentCount = 3 + Math.floor(rnd() * 3); // 3..5
}

if (typeof window !== "undefined") {
  flashBus.subscribe(spawnFromFlash);
}

export function updateFlares(dt: number) {
  for (let i = 0; i < MAX_FLARES; i++) {
    const fl = flares[i];
    if (!fl.alive) continue;
    fl.age += dt;
    if (fl.age >= fl.maxAge) fl.alive = false;
  }
}

// fast attack, long eased release
function envelope(t: number) {
  const attack = 0.1;
  if (t < attack) {
    const u = t / attack;
    return u * u * (3 - 2 * u); // smoothstep up
  }
  const r = (t - attack) / (1 - attack);
  const e = 1 - r;
  return e * e * e;
}

function rgba(c: [number, number, number], a: number) {
  const r = Math.round(Math.max(0, Math.min(1, c[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, c[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, c[2])) * 255);
  return `rgba(${r},${g},${b},${a})`;
}

function flareColor(fl: Flare): [number, number, number] {
  if (fl.hue != null) {
    // pastel, light-biased so additive blending reads as "light, tinted"
    return hslToRgb(fl.hue, 0.7, 0.72);
  }
  return paletteRGB();
}

export function drawFlares(ctx: CanvasRenderingContext2D, W: number, H: number) {
  // Master intensity follows the Visuals → Glow slider so the user always has
  // the master knob. Kept conservative on purpose.
  const opacity = neural ? neural.opacity : 0.22;
  const globalMul = Math.max(0.12, Math.min(0.7, opacity * 1.6));

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < MAX_FLARES; i++) {
    const fl = flares[i];
    if (!fl.alive) continue;
    const t = fl.age / fl.maxAge;
    const env = envelope(t);
    if (env <= 0.002) continue;

    const px = fl.x * W;
    const py = fl.y * H;
    const e = fl.energy * env * globalMul;
    const col = flareColor(fl);
    const angle = fl.angle + fl.rotDrift * t;
    const rnd = mulberry32(fl.seed);

    // --- Soft elliptical halo (organic — no rectangles) ---
    const haloR = 32 + fl.energy * 55;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.scale(fl.aspect, 1);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
    halo.addColorStop(0, rgba(col, 0.18 * e));
    halo.addColorStop(0.45, rgba(col, 0.06 * e));
    halo.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, haloR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Whisper-soft core ---
    const coreR = 5 + fl.energy * 7;
    const core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
    core.addColorStop(0, rgba([1, 1, 1], 0.4 * e));
    core.addColorStop(0.6, rgba(col, 0.18 * e));
    core.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(px, py, coreR, 0, Math.PI * 2);
    ctx.fill();

    // --- Hand-drawn bezier filaments drifting outward ---
    const drift = 1 + t * 0.35; // filaments breathe outward over life
    const baseLen = (40 + fl.energy * 70) * drift;
    ctx.lineCap = "round";
    for (let f = 0; f < fl.filamentCount; f++) {
      const a = angle + (rnd() - 0.5) * Math.PI * 0.9;
      const len = baseLen * (0.7 + rnd() * 0.7);
      const curve = (rnd() - 0.5) * len * 0.6;
      const perpX = -Math.sin(a);
      const perpY = Math.cos(a);
      const ex = px + Math.cos(a) * len;
      const ey = py + Math.sin(a) * len;
      const mx = (px + ex) * 0.5 + perpX * curve;
      const my = (py + ey) * 0.5 + perpY * curve;
      const alpha = (0.045 + rnd() * 0.04) * e;
      ctx.strokeStyle = rgba(col, alpha);
      ctx.lineWidth = 0.6 + rnd() * 0.8;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(mx, my, ex, ey);
      ctx.stroke();
    }

    // --- Rare ghost orb on the brightest hits only ---
    if (fl.energy > 0.85 && env > 0.4) {
      const ga = angle + Math.PI; // opposite the main lean
      const gd = 60 + rnd() * 60;
      const gx = px + Math.cos(ga) * gd;
      const gy = py + Math.sin(ga) * gd;
      const gR = 14 + rnd() * 18;
      const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gR);
      gg.addColorStop(0, rgba(col, 0.08 * e));
      gg.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(gx, gy, gR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
