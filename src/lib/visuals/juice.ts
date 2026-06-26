// Connective-tissue juice: cursor trail, echo ghosts that linger after each
// note, chord-coincidence harmony flares when multiple rings hit together,
// and an ambient first-run welcome so the stage is already alive on arrival.
//
// One subscriber to flashBus drives the ghosts + chord detector. Everything
// renders additively on the same 2D canvas as the bursts.

import { flashBus, type NeuralFlash } from "@/lib/neural/flashBus";
import { spawnBurst } from "@/lib/visuals/burstField";

// ---------- Cursor trail ----------

type TrailPt = { x: number; y: number; t: number };
const trail: TrailPt[] = [];
const TRAIL_LIFE = 0.55; // seconds
let lastPt: { x: number; y: number } | null = null;

if (typeof window !== "undefined") {
  const reduce =
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!reduce) {
    window.addEventListener(
      "pointermove",
      (e) => {
        const x = e.clientX;
        const y = e.clientY;
        const now = performance.now() / 1000;
        if (lastPt) {
          const dx = x - lastPt.x;
          const dy = y - lastPt.y;
          const d = Math.hypot(dx, dy);
          // sub-sample fast motion so the trail stays continuous
          const steps = Math.min(6, Math.max(1, Math.floor(d / 14)));
          for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            trail.push({
              x: lastPt.x + dx * k,
              y: lastPt.y + dy * k,
              t: now,
            });
          }
        } else {
          trail.push({ x, y, t: now });
        }
        lastPt = { x, y };
        // hard cap so cost stays trivial
        if (trail.length > 80) trail.splice(0, trail.length - 80);
      },
      { passive: true },
    );
  }
}

// ---------- Echo ghosts ----------

type Ghost = {
  alive: boolean;
  x: number; y: number;  // viewport-normalized
  age: number;
  maxAge: number;
  hue: number | null;
  energy: number;
};

const GHOSTS: Ghost[] = Array.from({ length: 36 }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, hue: null, energy: 0.6,
}));
let gCursor = 0;
function pickGhost(): Ghost {
  for (let i = 0; i < GHOSTS.length; i++) {
    const g = GHOSTS[(gCursor + i) % GHOSTS.length];
    if (!g.alive) { gCursor = (gCursor + i + 1) % GHOSTS.length; return g; }
  }
  const g = GHOSTS[gCursor];
  gCursor = (gCursor + 1) % GHOSTS.length;
  return g;
}

// ---------- Chord-coincidence detector ----------

type RecentFlash = NeuralFlash;
const recent: RecentFlash[] = [];
const COINCIDENCE_MS = 70;
let lastChordAt = 0;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)];
}

function hueMix(hs: number[]): number {
  // circular mean
  let sx = 0, sy = 0;
  for (const h of hs) {
    sx += Math.cos(h * Math.PI * 2);
    sy += Math.sin(h * Math.PI * 2);
  }
  const a = Math.atan2(sy, sx) / (Math.PI * 2);
  return (a + 1) % 1;
}

if (typeof window !== "undefined") {
  flashBus.subscribe((f) => {
    // Spawn an echo ghost at the flash point.
    const g = pickGhost();
    g.alive = true;
    g.x = f.x; g.y = f.y;
    g.age = 0;
    g.maxAge = 1.0 + f.intensity * 0.4;
    g.hue = typeof f.hue === "number" ? f.hue : null;
    g.energy = f.intensity;

    // Track for chord detection.
    const now = f.t;
    recent.push(f);
    // drop stale
    while (recent.length && now - recent[0].t > COINCIDENCE_MS) recent.shift();

    if (recent.length >= 2 && now - lastChordAt > 180) {
      // Centroid + mixed hue across the cluster.
      let cx = 0, cy = 0;
      const hues: number[] = [];
      for (const r of recent) {
        cx += r.x; cy += r.y;
        if (typeof r.hue === "number") hues.push(r.hue);
      }
      cx /= recent.length;
      cy /= recent.length;
      const mixed = hues.length ? hueMix(hues) : undefined;
      lastChordAt = now;
      // Note: don't re-emit flashBus.flash here (would recurse). Use raw bus
      // for the neural background hit, then spawn a burst directly so the
      // chord moment reads as a small magical bloom at the centroid.
      listenersBypass(cx, cy, 0.55 + 0.2 * Math.min(1, recent.length / 4), mixed);
    }
  });
}

// Tiny side-channel that mimics a flash for the neural shader only, without
// re-broadcasting via flashBus (which would feed back into this detector).
function listenersBypass(x: number, y: number, intensity: number, hue?: number) {
  // Schedule on next frame so it stacks with the contributing notes visually.
  const px = typeof window !== "undefined" ? window.innerWidth * x : 0;
  const py = typeof window !== "undefined" ? window.innerHeight * y : 0;
  spawnBurst(px, py, { hue, energy: Math.min(1, intensity * 1.1) });
}

// ---------- First-run ambient ----------

let welcomed = false;
export function welcomeOnce() {
  if (welcomed || typeof window === "undefined") return;
  welcomed = true;
  const W = window.innerWidth, H = window.innerHeight;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;
  const count = 3;
  for (let i = 0; i < count; i++) {
    const delay = 250 + i * 1100 + Math.random() * 400;
    window.setTimeout(() => {
      const x = W * (0.25 + Math.random() * 0.5);
      const y = H * (0.30 + Math.random() * 0.4);
      const hue = Math.random();
      spawnBurst(x, y, { hue, energy: 0.45 + Math.random() * 0.2 });
      flashBus.flash(x / W, y / H, 0.35, hue);
    }, delay);
  }
}

// ---------- Update / draw ----------

export function updateJuice(dt: number) {
  for (const g of GHOSTS) {
    if (!g.alive) continue;
    g.age += dt;
    if (g.age >= g.maxAge) g.alive = false;
  }
}

export function drawJuice(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const prevOp = ctx.globalCompositeOperation;
  const prevAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";

  // ---- Cursor trail ----
  const now = performance.now() / 1000;
  // prune
  while (trail.length && now - trail[0].t > TRAIL_LIFE) trail.shift();
  if (trail.length > 1) {
    for (let i = 1; i < trail.length; i++) {
      const p = trail[i];
      const q = trail[i - 1];
      const age = (now - p.t) / TRAIL_LIFE;
      const a = (1 - age) * 0.22;
      if (a <= 0.002) continue;
      const r = 1.2 + (1 - age) * 2.4;
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = r;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(q.x, q.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }

  // ---- Echo ghosts ----
  for (const g of GHOSTS) {
    if (!g.alive) continue;
    const t = g.age / g.maxAge;
    const env = (1 - t) * (1 - t); // smooth decay
    if (env < 0.01) continue;
    const px = g.x * W;
    const py = g.y * H;
    const radius = 6 + g.energy * 26 * (1 + t * 0.9); // expands as it fades
    let col: [number, number, number] = [1, 1, 1];
    if (g.hue != null) col = hslToRgb(g.hue, 0.65, 0.7);
    const r = Math.round(col[0] * 255);
    const gg = Math.round(col[1] * 255);
    const b = Math.round(col[2] * 255);
    // soft ring
    const grad = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius);
    grad.addColorStop(0, `rgba(${r},${gg},${b},${0.0})`);
    grad.addColorStop(0.65, `rgba(${r},${gg},${b},${0.18 * env})`);
    grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(px, py, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}