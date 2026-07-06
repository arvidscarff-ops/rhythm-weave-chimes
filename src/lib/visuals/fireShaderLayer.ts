// Fire spark particle system. Each note trigger spawns a small burst of
// independent ember particles that fly outward, meander (curl-noise wobble),
// and fade out in size + opacity — like sparks off a struck flint.
//
// Implemented with Canvas2D + additive compositing so each spark can follow
// its own trajectory cheaply. The public API mirrors the previous WebGL
// layer so callers don't need to change.

/* eslint-disable no-console */

export type FireSpawnOpts = {
  life: number;      // seconds — max particle lifetime (with jitter)
  size: number;      // 0.02..0.8 — burst scale (fraction of shorter canvas dim)
  intensity: number; // 0..6 — particle count multiplier + brightness
  tint: [number, number, number]; // 0..1 rgb — cool-down color
  speed?: number;    // 0.1..5 — outward velocity multiplier (independent of life)
};

type Particle = {
  x: number; y: number;        // css px, top-left origin
  vx: number; vy: number;      // css px / sec
  born: number;                // scene seconds
  life: number;                // seconds
  r0: number;                  // css px, base radius
  bright: number;              // 0..1
  tint: [number, number, number];
  seed: number;                // per-particle noise seed
  ph1: number; ph2: number;    // meander phase offsets
  wFreq1: number; wFreq2: number; // meander frequencies
  curlAmp: number;             // per-particle perpendicular curl strength (px/s²)
  prevTheta: number;           // previous meander angle (for numerical derivative)
  // shape variance
  baseL: number; baseW: number;      // css px, base ellipse axes
  aspectPhase: number; aspectFreq: number; // for L/W breathing
  hotPhase: number;                  // for hot-core drift
  flickerPhase: number; flickerFreq: number;
  curvePhase: number; curveFreq: number; curveAmp: number; // heading wobble ±rad
  haloScale: number; haloAlphaMul: number;
  // trail
  px: number; py: number;
};

type Ash = {
  x: number; y: number;
  vx: number; vy: number;
  born: number; life: number;
  r: number; g: number; b: number;
  bright: number;
};

type FireLayer = {
  canvas: HTMLCanvasElement;
  gl: null;
  particles: Particle[];
  spawn: (cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts) => void;
  render: (tSec: number) => void;
  resize: () => void;
  destroy: () => void;
};

const registry = new Set<FireLayer>();

/** Broadcast a spawn to every mounted layer (typically only one). */
export function spawnFire(cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts): void {
  for (const l of registry) l.spawn(cssX, cssY, tSec, opts);
}

// ---- helpers ---------------------------------------------------------------

function rand(seed: number): number {
  // Deterministic-ish hash → 0..1
  const s = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Cheap 2D "curl" wobble: sinusoids of position + time. Not true curl noise
// but produces the meandering S-curves we want at almost zero cost.
function wobble(x: number, y: number, t: number, seed: number): [number, number] {
  const a = Math.sin(x * 0.012 + t * 1.7 + seed * 6.28) + Math.cos(y * 0.014 - t * 1.3);
  const b = Math.cos(x * 0.011 - t * 1.9 + seed * 3.14) + Math.sin(y * 0.013 + t * 1.5);
  return [a, b];
}

function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }

/**
 * Ember color ramp: white-hot core when young → warm tint mid-life →
 * deep red as it cools. Returns rgb in 0..255.
 */
