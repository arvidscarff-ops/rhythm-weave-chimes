// Fire shader adapted from Jan Mróz (jaszunio15) — Shadertoy wl2Gzc — CC BY 3.0
// The original is a full-screen ambient fire field. Here it's masked per
// emitter (position + lifetime + radial falloff) so each note trigger
// spawns a localized fire burst that fades out over `life` seconds.
//
// Layer count is reduced from 15 → 6 so we can render up to 16 emitters
// per frame without collapsing perf. Everything else (voronoi sparks,
// layered particles, smoke wisps, bloom, movement direction) is intact.

/* eslint-disable no-console */

export type FireSpawnOpts = {
  life: number;      // seconds
  size: number;      // 0.05..0.6 — fraction of shorter canvas dim
  intensity: number; // 0..3
  tint: [number, number, number]; // 0..1 rgb
};

const MAX_EMITTERS = 16;

type Emitter = {
  x: number; y: number;    // device pixels, top-left origin
  born: number;             // scene seconds
  life: number;
  size: number;
  intensity: number;
  tint: [number, number, number];
};

type FireLayer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  emitters: Emitter[];
  spawn: (cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts) => void;
  render: (tSec: number) => void;
  resize: () => void;
  destroy: () => void;
};

const registry = new Set<FireLayer>();

const DEBUG_FIRE_DEFAULTS: FireSpawnOpts = {
  life: 1.6,
  size: 0.34,
  intensity: 4.5,
  tint: [1.0, 0.55, 0.15],
};

declare global {
  interface Window {
    __phaseFireDebug?: (x?: number, y?: number, opts?: Partial<FireSpawnOpts>) => void;
  }
}

/** Broadcast a spawn to every mounted layer (typically only one). */
export function spawnFire(cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts): void {
  for (const l of registry) l.spawn(cssX, cssY, tSec, opts);
}

const VERT_SRC = `#version 300 es
void main() {
  vec2 p = vec2(
    float((gl_VertexID & 1) * 4) - 1.0,
    float((gl_VertexID & 2) * 2) - 1.0
  );
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
export function createFireLayer(parent: HTMLElement): FireLayer {
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.display = "block";
  // Additive blend with the Canvas2D scene under it.
  canvas.style.mixBlendMode = "screen";
  parent.appendChild(canvas);

  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;

  const emitters: Emitter[] = [];

  const layer: FireLayer = {
    canvas,
    gl,
    emitters,
    spawn: () => {},
    render: () => {},
    resize: () => {},
    destroy: () => {},
  };

  if (!gl) {
    console.warn("[fireShaderLayer] WebGL2 unavailable; fire-spark burst will be a no-op.");
    layer.destroy = () => {
      registry.delete(layer);
      canvas.remove();
    };
    registry.add(layer);
    return layer;
  }

  const program = linkProgram(gl);
  if (!program) {
    layer.destroy = () => {
      registry.delete(layer);
      canvas.remove();
    };
    registry.add(layer);
    return layer;
  }

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const uRes = gl.getUniformLocation(program, "uResolution");
  const uTime = gl.getUniformLocation(program, "uTime");
  const uCount = gl.getUniformLocation(program, "uCount");
  const uEmitA = gl.getUniformLocation(program, "uEmitA[0]");
  const uEmitB = gl.getUniformLocation(program, "uEmitB[0]");
  const uIntensity = gl.getUniformLocation(program, "uIntensity[0]");

  if (!uRes || !uTime || !uCount || !uEmitA || !uEmitB || !uIntensity) {
    console.warn("[fireShaderLayer] missing shader uniforms; fire-spark burst will be a no-op.");
  }

  const bufA = new Float32Array(MAX_EMITTERS * 4);
  const bufB = new Float32Array(MAX_EMITTERS * 4);
  const bufI = new Float32Array(MAX_EMITTERS);

  let dpr = window.devicePixelRatio || 1;

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
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

  layer.spawn = (cssX, cssY, tSec, opts) => {
    resize();
    const rect = canvas.getBoundingClientRect();
    const localX = Number.isFinite(cssX) ? cssX : rect.width / 2;
    const localY = Number.isFinite(cssY) ? cssY : rect.height / 2;
    // Store position in device pixels, top-down origin. Shader flips y.
    const px = localX * dpr;
    const py = localY * dpr;
    const e: Emitter = {
      x: px, y: py,
      born: tSec,
      life: Math.max(0.1, opts.life),
      size: Math.max(0.02, Math.min(0.8, opts.size)),
      intensity: Math.max(0, opts.intensity),
      tint: opts.tint,
    };
    if (emitters.length >= MAX_EMITTERS) emitters.shift();
    emitters.push(e);
  };

  layer.render = (tSec) => {
    resize();
    // Reap dead emitters (small ring buffer, cheap).
    for (let i = emitters.length - 1; i >= 0; i--) {
      if (tSec - emitters[i].born > emitters[i].life) emitters.splice(i, 1);
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (emitters.length === 0) return;

    // The shader already sums all emitters in one full-screen pass. Avoid
    // framebuffer alpha blending here so low-alpha sparks don't get dimmed
    // before the browser composites the transparent overlay.
    gl.disable(gl.BLEND);

    gl.useProgram(program);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, tSec);

    const n = Math.min(MAX_EMITTERS, emitters.length);
    for (let i = 0; i < n; i++) {
      const e = emitters[i];
      bufA[i * 4 + 0] = e.x;
      bufA[i * 4 + 1] = e.y;
      bufA[i * 4 + 2] = e.born;
      bufA[i * 4 + 3] = e.life;
      bufB[i * 4 + 0] = e.tint[0];
      bufB[i * 4 + 1] = e.tint[1];
      bufB[i * 4 + 2] = e.tint[2];
      bufB[i * 4 + 3] = e.size;
      bufI[i] = e.intensity;
    }
    gl.uniform1i(uCount, n);
    gl.uniform4fv(uEmitA, bufA);
    gl.uniform4fv(uEmitB, bufB);
    gl.uniform1fv(uIntensity, bufI);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  layer.resize = resize;
  if (typeof window !== "undefined") {
    window.__phaseFireDebug = (x, y, opts) => {
      const rect = canvas.getBoundingClientRect();
      const t = performance.now() / 1000;
      layer.spawn(
        x ?? rect.width / 2,
        y ?? rect.height / 2,
        t,
        { ...DEBUG_FIRE_DEFAULTS, ...opts },
      );
      layer.render(t + 0.08);
    };
  }
  layer.destroy = () => {
    ro.disconnect();
    registry.delete(layer);
    try {
      gl.deleteProgram(program);
      if (vao) gl.deleteVertexArray(vao);
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined" && window.__phaseFireDebug) {
      delete window.__phaseFireDebug;
    }
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