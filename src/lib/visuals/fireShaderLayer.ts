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

const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2(-1.0, -1.0);
  if (gl_VertexID == 1) p = vec2(3.0, -1.0);
  if (gl_VertexID == 2) p = vec2(-1.0, 3.0);
  gl_Position = vec4(p, 0.0, 1.0);
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  uResolution;
uniform float uTime;
uniform int   uCount;
uniform vec4  uEmitA[${MAX_EMITTERS}]; // x, y (device px, top-down), born, life
uniform vec4  uEmitB[${MAX_EMITTERS}]; // tintR, tintG, tintB, size (frac of resX)
uniform float uIntensity[${MAX_EMITTERS}];

#define PI 3.1415927
#define ANIMATION_SPEED 1.5
#define MOVEMENT_SPEED 1.0
#define MOVEMENT_DIRECTION vec2(0.7, -1.0)
#define PARTICLE_SIZE 0.009
#define PARTICLE_SCALE (vec2(0.5, 1.6))
#define PARTICLE_SCALE_VAR (vec2(0.25, 0.2))
#define PARTICLE_BLOOM_SCALE (vec2(0.5, 0.8))
#define PARTICLE_BLOOM_SCALE_VAR (vec2(0.3, 0.1))
#define SPARK_COLOR vec3(1.0, 0.4, 0.05) * 1.5
#define BLOOM_COLOR vec3(1.0, 0.4, 0.05) * 0.8
#define SMOKE_COLOR vec3(1.0, 0.43, 0.1) * 0.8
#define SIZE_MOD 1.05
#define ALPHA_MOD 0.9
#define LAYERS_COUNT 6
#define FIELD_SCALE 12.0
#define SPARK_SIZE_BOOST 5.5
#define OUTPUT_GAIN 4.0

float hash1_2(in vec2 x) {
  return fract(sin(dot(x, vec2(52.127, 61.2871))) * 521.582);
}
vec2 hash2_2(in vec2 x) {
  return fract(sin(x * mat2(20.52, 24.1994, 70.291, 80.171)) * 492.194);
}
vec2 noise2_2(vec2 uv) {
  vec2 f = smoothstep(0.0, 1.0, fract(uv));
  vec2 uv00 = floor(uv);
  vec2 uv01 = uv00 + vec2(0,1);
  vec2 uv10 = uv00 + vec2(1,0);
  vec2 uv11 = uv00 + 1.0;
  vec2 v00 = hash2_2(uv00);
  vec2 v01 = hash2_2(uv01);
  vec2 v10 = hash2_2(uv10);
  vec2 v11 = hash2_2(uv11);
  vec2 v0 = mix(v00, v01, f.y);
  vec2 v1 = mix(v10, v11, f.y);
  return mix(v0, v1, f.x);
}
float noise1_2(in vec2 uv) {
  vec2 f = fract(uv);
  vec2 uv00 = floor(uv);
  vec2 uv01 = uv00 + vec2(0,1);
  vec2 uv10 = uv00 + vec2(1,0);
  vec2 uv11 = uv00 + 1.0;
  float v00 = hash1_2(uv00);
  float v01 = hash1_2(uv01);
  float v10 = hash1_2(uv10);
  float v11 = hash1_2(uv11);
  float v0 = mix(v00, v01, f.y);
  float v1 = mix(v10, v11, f.y);
  return mix(v0, v1, f.x);
}

vec2 rotate(in vec2 point, in float deg) {
  float s = sin(deg);
  float c = cos(deg);
  return mat2(s, c, -c, s) * point;
}

vec2 voronoiPointFromRoot(in vec2 root, in float deg) {
  vec2 point = hash2_2(root) - 0.5;
  float s = sin(deg);
  float c = cos(deg);
  point = mat2(s, c, -c, s) * point * 0.66;
  point += root + 0.5;
  return point;
}

float degFromRootUV(in vec2 uv, in float iTime) {
  return iTime * ANIMATION_SPEED * (hash1_2(uv) - 0.5) * 2.0;
}

vec2 randomAround2_2(in vec2 point, in vec2 range, in vec2 uv) {
  return point + (hash2_2(uv) - 0.5) * range;
}

