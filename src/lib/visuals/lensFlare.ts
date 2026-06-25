// Reactive abstract lens flare overlay. Subscribes to flashBus so every
// note trigger across Wheel / Pendulum / Bars produces an answering flare:
// anamorphic streak + chromatic core + ghost orbs along the optical axis +
// soft iris halo. Palette-coherent with the active NeuralPreset.

import { flashBus, type NeuralFlash } from "@/lib/neural/flashBus";
import {
  loadNeuralSettings,
  subscribeNeuralSettings,
  presetById,
  type NeuralSettings,
} from "@/lib/neural/palette";

type Flare = {
  alive: boolean;
  x: number;
  y: number;
  age: number;
  maxAge: number;
  energy: number;
  hueJitter: number;
  seed: number;
  ghostCount: number;
  streakAspect: number;
};

const MAX_FLARES = 24;
const flares: Flare[] = Array.from({ length: MAX_FLARES }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, energy: 0,
  hueJitter: 0, seed: 0, ghostCount: 2, streakAspect: 9,
}));
let cursor = 0;

let neural: NeuralSettings | null = null;
if (typeof window !== "undefined") {
  neural = loadNeuralSettings();
  subscribeNeuralSettings((s) => { neural = s; });
}

function paletteRGB(): [number, number, number] {
  if (!neural) return [0.7, 0.95, 1];
  const p = presetById(neural.presetId);
  const a = p.color;
  const b = p.colorB ?? a;
  const mix: [number, number, number] = [
    Math.max(a[0], b[0]),
    Math.max(a[1], b[1]),
    Math.max(a[2], b[2]),
  ];
  const lift = 0.45;
  return [
    Math.min(1, mix[0] * (1 - lift) + lift),
    Math.min(1, mix[1] * (1 - lift) + lift),
    Math.min(1, mix[2] * (1 - lift) + lift),
  ];
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

let pressure = 0;

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
  fl.maxAge = 0.85 + rnd() * 0.5;
  fl.energy = 0.55 + f.intensity * 0.6;
  fl.hueJitter = (rnd() - 0.5) * 0.3;
  fl.seed = seed;
  fl.ghostCount = 2 + Math.floor(rnd() * 2);
  fl.streakAspect = 7 + rnd() * 7;
  pressure = Math.min(1.4, pressure + 0.18 * f.intensity);
}

if (typeof window !== "undefined") {
  flashBus.subscribe(spawnFromFlash);
}

export function updateFlares(dt: number) {
  pressure = Math.max(0, pressure - dt * 0.9);
  for (let i = 0; i < MAX_FLARES; i++) {
    const fl = flares[i];
    if (!fl.alive) continue;
    fl.age += dt;
    if (fl.age >= fl.maxAge) fl.alive = false;
  }
}

function envelope(t: number) {
  const attack = 0.08;
  if (t < attack) return t / attack;
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

function tint(base: [number, number, number], j: number): [number, number, number] {
  return [
    Math.max(0, Math.min(1, base[0] + j)),
    Math.max(0, Math.min(1, base[1] - j * 0.5)),
    Math.max(0, Math.min(1, base[2] - j * 0.5)),
  ];
}

export function drawFlares(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const globalMul = neural ? Math.max(0.15, Math.min(1, neural.opacity * 3.2)) : 0.6;
  const baseCol = paletteRGB();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const cx = W * 0.5;
  const cy = H * 0.5;

  for (let i = 0; i < MAX_FLARES; i++) {
    const fl = flares[i];
    if (!fl.alive) continue;
    const t = fl.age / fl.maxAge;
    const env = envelope(t);
    if (env <= 0.001) continue;

    const px = fl.x * W;
    const py = fl.y * H;
    const e = fl.energy * env * globalMul;
    const pressBoost = 1 + pressure * 0.35;
    const col = tint(baseCol, fl.hueJitter);
    const colR: [number, number, number] = [1, col[1] * 0.7, col[2] * 0.6];
    const colG: [number, number, number] = [col[0] * 0.7, 1, col[2] * 0.7];
    const colB: [number, number, number] = [col[0] * 0.6, col[1] * 0.7, 1];

    const streakLen = Math.min(W * 0.55, 180 + fl.energy * 320 * pressBoost);
    const streakH = Math.max(2, streakLen / fl.streakAspect);
    const drawStreak = (color: [number, number, number], offset: number, alpha: number) => {
      const grad = ctx.createLinearGradient(px - streakLen, 0, px + streakLen, 0);
      grad.addColorStop(0, rgba(color, 0));
      grad.addColorStop(0.5, rgba(color, alpha));
      grad.addColorStop(1, rgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(px - streakLen, py - streakH / 2 + offset, streakLen * 2, streakH);
    };
    drawStreak(colR, -1, 0.18 * e);
    drawStreak(colG, 0, 0.22 * e);
    drawStreak(colB, 1, 0.18 * e);

    const haloR = 40 + fl.energy * 80 * pressBoost;
    const halo = ctx.createRadialGradient(px, py, 0, px, py, haloR);
    halo.addColorStop(0, rgba(col, 0.45 * e));
    halo.addColorStop(0.4, rgba(col, 0.12 * e));
    halo.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(px, py, haloR, 0, Math.PI * 2);
    ctx.fill();

    const coreR = 6 + fl.energy * 10;
    const core = ctx.createRadialGradient(px, py, 0, px, py, coreR);
    core.addColorStop(0, rgba([1, 1, 1], 0.85 * e));
    core.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(px, py, coreR, 0, Math.PI * 2);
    ctx.fill();

    const rnd = mulberry32(fl.seed);
    const dx = cx - px;
    const dy = cy - py;
    for (let g = 0; g < fl.ghostCount; g++) {
      const tg = 0.35 + g * 0.45 + (rnd() - 0.5) * 0.1;
      const gx = px + dx * tg;
      const gy = py + dy * tg;
      const gR = (10 + rnd() * 28) * (1 + pressure * 0.4);
      const gAlpha = (0.15 + rnd() * 0.18) * e;
      const gCol: [number, number, number] = g % 2 === 0 ? colB : colR;
      const gg = ctx.createRadialGradient(gx, gy, 0, gx, gy, gR);
      gg.addColorStop(0, rgba(gCol, gAlpha));
      gg.addColorStop(1, rgba(gCol, 0));
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(gx, gy, gR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
