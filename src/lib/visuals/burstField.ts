// Wispy light-bloom bursts for note triggers.
// One bloom per trigger: core flash (chromatic) + soft halo + tapered wisps.
// All additive; pixel-aligned with the scene canvas.

type Wisp = {
  angle: number;       // base outward direction
  curl: number;        // tangential curl coefficient
  length: number;      // 0..1 multiplier
  phase: number;       // life offset for shimmer
  width: number;       // base stroke px
};

type Bloom = {
  alive: boolean;
  x: number; y: number;
  age: number;
  maxAge: number;
  energy: number;       // 0.25..1.2
  hue: number;          // radians for phosphor palette
  r: number; g: number; b: number;
  wisps: Wisp[];
};

const MAX_BLOOMS = 10;
const blooms: Bloom[] = Array.from({ length: MAX_BLOOMS }, () => ({
  alive: false, x: 0, y: 0, age: 0, maxAge: 1, energy: 1, hue: 0,
  r: 1, g: 1, b: 1, wisps: [],
}));
let cursor = 0;

const reduced = typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Phosphor palette: cos(s + vec4(0,1,8,0)) → iridescent cyan/magenta/amber
function phosphorColor(s: number): [number, number, number] {
  const r = 0.55 + 0.45 * Math.cos(s);
  const g = 0.55 + 0.45 * Math.cos(s + 1.0);
  const b = 0.55 + 0.45 * Math.cos(s + 8.0);
  return [r, g, b];
}

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
  const hue = ((opts.hue ?? Math.random()) % 1) * Math.PI * 2;

  const b = pick();
  b.alive = true;
  b.x = x; b.y = y;
  b.age = 0;
  b.maxAge = 0.85 + 0.25 * energy;
  b.energy = energy;
  b.hue = hue;
  const [r, g, bl] = phosphorColor(hue);
  b.r = r; b.g = g; b.b = bl;

  const wispCount = reduced ? 0 : Math.round(4 + 3 * energy);
  b.wisps.length = 0;
  for (let i = 0; i < wispCount; i++) {
    const angle = (i / wispCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.7;
    b.wisps.push({
      angle,
      curl: (Math.random() - 0.5) * 1.4,
      length: 0.6 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
      width: 1.4 + Math.random() * 1.6,
    });
  }
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
  const prevCap = ctx.lineCap;
  ctx.globalCompositeOperation = "lighter";
  ctx.lineCap = "round";

  for (const b of blooms) {
    if (!b.alive) continue;
    const t = b.age;
    const energy = b.energy;
    const R = Math.round(b.r * 255);
    const G = Math.round(b.g * 255);
    const B = Math.round(b.b * 255);

    // ---- Halo (dominant silhouette) ----
    const haloLife = envelope(t, 0.12, 0.75);
    if (haloLife > 0.001) {
      const baseR = 36 + 60 * energy;
      const radius = baseR * (1 + (t / b.maxAge) * 0.55);
      const a = haloLife * 0.55;
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, radius);
      grad.addColorStop(0, `rgba(${R},${G},${B},${a})`);
      grad.addColorStop(0.25, `rgba(${R},${G},${B},${a * 0.55})`);
      grad.addColorStop(0.6, `rgba(${R},${G},${B},${a * 0.18})`);
      grad.addColorStop(1, `rgba(${R},${G},${B},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Core flash with chromatic-aberration triad ----
    const coreLife = envelope(t, 0.05, 0.22);
    if (coreLife > 0.001) {
      const coreR = (4 + 10 * energy) * (0.85 + coreLife * 0.4);
      const a = coreLife * 0.85;
      // R / G / B offset triad — fades to white at peak
      const offsets: Array<[number, number, string]> = [
        [-1.4,  0.0, `rgba(255,${Math.round(60 + G * 0.2)},${Math.round(60 + B * 0.2)},${a * 0.7})`],
        [ 0.7,  1.2, `rgba(${Math.round(60 + R * 0.2)},255,${Math.round(60 + B * 0.2)},${a * 0.7})`],
        [ 0.7, -1.2, `rgba(${Math.round(60 + R * 0.2)},${Math.round(60 + G * 0.2)},255,${a * 0.7})`],
      ];
      for (const [ox, oy, color] of offsets) {
        const grad = ctx.createRadialGradient(b.x + ox, b.y + oy, 0, b.x + ox, b.y + oy, coreR);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color.replace(/,[^,]+\)$/, ",0)"));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(b.x + ox, b.y + oy, coreR, 0, Math.PI * 2);
        ctx.fill();
      }
      // hot white center
      const wa = coreLife * 0.85;
      const wgrad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, coreR * 0.7);
      wgrad.addColorStop(0, `rgba(255,255,255,${wa})`);
      wgrad.addColorStop(1, `rgba(255,255,255,0)`);
      ctx.fillStyle = wgrad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, coreR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- Wisps — tapered curved strokes, drawn as overlapping
    //       segments with shrinking lineWidth to fake taper. ----
    const wispLife = envelope(t, 0.10, 0.85);
    if (wispLife > 0.001 && b.wisps.length > 0) {
      const grow = Math.min(1, t / (b.maxAge * 0.6));
      const reach = (52 + 90 * energy) * grow;
      const SEG = 8;
      for (const w of b.wisps) {
        const len = reach * w.length;
        const cosA = Math.cos(w.angle), sinA = Math.sin(w.angle);
        const cosT = -sinA, sinT = cosA; // tangent
        // bezier-ish path via quadratic offset along tangent
        const cx = b.x + cosA * len * 0.5 + cosT * len * 0.35 * w.curl;
        const cy = b.y + sinA * len * 0.5 + sinT * len * 0.35 * w.curl;
        const ex = b.x + cosA * len + cosT * len * 0.15 * w.curl;
        const ey = b.y + sinA * len + sinT * len * 0.15 * w.curl;

        // sample points along quadratic bezier
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= SEG; i++) {
          const u = i / SEG;
          const iu = 1 - u;
          const px = iu * iu * b.x + 2 * iu * u * cx + u * u * ex;
          const py = iu * iu * b.y + 2 * iu * u * cy + u * u * ey;
          pts.push([px, py]);
        }
        // draw each segment with taper + alpha falloff
        for (let i = 0; i < SEG; i++) {
          const u = (i + 0.5) / SEG;
          // taper: 0 at ends, 1 in middle, but biased toward base
          const taper = Math.sin(Math.PI * Math.pow(u, 0.85));
          const a = wispLife * 0.42 * taper * (0.75 + 0.25 * Math.sin(w.phase + t * 6));
          if (a <= 0.002) continue;
          ctx.strokeStyle = `rgba(${R},${G},${B},${a})`;
          ctx.lineWidth = w.width * taper * (0.7 + 0.5 * energy);
          ctx.beginPath();
          ctx.moveTo(pts[i][0], pts[i][1]);
          ctx.lineTo(pts[i + 1][0], pts[i + 1][1]);
          ctx.stroke();
        }
      }
    }
  }

  ctx.lineCap = prevCap;
  ctx.globalAlpha = prevAlpha;
  ctx.globalCompositeOperation = prevOp;
}