vec3 fireParticles(in vec2 uv, in vec2 originalUV, in float iTime) {
  vec3 particles = vec3(0.0);
  vec2 rootUV = floor(uv);
  float deg = degFromRootUV(rootUV, iTime);
  vec2 pointUV = voronoiPointFromRoot(rootUV, deg);

  vec2 tempUV = uv + (noise2_2(uv * 2.0) - 0.5) * 0.1;
  tempUV += -(noise2_2(uv * 3.0 + iTime) - 0.5) * 0.07;

  float dist = length(rotate(tempUV - pointUV, 0.7) * randomAround2_2(PARTICLE_SCALE, PARTICLE_SCALE_VAR, rootUV));
  float distBloom = length(rotate(tempUV - pointUV, 0.7) * randomAround2_2(PARTICLE_BLOOM_SCALE, PARTICLE_BLOOM_SCALE_VAR, rootUV));

  float pSize = PARTICLE_SIZE * SPARK_SIZE_BOOST;
  particles += (1.0 - smoothstep(pSize * 0.6, pSize * 3.0, dist)) * SPARK_COLOR;
  particles += pow((1.0 - smoothstep(0.0, pSize * 12.0, distBloom)) * 1.0, 3.0) * BLOOM_COLOR;

  float border = (hash1_2(rootUV) - 0.5) * 2.0;
  float disappear = 1.0 - smoothstep(border, border + 0.5, originalUV.y);
  border = (hash1_2(rootUV + 0.214) - 1.8) * 0.7;
  float appear = smoothstep(border, border + 0.4, originalUV.y);

  // The original full-screen shader uses vertical reveal masks. Localized
  // bursts can land in regions where those masks almost entirely zero a cell,
  // so keep their texture but never let them hide the spark field completely.
  return particles * (0.25 + 0.75 * disappear * appear);
}

vec3 layeredParticlesLocal(in vec2 uv, in vec2 originalUV, in float iTime) {
  vec3 particles = vec3(0.0);
  float size = 1.0;
  float alpha = 1.0;
  vec2 offset = vec2(0.0);
  for (int i = 0; i < LAYERS_COUNT; i++) {
    vec2 noiseOffset = (noise2_2(uv * size * 2.0 + 0.5) - 0.5) * 0.15;
    vec2 bokehUV = (uv * size + iTime * MOVEMENT_DIRECTION * MOVEMENT_SPEED) + offset + noiseOffset;
    particles += fireParticles(bokehUV, originalUV, iTime) * alpha;
    offset += hash2_2(vec2(alpha, alpha)) * 10.0;
    alpha *= ALPHA_MOD;
    size *= SIZE_MOD;
  }
  return particles;
}

vec3 sampleFire(vec2 uv, float iTime) {
  // uv here is centered at 0 with roughly [-1..1] range for the burst core.
  // Scale into the shader's "screen" UV space so voronoi grid produces many
  // cells inside the localized burst. Feed a [0..1] originalUV so the
  // built-in appear/disappear vertical masks work correctly.
  vec2 suv = uv * FIELD_SCALE;
  vec2 originalUV = uv * 0.5 + 0.5;
  vec3 particles = layeredParticlesLocal(suv, originalUV, iTime);
  float core = 1.0 - smoothstep(0.0, 1.1, length(uv));
  return particles * 1.8 + SMOKE_COLOR * (0.035 + core * 0.18);
}

