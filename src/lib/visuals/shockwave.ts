// Note-triggered shockwave rings. Game-juice layer: every note births a
// quick expanding tinted ring (with a faint trailing echo) that rides on
// top of bursts/flares. Additive, organic, note-colored, very cheap.

import { flashBus, type NeuralFlash } from "@/lib/neural/flashBus";
import {
  loadNeuralSettings,
  subscribeNeuralSettings,
  presetById,
  type NeuralSettings,
} from "@/lib/neural/palette";

type Ring = {
  alive: boolean;
  x: number; y: number;        // normalized 0..1
  age: number;
  maxAge: number;
  energy: number;
  hue: number | null;
  echo: boolean;               // trailing softer ring
  wobble: number;              // organic radius modulation amount
  seed: number;
};

const MAX_RINGS = 32;
const rings: Ring[] = Array.from({ length: MAX_RINGS }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, energy: 0,
  hue: null, echo: false, wobble: 0, seed: 0,
}));
let cursor = 0;

let neural: NeuralSettings | null = null;
if (typeof window !== "undefined") {
  neural = loadNeuralSettings();
  subscribeNeuralSettings((s) => { neural = s; });
}

const reducedMotion =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function pick(): Ring {
  for (let i = 0; i < MAX_RINGS; i++) {
    const idx = (cursor + i) % MAX_RINGS;
    if (!rings[idx].alive) { cursor = (idx + 1) % MAX_RINGS; return rings[idx]; }
  }
  const r = rings[cursor];
  cursor = (cursor + 1) % MAX_RINGS;
  return r;
}

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

function ringColor(r: Ring): [number, number, number] {
  if (r.hue != null) return hslToRgb(r.hue, 0.75, 0.7);
  if (!neural) return [0.85, 0.95, 1];
  const p = presetById(neural.presetId);
  const a = p.color;
  const b = p.colorB ?? a;
  return [
    Math.min(1, Math.max(a[0], b[0]) * 0.6 + 0.4),
    Math.min(1, Math.max(a[1], b[1]) * 0.6 + 0.4),
    Math.min(1, Math.max(a[2], b[2]) * 0.6 + 0.4),
  ];
}

function spawn(f: NeuralFlash) {
  if (reducedMotion) return;
  const seed = (Math.floor(f.t) ^ Math.floor(f.x * 7919) ^ Math.floor(f.y * 6151)) >>> 0;
  const energy = 0.55 + f.intensity * 0.45;

  const r = pick();
  r.alive = true;
  r.x = f.x; r.y = f.y;
  r.age = 0;
  r.maxAge = 1.6 + energy * 1.2;          // slower, longer life
  r.energy = energy;
  r.hue = typeof f.hue === "number" ? f.hue : null;
  r.echo = false;
  r.wobble = 0.02 + (energy - 0.55) * 0.03; // gentler wobble
  r.seed = seed;

  // Echo ring for big hits
  if (energy > 0.75) {
    const e = pick();
    e.alive = true;
    e.x = f.x; e.y = f.y;
    e.age = -0.06;            // slight delay
    e.maxAge = 1.05;
    e.energy = energy * 0.7;
    e.hue = r.hue;
    e.echo = true;
    e.wobble = r.wobble * 1.3;
    e.seed = seed ^ 0x9e3779b9;
  }
}

if (typeof window !== "undefined") {
  flashBus.subscribe(spawn);
}

export function updateShockwaves(dt: number) {
  for (let i = 0; i < MAX_RINGS; i++) {
    const r = rings[i];
    if (!r.alive) continue;
    r.age += dt;
    if (r.age >= r.maxAge) r.alive = false;
  }
}

// ease-out expo for radius (snappy attack, soft tail)
function easeOutExpo(t: number) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function drawShockwaves(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const opacity = neural ? neural.opacity : 0.22;
  const globalMul = Math.max(0.45, Math.min(1.3, 0.45 + opacity * 2.2));
  const minDim = Math.min(W, H);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < MAX_RINGS; i++) {
    const r = rings[i];
    if (!r.alive || r.age < 0) continue;
    const t = r.age / r.maxAge;
    if (t >= 1) continue;

    const radius = easeOutExpo(t) * minDim * (0.07 + r.energy * 0.09) * (r.echo ? 1.2 : 1);
    // alpha: quick rise, long fade
    const fade = Math.pow(1 - t, 2.2);
    const baseA = (r.echo ? 0.10 : 0.18) * fade * globalMul;
    if (baseA < 0.003) continue;

    const [cr, cg, cb] = ringColor(r);
    const R = Math.round(cr * 255);
    const G = Math.round(cg * 255);
    const B = Math.round(cb * 255);

    const cx = r.x * W;
    const cy = r.y * H;

    // organic wobble: draw as a short stitched arc strip with tiny radius noise
    const segments = 36;
    const lineW = (1.4 + r.energy * 2.2) * (1 - t * 0.6);
    ctx.lineWidth = Math.max(0.5, lineW);
    ctx.strokeStyle = `rgba(${R},${G},${B},${baseA})`;
    ctx.beginPath();
    for (let s = 0; s <= segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      // cheap deterministic wobble using sines seeded by ring
      const w = 1 + Math.sin(a * 3 + r.seed * 0.013) * r.wobble * (1 - t)
                  + Math.cos(a * 5 + r.seed * 0.027) * r.wobble * 0.5;
      const rr = radius * w;
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Soft outer glow halo (wider, stronger for light bloom)
    if (fade > 0.12) {
      const glowR = radius * (r.echo ? 2.0 : 2.6);
      const grad = ctx.createRadialGradient(cx, cy, radius * 0.7, cx, cy, glowR);
      const ga = baseA * 1.6; // stronger glow alpha
      grad.addColorStop(0, `rgba(${R},${G},${B},${ga * 0.9})`);
      grad.addColorStop(0.35, `rgba(${R},${G},${B},${ga * 0.45})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}