function emberColor(
  tintR: number, tintG: number, tintB: number, t: number
): [number, number, number] {
  // t: 0 fresh → 1 dying
  const hotR = 1.0, hotG = 0.95, hotB = 0.75;
  const coolR = 0.55, coolG = 0.08, coolB = 0.02;
  let r: number, g: number, b: number;
  if (t < 0.35) {
    const k = t / 0.35;
    r = mix(hotR, tintR, k);
    g = mix(hotG, tintG, k);
    b = mix(hotB, tintB, k);
  } else {
    const k = (t - 0.35) / 0.65;
    r = mix(tintR, coolR, k);
    g = mix(tintG, coolG, k);
    b = mix(tintB, coolB, k);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

const MAX_PARTICLES = 2000;
const MAX_ASH = 800;


export function createFireLayer(parent: HTMLElement): FireLayer {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.display = "block";
  canvas.style.mixBlendMode = "screen";
  parent.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D | null;
  const particles: Particle[] = [];

  const layer: FireLayer = {
    canvas,
    gl: null,
    particles,
    spawn: () => {},
    render: () => {},
    resize: () => {},
    destroy: () => {},
  };

  if (!ctx) {
    console.warn("[fireShaderLayer] Canvas2D unavailable; fire-spark burst will be a no-op.");
    layer.destroy = () => { registry.delete(layer); canvas.remove(); };
    registry.add(layer);
    return layer;
  }

  let dpr = window.devicePixelRatio || 1;
  let cssW = 1, cssH = 1;

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    cssW = w; cssH = h;
    const dw = Math.floor(w * dpr);
    const dh = Math.floor(h * dpr);
    if (canvas.width !== dw || canvas.height !== dh) {
      canvas.width = dw;
      canvas.height = dh;
    }
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  let lastRenderTime = -1;
  const ash: Ash[] = [];

  layer.spawn = (cssX, cssY, tSec, opts) => {
    resize();
    const shortSide = Math.min(cssW, cssH);
    const burstScale = Math.max(0.02, Math.min(0.8, opts.size)) * shortSide;
    const intensity = Math.max(0, opts.intensity);
    const life = Math.max(0.1, opts.life);

    // Particle count scales with intensity. Default around 15, up to ~40.
    const count = Math.max(4, Math.round(6 + intensity * 5));

    const x0 = Number.isFinite(cssX) ? cssX : cssW / 2;
    const y0 = Number.isFinite(cssY) ? cssY : cssH / 2;

    // Base speed is a pure velocity (px/s), independent of life so users can
    // tune "how fast" and "how long" separately. Default speedMul=1 matches
    // the old "travel ~3× burstScale in ~1s" feel.
    const speedMul = Math.max(0.05, Math.min(8, opts.speed ?? 1));
    const baseSpeed = burstScale * 3.0 * speedMul;

    for (let i = 0; i < count; i++) {
      const seed = tSec * 1000 + i * 17.31 + Math.random() * 1000;
      // Full 360° spread, slight upward bias.
      const ang = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.5 + Math.random() * 0.9);
      const vx = Math.cos(ang) * speed;
      // Upward bias: shift some vertical velocity upward (negative y = up).
      const vy = Math.sin(ang) * speed - baseSpeed * 0.35 * Math.random();

      const jitter = 0.6 + Math.random() * 0.8;
      // Power-law length: most small, a few long streaks
      const lenRoll = Math.pow(Math.random(), 1.8); // biased small
      const baseL = 5 + lenRoll * 21;   // 5..26 css px
      const widthRoll = Math.pow(Math.random(), 1.4);
      const baseW = 1.8 + widthRoll * 4.7; // 1.8..6.5
      particles.push({
        x: x0, y: y0,
        px: x0, py: y0,
        vx, vy,
        born: tSec,
        life: life * (0.55 + Math.random() * 0.9),
        r0: Math.max(1.2, burstScale * 0.055 * jitter),
        bright: 0.7 + Math.random() * 0.6,
        tint: opts.tint,
        seed,
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        // Low frequencies → path curves over the whole lifetime, not per-frame jitter.
        wFreq1: 0.6 + Math.random() * 0.7,   // ~0.6..1.3 Hz
        wFreq2: 1.7 + Math.random() * 1.4,   // ~1.7..3.1 Hz
        // Perpendicular curl strength scales with initial speed so heading
        // actually turns ~1–2 rad over the particle's lifetime.
        curlAmp: speed * (0.9 + Math.random() * 0.7),
        prevTheta: 0,
        baseL, baseW,
        aspectPhase: Math.random() * Math.PI * 2,
        aspectFreq: 1.5 + Math.random() * 2.5, // Hz
        hotPhase: Math.random() * Math.PI * 2,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerFreq: 12 + Math.random() * 18,  // fast flicker Hz
        curvePhase: Math.random() * Math.PI * 2,
        curveFreq: 0.8 + Math.random() * 1.4,
        curveAmp: (Math.random() * 0.14) - 0.02, // up to ~8°
        haloScale: 0.7 + Math.random() * 0.9,
        haloAlphaMul: 0.55 + Math.random() * 1.1,
      });
    }

    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }
  };

  layer.render = (tSec) => {
    resize();
    const dt = lastRenderTime < 0 ? 1 / 60 : Math.min(0.05, Math.max(0.001, tSec - lastRenderTime));
    lastRenderTime = tSec;

    // Clear (physical pixels, no transform gymnastics).
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (particles.length === 0) return;

    ctx.globalCompositeOperation = "lighter";

    // Physics tuned so sparks travel and curve visibly (needed for streaks).
    const GRAV = 25;     // css px / s²
    const DRAG = 0.5;    // per-second drag factor

    const dragK = Math.pow(DRAG, dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = tSec - p.born;
      const t = age / p.life;
      if (t >= 1 || age < 0) {
        particles.splice(i, 1);
        continue;
      }

      // Meander: perpendicular curl force driven by a low-frequency angular
      // noise sampled per particle. Perpendicular (not axis-aligned) so it
      // steers heading → S-curves rather than modulating speed.
      const theta =
        0.75 * Math.sin(p.wFreq1 * age * 2 * Math.PI + p.ph1) +
        0.35 * Math.sin(p.wFreq2 * age * 2 * Math.PI + p.ph2);
      const dTheta = theta - p.prevTheta;
      p.prevTheta = theta;

      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0.01) {
        // unit perpendicular to velocity
        const px_ = -p.vy / sp;
        const py_ = p.vx / sp;
        // Fade curl as spark dies so tails settle into straighter drift.
        const curlFade = 1 - t * 0.4;
        const aCurl = p.curlAmp * dTheta / Math.max(dt, 1e-3) * curlFade;
        // Clamp so a huge dTheta from spawn (prevTheta=0 → theta≠0) doesn't
        // launch the first frame.
        const aCurlClamped = Math.max(-p.curlAmp * 4, Math.min(p.curlAmp * 4, aCurl));
        p.vx += px_ * aCurlClamped * dt;
        p.vy += py_ * aCurlClamped * dt;
      }
      p.vy += GRAV * 0.3 * dt;
      p.vx *= dragK;
      p.vy *= dragK;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const shrink = 1 - t * 0.65;
      const alpha = Math.pow(1 - t, 1.35) * p.bright;
      // Flicker: fast per-particle intensity noise, mixed with slow twinkle
      const flick = 0.75 + 0.25 * Math.sin(tSec * p.flickerFreq + p.flickerPhase)
                          + 0.10 * Math.sin(tSec * p.flickerFreq * 0.37 + p.flickerPhase * 1.7);
      const a = Math.max(0, Math.min(1, alpha * flick));
      if (a <= 0.002) continue;

      const speed = Math.hypot(p.vx, p.vy);
      // Heading: velocity angle + slow per-particle wobble so cigars aren't
      // perfectly axis-aligned with motion (reads as tumbling embers).
      const headingBase = speed > 0.1 ? Math.atan2(p.vy, p.vx) : (p.seed % (Math.PI * 2));
      const ang = headingBase + p.curveAmp * Math.sin(tSec * p.curveFreq + p.curvePhase);

      // Breathing aspect: L and W modulate out of phase → sparks stretch thin
      // then puff shorter/thicker as they travel.
      const lMod = 1 + 0.35 * Math.sin(tSec * p.aspectFreq + p.aspectPhase);
      const wMod = 1 + 0.25 * Math.sin(tSec * p.aspectFreq * 1.7 + p.aspectPhase + 1.2);
      const speedStretch = 1 + Math.min(0.6, speed * 0.0015);
      const L = Math.max(3, p.baseL * lMod * shrink * speedStretch);
      const W = Math.max(1.2, p.baseW * wMod * shrink / Math.max(1, speedStretch * 0.6));

      const [cr, cg, cb] = emberColor(p.tint[0], p.tint[1], p.tint[2], t);

      // Sub-pixel jitter — breaks pixel-grid lock, reads as higher-res.
      const jx = (Math.sin(tSec * 41 + p.seed) * 0.5);
      const jy = (Math.cos(tSec * 37 + p.seed * 1.3) * 0.5);
      const cxw = (p.x + jx) * dpr;
      const cyw = (p.y + jy) * dpr;

      // Bloom halo — per-particle scale & alpha so glow row isn't uniform.
      const haloA = a * 0.22 * p.haloAlphaMul * (0.85 + 0.15 * Math.sin(tSec * 4 + p.seed));
      if (haloA > 0.005) {
        const haloR = L * 1.4 * p.haloScale;
        const halo = ctx.createRadialGradient(cxw, cyw, 0, cxw, cyw, haloR * dpr);
        halo.addColorStop(0, `rgba(${cr},${cg},${cb},${haloA.toFixed(3)})`);
        halo.addColorStop(0.5, `rgba(${cr},${cg},${cb},${(haloA * 0.3).toFixed(3)})`);
        halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cxw, cyw, haloR * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      const cos = Math.cos(ang), sin = Math.sin(ang);

      // --- Tail smear: elongated, dimmer, behind the head (pre-body) ---
      {
        const TL = L * 1.35, TW = W * 0.55;
        // shift back along heading so the smear trails the head
        const shift = -L * 0.18;
        const tcx = cxw + cos * shift * dpr;
        const tcy = cyw + sin * shift * dpr;
        ctx.setTransform(
          dpr * cos * (TL * 0.5), dpr * sin * (TL * 0.5),
          -dpr * sin * (TW * 0.5), dpr * cos * (TW * 0.5),
          tcx, tcy,
        );
        const tailA = a * 0.35;
        const tg = ctx.createRadialGradient(0.2, 0, 0, 0, 0, 1);
        tg.addColorStop(0.00, `rgba(${cr},${cg},${cb},${tailA.toFixed(3)})`);
        tg.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(tailA * 0.4).toFixed(3)})`);
        tg.addColorStop(1.00, `rgba(${cr},${cg},${cb},0)`);
        ctx.fillStyle = tg;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Main body ellipse ---
      ctx.setTransform(
        dpr * cos * (L * 0.5), dpr * sin * (L * 0.5),
        -dpr * sin * (W * 0.5), dpr * cos * (W * 0.5),
        cxw, cyw,
      );
      const hotX = 0.15 + 0.4 * Math.sin(tSec * 3.1 + p.hotPhase); // -0.25..0.55
      const grad = ctx.createRadialGradient(hotX, 0, 0, 0, 0, 1);
      grad.addColorStop(0.00, `rgba(255,248,225,${Math.min(1, a * 1.1).toFixed(3)})`);
      grad.addColorStop(0.18, `rgba(${cr},${cg},${cb},${(a * 0.95).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(a * 0.55).toFixed(3)})`);
      grad.addColorStop(1.00, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();

      // --- Hot nucleus: tiny sharp bright dot slid toward the head ---
      {
        const NL = L * 0.28, NW = W * 0.55;
        const nShift = L * (0.10 + 0.15 * Math.sin(tSec * 2.7 + p.hotPhase * 1.3));
        const ncx = cxw + cos * nShift * dpr;
        const ncy = cyw + sin * nShift * dpr;
        ctx.setTransform(
          dpr * cos * (NL * 0.5), dpr * sin * (NL * 0.5),
          -dpr * sin * (NW * 0.5), dpr * cos * (NW * 0.5),
          ncx, ncy,
        );
        const nA = Math.min(1, a * 1.3);
        const ng = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
        ng.addColorStop(0.0, `rgba(255,253,240,${nA.toFixed(3)})`);
        ng.addColorStop(0.5, `rgba(255,230,180,${(nA * 0.5).toFixed(3)})`);
        ng.addColorStop(1.0, `rgba(255,200,120,0)`);
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // --- Emit occasional ash fleck for crackly high-freq detail ---
      if (ash.length < MAX_ASH && Math.random() < 0.12 * (1 - t)) {
        const av = speed * 0.15;
        const aang = ang + (Math.random() - 0.5) * 1.4;
        ash.push({
          x: p.x, y: p.y,
          vx: Math.cos(aang) * av + (Math.random() - 0.5) * 20,
          vy: Math.sin(aang) * av + (Math.random() - 0.5) * 20,
          born: tSec,
          life: 0.12 + Math.random() * 0.18,
          r: cr, g: cg, b: cb,
          bright: 0.6 + Math.random() * 0.5,
        });
      }
    }

    // --- Render ash flecks (tiny bright pixels) ---
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (let i = ash.length - 1; i >= 0; i--) {
      const a = ash[i];
      const age = tSec - a.born;
      const k = age / a.life;
      if (k >= 1 || age < 0) { ash.splice(i, 1); continue; }
      a.vy += 40 * dt;
      a.vx *= 0.94; a.vy *= 0.94;
      a.x += a.vx * dt; a.y += a.vy * dt;
      const al = (1 - k) * a.bright;
      const size = Math.max(1, 1.6 * dpr * (1 - k * 0.5));
      ctx.fillStyle = `rgba(${a.r},${a.g},${a.b},${al.toFixed(3)})`;
      ctx.fillRect(a.x * dpr - size * 0.5, a.y * dpr - size * 0.5, size, size);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  };

  layer.resize = resize;
  layer.destroy = () => {
    ro.disconnect();
    registry.delete(layer);
    particles.length = 0;
    canvas.remove();
  };

  registry.add(layer);
  return layer;
}

/** Parse "#rrggbb" → [r,g,b] in 0..1. Falls back to warm orange. */
export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1.0, 0.55, 0.15];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}