void main() {
  // Flip y so shader convention (+y up) matches emitter positions (top-down px).
  vec2 fc = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
  vec3 col = vec3(0.0);

  for (int i = 0; i < ${MAX_EMITTERS}; i++) {
    if (i >= uCount) break;
    vec4 a = uEmitA[i];
    vec4 b = uEmitB[i];
    float age = uTime - a.z;
    if (age < 0.0 || age > a.w) continue;

    float lifeT = age / a.w;
    // Sharp attack so bursts flash immediately, decay over the rest of life.
    float env = smoothstep(0.0, 0.04, lifeT) * (1.0 - smoothstep(0.4, 1.0, lifeT));
    if (env <= 0.001) continue;

    // Emitter position: a.xy stored bottom-up-flipped so distance math matches shader y-up.
    vec2 duvPx = fc - a.xy;
    float sizePx = max(1.0, b.w * min(uResolution.x, uResolution.y));
    vec2 uv = duvPx / sizePx;

    // Radial falloff so the burst is localized.
    float r = length(uv);
    float fall = 1.0 - smoothstep(0.6, 1.4, r);
    if (fall <= 0.0) continue;

    vec3 fire = sampleFire(uv, age);
    col += fire * env * fall * b.rgb * uIntensity[i];
  }

  // Additive output; alpha derived from luminance so the layer composites
  // cleanly with the Canvas2D scene below.
  col *= OUTPUT_GAIN;
  float lum = max(max(col.r, col.g), col.b);
  float alpha = smoothstep(0.002, 0.08, lum);
  fragColor = vec4(col, alpha);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[fireShaderLayer] shader compile failed:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function linkProgram(gl: WebGL2RenderingContext): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG_SRC);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("[fireShaderLayer] link failed:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

/**
 * Mount a WebGL2 overlay canvas inside `parent`. The parent should be
 * positioned; the returned canvas is absolutely positioned to cover it.
 * Returns a controller with spawn/render/resize/destroy methods.
 */
const MAX_PARTICLES = 2000;

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

    // Base speed derived from burst scale so bigger bursts fly farther.
    // Sparks should travel roughly `burstScale * 3` over their lifetime.
    const baseSpeed = (burstScale * 3.0) / life;

    for (let i = 0; i < count; i++) {
      const seed = tSec * 1000 + i * 17.31 + Math.random() * 1000;
      // Full 360° spread, slight upward bias.
      const ang = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.5 + Math.random() * 0.9);
      const vx = Math.cos(ang) * speed;
      // Upward bias: shift some vertical velocity upward (negative y = up).
      const vy = Math.sin(ang) * speed - baseSpeed * 0.35 * Math.random();

      const jitter = 0.6 + Math.random() * 0.8;
      particles.push({
        x: x0, y: y0,
        vx, vy,
        born: tSec,
        life: life * (0.55 + Math.random() * 0.9),
        r0: Math.max(1.2, burstScale * 0.055 * jitter),
        bright: 0.7 + Math.random() * 0.6,
        tint: opts.tint,
        seed,
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

    // Draw in css-px space with dpr scaling.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";

    // Physics + draw
    const GRAV = 30;    // css px / s²  — gentle downward pull (post-arc)
    const DRAG = 0.88;  // per-second drag factor applied via pow(DRAG, dt)
    const CURL = 55;    // css px / s² wobble acceleration

    const dragK = Math.pow(DRAG, dt);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = tSec - p.born;
      const t = age / p.life;
      if (t >= 1 || age < 0) {
        particles.splice(i, 1);
        continue;
      }

      // Wobble force (curl-ish)
      const [wx, wy] = wobble(p.x, p.y, tSec, p.seed);
      p.vx += wx * CURL * dt;
      p.vy += (wy * CURL - GRAV) * dt; // GRAV is small; sparks slow and drift
      p.vx *= dragK;
      p.vy *= dragK;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Size shrinks (mostly) and alpha fades toward end.
      const shrink = 1 - t * 0.75;                 // keep some size mid-life
      const alpha = Math.pow(1 - t, 1.4) * p.bright;
      const radius = Math.max(0.4, p.r0 * shrink);

      // Twinkle: quick flicker over life
      const twinkle = 0.75 + 0.25 * Math.sin(tSec * 30 + p.seed);
      const a = Math.min(1, alpha * twinkle);
      if (a <= 0.002) continue;

      const [cr, cg, cb] = emberColor(p.tint[0], p.tint[1], p.tint[2], t);

      // Bloom halo (large, low alpha)
      const haloR = radius * 6.5;
      const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      halo.addColorStop(0, `rgba(${cr},${cg},${cb},${(a * 0.35).toFixed(3)})`);
      halo.addColorStop(0.4, `rgba(${cr},${cg},${cb},${(a * 0.12).toFixed(3)})`);
      halo.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();

      // Bright core (white-hot center)
      const coreR = radius * 1.8;
      const core = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, coreR);
      const coreA = Math.min(1, a * 1.2);
      core.addColorStop(0, `rgba(255,250,235,${coreA.toFixed(3)})`);
      core.addColorStop(0.35, `rgba(${cr},${cg},${cb},${(a * 0.95).toFixed(3)})`);
      core.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
      ctx.fill();
    }

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