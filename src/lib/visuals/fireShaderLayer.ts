// Fire spark particle system with WebGL2 post-processing (HDR bloom,
// heat-shimmer, chromatic aberration) on top of a Canvas2D source that
// draws the sparks with persistence trails, curl-noise turbulence,
// birth flash, reactive underglow and cooling-ember afterglow.
//
// Pipeline:
//   sourceCanvas (Canvas2D, offscreen)
//     ├─ fade previous frame by (1 - trails)           → motion streaks
//     ├─ draw reactive glow underlay at active bursts  → warm ambient
//     ├─ update particles (curl-noise + wind + drag)
//     ├─ draw sparks (halo, tail, body, hot nucleus w/ chromatic split)
//     ├─ draw ash flecks
//     └─ draw cooling-ember afterglow trail
//   glCanvas (WebGL2, visible)
//     ├─ upload source as texture
//     ├─ bright-pass @ 1/2 res
//     ├─ separable Gaussian blur ×2 mip levels
//     └─ composite: shimmer(source) + bloom * strength   → screen
//
// Falls back to just showing the source canvas if WebGL2 is unavailable.

/* eslint-disable no-console */

export type FireSpawnOpts = {
  life: number;      // seconds
  size: number;      // 0.02..0.8 — fraction of shorter canvas dim
  intensity: number; // 0..6
  tint: [number, number, number]; // 0..1 rgb
  speed?: number;    // 0.1..5
  ashRate?: number;  // 0..4
  // ---- color modes ----
  colorMode?: "single" | "rainbow" | "palette";
  palette?: Array<[number, number, number]>; // 0..1 rgb entries (palette mode)
  paletteMode?: "random" | "sequential";
  // ---- post-fx knobs (layer-global; last spawn wins) ----
  bloom?: number;        // 0..3       — bloom strength
  shimmer?: number;      // 0..2       — heat-distortion amp
  trails?: number;       // 0..0.97    — persistence (0 = clear each frame)
  turbulence?: number;   // 0..3       — curl-noise strength
  wind?: number;         // -200..200  — px/s upward push (+ = up)
  afterglow?: number;    // 0..2       — cooling-ember amount
  glow?: number;         // 0..2       — reactive underlay glow
  chroma?: number;       // 0..3       — chromatic split on hot nucleus (px)
};

type Particle = {
  x: number; y: number;
  vx: number; vy: number;
  born: number;
  life: number;
  r0: number;
  bright: number;
  tint: [number, number, number];
  seed: number;
  ph1: number; ph2: number;
  wFreq1: number; wFreq2: number;
  curlAmp: number;
  prevTheta: number;
  baseL: number; baseW: number;
  aspectPhase: number; aspectFreq: number;
  hotPhase: number;
  flickerPhase: number; flickerFreq: number;
  curvePhase: number; curveFreq: number; curveAmp: number;
  haloScale: number; haloAlphaMul: number;
  px: number; py: number;
  ashRate: number;
  afterglowSpawn: number;
};

type Ash = {
  x: number; y: number;
  vx: number; vy: number;
  born: number; life: number;
  r: number; g: number; b: number;
  bright: number;
};

type Cinder = {
  x: number; y: number;
  vx: number; vy: number;
  born: number; life: number;
  r0: number;
  tint: [number, number, number];
};

type GlowBurst = {
  x: number; y: number;
  born: number;
  radius: number;
  tint: [number, number, number];
  decay: number;
  strength: number;
};

type FireLayer = {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext | null;
  particles: Particle[];
  spawn: (cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts) => void;
  render: (tSec: number) => void;
  resize: () => void;
  destroy: () => void;
};

const registry = new Set<FireLayer>();

export function spawnFire(cssX: number, cssY: number, tSec: number, opts: FireSpawnOpts): void {
  for (const l of registry) l.spawn(cssX, cssY, tSec, opts);
}

// ---- helpers ---------------------------------------------------------------

function mix(a: number, b: number, t: number): number { return a + (b - a) * t; }

// Cheap smooth 2D noise using summed sinusoids. Not simplex, but visually
// coherent and fast (no lookup tables). Range ~[-1.5, 1.5].
function noise2D(x: number, y: number, t: number): number {
  return (
    Math.sin(x * 1.30 + t * 0.71) * Math.cos(y * 1.72 - t * 0.53) +
    Math.sin(x * 0.72 - y * 1.13 + t * 0.31) * 0.55 +
    Math.cos(x * 0.41 + y * 0.63 - t * 0.19) * 0.35
  );
}

// Curl of noise2D — divergence-free 2D flow, so nearby sparks swirl together
// in visible eddies (real fluid-motion feel) instead of drifting apart.
function curl2D(x: number, y: number, t: number): [number, number] {
  const e = 0.08;
  const nyp = noise2D(x, y + e, t);
  const nyn = noise2D(x, y - e, t);
  const nxp = noise2D(x + e, y, t);
  const nxn = noise2D(x - e, y, t);
  return [(nyp - nyn) / (2 * e), -(nxp - nxn) / (2 * e)];
}

function emberColor(
  tintR: number, tintG: number, tintB: number, t: number
): [number, number, number] {
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
const MAX_ASH = 1000;
const MAX_CINDERS = 400;
const MAX_GLOWS = 32;

// ============================================================================
// WebGL2 post-processing pipeline
// ============================================================================

type PostFX = {
  gl: WebGL2RenderingContext;
  update: (
    source: HTMLCanvasElement,
    dw: number, dh: number,
    tSec: number,
    bloomStrength: number,
    shimmerAmp: number,
  ) => void;
  resize: (dw: number, dh: number) => void;
  destroy: () => void;
};

const VS_QUAD = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FS_UPLOAD = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 fragColor;
void main() {
  vec4 c = texture(uTex, vec2(vUv.x, 1.0 - vUv.y));
  fragColor = c;
}`;

const FS_BRIGHT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uThreshold;
uniform float uKnee;
out vec4 fragColor;
void main() {
  vec4 c = texture(uTex, vUv);
  float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Soft-knee threshold
  float soft = clamp((lum - uThreshold + uKnee) / (2.0 * uKnee + 1e-5), 0.0, 1.0);
  soft = soft * soft * (uKnee > 0.0 ? 1.0 : 1.0);
  float w = max(soft, max(lum - uThreshold, 0.0)) / max(lum, 1e-5);
  fragColor = vec4(c.rgb * w, 1.0);
}`;

const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir; // texel-space direction
out vec4 fragColor;
void main() {
  // 9-tap Gaussian (sigma ~2). Symmetric weights.
  float w[5];
  w[0] = 0.2270270270;
  w[1] = 0.1945945946;
  w[2] = 0.1216216216;
  w[3] = 0.0540540541;
  w[4] = 0.0162162162;
  vec3 acc = texture(uTex, vUv).rgb * w[0];
  for (int i = 1; i < 5; i++) {
    vec2 off = uDir * float(i);
    acc += texture(uTex, vUv + off).rgb * w[i];
    acc += texture(uTex, vUv - off).rgb * w[i];
  }
  fragColor = vec4(acc, 1.0);
}`;

const FS_COMPOSITE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uSource;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform float uBloomStrength;
uniform float uShimmerAmp;
uniform float uTime;
uniform vec2  uAspect; // (w/h, 1) — for isotropic noise coords
out vec4 fragColor;

// hash → smooth noise
float h21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = h21(i);
  float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0));
  float d = h21(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

void main() {
  // Heat shimmer: displace UVs upward-biased by scrolling noise.
  vec2 nUv = vUv * uAspect * vec2(3.0, 6.0);
  float nx = vnoise(nUv + vec2(uTime * 0.15, uTime * 0.9));
  float ny = vnoise(nUv + vec2(-uTime * 0.11, uTime * 1.3) + 17.0);
  vec2 disp = vec2(nx - 0.5, (ny - 0.5) - 0.15) * uShimmerAmp * 0.006;
  vec2 srcUv = clamp(vUv + disp, vec2(0.0), vec2(1.0));

  vec3 base = texture(uSource, srcUv).rgb;

  // Bloom composite (multi-scale).
  vec3 bloom = texture(uBloom1, vUv).rgb * 0.6
             + texture(uBloom2, vUv).rgb * 1.1;
  bloom *= uBloomStrength;

  vec3 col = base + bloom;

  // Gentle filmic tonemap so highlights don't clip to flat white.
  col = col / (1.0 + col * 0.75);
  // Subtle vignette hint from bloom brightness — sells "photographed light".
  fragColor = vec4(col, 1.0);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.warn("[fire postfx] shader compile:", gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function linkProgram(gl: WebGL2RenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn("[fire postfx] link:", gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

function createFbo(gl: WebGL2RenderingContext, w: number, h: number): { tex: WebGLTexture; fbo: WebGLFramebuffer } | null {
  const tex = gl.createTexture();
  const fbo = gl.createFramebuffer();
  if (!tex || !fbo) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo };
}

function initPostFX(canvas: HTMLCanvasElement): PostFX | null {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: false,
    antialias: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) return null;

  const progUpload = linkProgram(gl, VS_QUAD, FS_UPLOAD);
  const progBright = linkProgram(gl, VS_QUAD, FS_BRIGHT);
  const progBlur   = linkProgram(gl, VS_QUAD, FS_BLUR);
  const progComp   = linkProgram(gl, VS_QUAD, FS_COMPOSITE);
  if (!progUpload || !progBright || !progBlur || !progComp) return null;

  // Fullscreen quad
  const vao = gl.createVertexArray();
  const vbo = gl.createBuffer();
  if (!vao || !vbo) return null;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1, 1,
     1, -1,  1,  1,  -1, 1,
  ]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  const srcTex = gl.createTexture();
  if (!srcTex) return null;
  gl.bindTexture(gl.TEXTURE_2D, srcTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  let fboSrc: ReturnType<typeof createFbo> = null;
  let fboBright: ReturnType<typeof createFbo> = null;
  let fboB1a: ReturnType<typeof createFbo> = null;
  let fboB1b: ReturnType<typeof createFbo> = null;
  let fboB2a: ReturnType<typeof createFbo> = null;
  let fboB2b: ReturnType<typeof createFbo> = null;
  let curW = 0, curH = 0;

  const resize = (dw: number, dh: number) => {
    if (dw === curW && dh === curH) return;
    curW = dw; curH = dh;
    canvas.width = dw;
    canvas.height = dh;
    // Free old
    for (const f of [fboSrc, fboBright, fboB1a, fboB1b, fboB2a, fboB2b]) {
      if (f) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); }
    }
    fboSrc    = createFbo(gl, dw, dh);
    fboBright = createFbo(gl, Math.max(1, dw >> 1), Math.max(1, dh >> 1));
    fboB1a    = createFbo(gl, Math.max(1, dw >> 1), Math.max(1, dh >> 1));
    fboB1b    = createFbo(gl, Math.max(1, dw >> 1), Math.max(1, dh >> 1));
    fboB2a    = createFbo(gl, Math.max(1, dw >> 2), Math.max(1, dh >> 2));
    fboB2b    = createFbo(gl, Math.max(1, dw >> 2), Math.max(1, dh >> 2));
  };

  const drawQuad = () => {
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  const update = (
    source: HTMLCanvasElement,
    dw: number, dh: number,
    tSec: number,
    bloomStrength: number,
    shimmerAmp: number,
  ) => {
    resize(dw, dh);
    if (!fboSrc || !fboBright || !fboB1a || !fboB1b || !fboB2a || !fboB2b) return;

    // Upload source canvas → srcTex, then blit (Y-flipped) into fboSrc so all
    // subsequent passes work in a single orientation.
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // Pass 0: source → fboSrc (flip Y)
    gl.useProgram(progUpload);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboSrc.fbo);
    gl.viewport(0, 0, dw, dh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(gl.getUniformLocation(progUpload, "uTex"), 0);
    drawQuad();

    // Pass 1: bright pass @ 1/2 res
    const w1 = Math.max(1, dw >> 1), h1 = Math.max(1, dh >> 1);
    gl.useProgram(progBright);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboBright.fbo);
    gl.viewport(0, 0, w1, h1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboSrc.tex);
    gl.uniform1i(gl.getUniformLocation(progBright, "uTex"), 0);
    gl.uniform1f(gl.getUniformLocation(progBright, "uThreshold"), 0.55);
    gl.uniform1f(gl.getUniformLocation(progBright, "uKnee"), 0.35);
    drawQuad();

    // Pass 2: blur H → fboB1a (from bright)
    gl.useProgram(progBlur);
    const uTexBlur = gl.getUniformLocation(progBlur, "uTex");
    const uDirBlur = gl.getUniformLocation(progBlur, "uDir");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB1a.fbo);
    gl.viewport(0, 0, w1, h1);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboBright.tex);
    gl.uniform1i(uTexBlur, 0);
    gl.uniform2f(uDirBlur, 1.0 / w1, 0.0);
    drawQuad();
    // Blur V → fboB1b
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB1b.fbo);
    gl.bindTexture(gl.TEXTURE_2D, fboB1a.tex);
    gl.uniform2f(uDirBlur, 0.0, 1.0 / h1);
    drawQuad();

    // Pass 3: downsample-and-blur @ 1/4 res for large-radius bloom
    const w2 = Math.max(1, dw >> 2), h2 = Math.max(1, dh >> 2);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB2a.fbo);
    gl.viewport(0, 0, w2, h2);
    gl.bindTexture(gl.TEXTURE_2D, fboB1b.tex);
    gl.uniform2f(uDirBlur, 1.0 / w2, 0.0);
    drawQuad();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB2b.fbo);
    gl.bindTexture(gl.TEXTURE_2D, fboB2a.tex);
    gl.uniform2f(uDirBlur, 0.0, 1.0 / h2);
    drawQuad();

    // Pass 4: composite → screen
    gl.useProgram(progComp);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, dw, dh);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboSrc.tex);
    gl.uniform1i(gl.getUniformLocation(progComp, "uSource"), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, fboB1b.tex);
    gl.uniform1i(gl.getUniformLocation(progComp, "uBloom1"), 1);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, fboB2b.tex);
    gl.uniform1i(gl.getUniformLocation(progComp, "uBloom2"), 2);
    gl.uniform1f(gl.getUniformLocation(progComp, "uBloomStrength"), bloomStrength);
    gl.uniform1f(gl.getUniformLocation(progComp, "uShimmerAmp"), shimmerAmp);
    gl.uniform1f(gl.getUniformLocation(progComp, "uTime"), tSec);
    gl.uniform2f(gl.getUniformLocation(progComp, "uAspect"), dw / Math.max(1, dh), 1.0);
    drawQuad();
  };

  const destroy = () => {
    for (const f of [fboSrc, fboBright, fboB1a, fboB1b, fboB2a, fboB2b]) {
      if (f) { gl.deleteTexture(f.tex); gl.deleteFramebuffer(f.fbo); }
    }
    if (srcTex) gl.deleteTexture(srcTex);
    if (vbo) gl.deleteBuffer(vbo);
    if (vao) gl.deleteVertexArray(vao);
    for (const p of [progUpload, progBright, progBlur, progComp]) if (p) gl.deleteProgram(p);
  };

  return { gl, update, resize, destroy };
}

// ============================================================================
// Layer
// ============================================================================

export function createFireLayer(parent: HTMLElement): FireLayer {
  // Visible WebGL2 canvas (post-process output).
  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.inset = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.display = "block";
  canvas.style.mixBlendMode = "screen";
  parent.appendChild(canvas);

  const postfx = initPostFX(canvas);

  // Offscreen source canvas for Canvas2D particle rendering.
  const sourceCanvas = document.createElement("canvas");
  const ctx = sourceCanvas.getContext("2d", { alpha: true }) as CanvasRenderingContext2D | null;

  const particles: Particle[] = [];
  const ash: Ash[] = [];
  const cinders: Cinder[] = [];
  const glows: GlowBurst[] = [];

  // Layer-global post-fx settings (updated by every spawn).
  const cfg = {
    bloom: 1.2,
    shimmer: 0.9,
    trails: 0.35,
    turbulence: 0.9,
    wind: 40,
    afterglow: 1.0,
    glow: 0.9,
    chroma: 1.2,
  };

  const layer: FireLayer = {
    canvas,
    gl: postfx ? postfx.gl : null,
    particles,
    spawn: () => {},
    render: () => {},
    resize: () => {},
    destroy: () => {},
  };

  if (!ctx) {
    console.warn("[fireShaderLayer] Canvas2D unavailable; fire-spark burst will be a no-op.");
    layer.destroy = () => {
      registry.delete(layer);
      postfx?.destroy();
      canvas.remove();
    };
    registry.add(layer);
    return layer;
  }

  // If WebGL2 is unavailable, show the source canvas directly instead.
  if (!postfx) {
    console.warn("[fireShaderLayer] WebGL2 unavailable — falling back to Canvas2D-only fire (no bloom).");
    canvas.remove();
    sourceCanvas.style.cssText = canvas.style.cssText;
    parent.appendChild(sourceCanvas);
  }

  const activeVisible = postfx ? canvas : sourceCanvas;

  let dpr = window.devicePixelRatio || 1;
  let cssW = 1, cssH = 1;
  let dw = 1, dh = 1;

  const resize = () => {
    dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, activeVisible.clientWidth);
    const h = Math.max(1, activeVisible.clientHeight);
    cssW = w; cssH = h;
    dw = Math.floor(w * dpr);
    dh = Math.floor(h * dpr);
    if (sourceCanvas.width !== dw || sourceCanvas.height !== dh) {
      sourceCanvas.width = dw;
      sourceCanvas.height = dh;
    }
    if (postfx) postfx.resize(dw, dh);
    else {
      if (canvas.width !== dw || canvas.height !== dh) {
        canvas.width = dw;
        canvas.height = dh;
      }
    }
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(activeVisible);

  let lastRenderTime = -1;

  layer.spawn = (cssX, cssY, tSec, opts) => {
    resize();
    const shortSide = Math.min(cssW, cssH);
    const burstScale = Math.max(0.02, Math.min(0.8, opts.size)) * shortSide;
    const intensity = Math.max(0, opts.intensity);
    const life = Math.max(0.1, opts.life);

    const count = Math.max(4, Math.round(6 + intensity * 5));

    const x0 = Number.isFinite(cssX) ? cssX : cssW / 2;
    const y0 = Number.isFinite(cssY) ? cssY : cssH / 2;

    const speedMul = Math.max(0.05, Math.min(8, opts.speed ?? 1));
    const baseSpeed = burstScale * 3.0 * speedMul;
    const ashRateBase = Math.max(0, Math.min(4, opts.ashRate ?? 1)) * 0.12;

    // Update layer-global post-fx settings from the latest spawn opts.
    if (opts.bloom      !== undefined) cfg.bloom      = Math.max(0, Math.min(3,    opts.bloom));
    if (opts.shimmer    !== undefined) cfg.shimmer    = Math.max(0, Math.min(2,    opts.shimmer));
    if (opts.trails     !== undefined) cfg.trails     = Math.max(0, Math.min(0.97, opts.trails));
    if (opts.turbulence !== undefined) cfg.turbulence = Math.max(0, Math.min(3,    opts.turbulence));
    if (opts.wind       !== undefined) cfg.wind       = Math.max(-200, Math.min(200, opts.wind));
    if (opts.afterglow  !== undefined) cfg.afterglow  = Math.max(0, Math.min(2,    opts.afterglow));
    if (opts.glow       !== undefined) cfg.glow       = Math.max(0, Math.min(2,    opts.glow));
    if (opts.chroma     !== undefined) cfg.chroma     = Math.max(0, Math.min(3,    opts.chroma));

    // Register a reactive glow burst for warm ambient underlay.
    if (cfg.glow > 0) {
      glows.push({
        x: x0, y: y0,
        born: tSec,
        radius: burstScale * 2.4,
        tint: opts.tint,
        decay: Math.max(0.4, life * 0.9),
        strength: cfg.glow * (0.4 + intensity * 0.08),
      });
      if (glows.length > MAX_GLOWS) glows.splice(0, glows.length - MAX_GLOWS);
    }

    for (let i = 0; i < count; i++) {
      const seed = tSec * 1000 + i * 17.31 + Math.random() * 1000;
      const ang = Math.random() * Math.PI * 2;
      const speed = baseSpeed * (0.5 + Math.random() * 0.9);
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed - baseSpeed * 0.35 * Math.random();

      const jitter = 0.6 + Math.random() * 0.8;
      const lenRoll = Math.pow(Math.random(), 1.8);
      const baseL = 5 + lenRoll * 21;
      const widthRoll = Math.pow(Math.random(), 1.4);
      const baseW = 1.8 + widthRoll * 4.7;
      particles.push({
        x: x0, y: y0, px: x0, py: y0,
        vx, vy,
        born: tSec,
        life: life * (0.55 + Math.random() * 0.9),
        r0: Math.max(1.2, burstScale * 0.055 * jitter),
        bright: 0.7 + Math.random() * 0.6,
        tint: opts.tint,
        seed,
        ph1: Math.random() * Math.PI * 2,
        ph2: Math.random() * Math.PI * 2,
        wFreq1: 0.6 + Math.random() * 0.7,
        wFreq2: 1.7 + Math.random() * 1.4,
        curlAmp: speed * (0.9 + Math.random() * 0.7),
        prevTheta: 0,
        baseL, baseW,
        aspectPhase: Math.random() * Math.PI * 2,
        aspectFreq: 1.5 + Math.random() * 2.5,
        hotPhase: Math.random() * Math.PI * 2,
        flickerPhase: Math.random() * Math.PI * 2,
        flickerFreq: 12 + Math.random() * 18,
        curvePhase: Math.random() * Math.PI * 2,
        curveFreq: 0.8 + Math.random() * 1.4,
        curveAmp: (Math.random() * 0.14) - 0.02,
        haloScale: 0.7 + Math.random() * 0.9,
        haloAlphaMul: 0.55 + Math.random() * 1.1,
        ashRate: ashRateBase,
        afterglowSpawn: cfg.afterglow > 0 && Math.random() < 0.55 ? 1 : 0,
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // ---------- Persistence trails: fade previous frame instead of clearing ----------
    if (cfg.trails <= 0.001) {
      ctx.clearRect(0, 0, dw, dh);
    } else {
      // destination-out with (0,0,0,fadeAlpha) subtracts alpha uniformly.
      // Higher trails → smaller fadeAlpha → longer trails.
      const fadeAlpha = Math.max(0.01, 1 - cfg.trails);
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${fadeAlpha.toFixed(3)})`;
      ctx.fillRect(0, 0, dw, dh);
    }

    ctx.globalCompositeOperation = "lighter";

    // ---------- Reactive glow underlay (warm ambient at active bursts) ----------
    for (let i = glows.length - 1; i >= 0; i--) {
      const g = glows[i];
      const age = tSec - g.born;
      const k = age / g.decay;
      if (k >= 1 || age < 0) { glows.splice(i, 1); continue; }
      const gA = (1 - k) * (1 - k) * 0.05 * g.strength;
      if (gA < 0.001) continue;
      const [gr, gg, gb] = [
        Math.round(g.tint[0] * 255),
        Math.round(g.tint[1] * 255),
        Math.round(g.tint[2] * 255),
      ];
      const gx = g.x * dpr, gy = g.y * dpr;
      const gr_ = g.radius * dpr * (1 + k * 0.4);
      const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr_);
      grad.addColorStop(0.0, `rgba(${gr},${gg},${gb},${gA.toFixed(3)})`);
      grad.addColorStop(0.5, `rgba(${gr},${gg},${gb},${(gA * 0.35).toFixed(3)})`);
      grad.addColorStop(1.0, `rgba(${gr},${gg},${gb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(gx, gy, gr_, 0, Math.PI * 2);
      ctx.fill();
    }

    if (particles.length === 0 && ash.length === 0 && cinders.length === 0) {
      // Still push to WebGL so the fade effect finishes visually.
      if (postfx) postfx.update(sourceCanvas, dw, dh, tSec, cfg.bloom, cfg.shimmer);
      return;
    }

    const GRAV = 25;
    const DRAG = 0.5;
    const dragK = Math.pow(DRAG, dt);

    // Curl-noise sampling scale (fine enough for visible eddies inside a burst
    // radius, coarse enough that nearby sparks share flow direction).
    const CURL_SCALE = 0.006;
    const CURL_FLOW  = 0.35;
    const CURL_AMP   = 55 * cfg.turbulence;
    const WIND_UP    = cfg.wind; // + = up

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      const age = tSec - p.born;
      const t = age / p.life;
      if (t >= 1 || age < 0) {
        // Emit a cooling cinder at death (if enabled).
        if (p.afterglowSpawn && cinders.length < MAX_CINDERS) {
          cinders.push({
            x: p.x, y: p.y,
            vx: p.vx * 0.15 + (Math.random() - 0.5) * 8,
            vy: p.vy * 0.15 - 5 - Math.random() * 8,
            born: tSec,
            life: 1.8 + Math.random() * 1.8,
            r0: 1.3 + Math.random() * 1.4,
            tint: p.tint,
          });
        }
        particles.splice(i, 1);
        continue;
      }

      // Original meander (kept for per-particle character on top of turbulence).
      const theta =
        0.75 * Math.sin(p.wFreq1 * age * 2 * Math.PI + p.ph1) +
        0.35 * Math.sin(p.wFreq2 * age * 2 * Math.PI + p.ph2);
      const dTheta = theta - p.prevTheta;
      p.prevTheta = theta;

      const sp = Math.hypot(p.vx, p.vy);
      if (sp > 0.01) {
        const px_ = -p.vy / sp;
        const py_ = p.vx / sp;
        const curlFade = 1 - t * 0.4;
        const aCurl = p.curlAmp * dTheta / Math.max(dt, 1e-3) * curlFade;
        const aCurlClamped = Math.max(-p.curlAmp * 4, Math.min(p.curlAmp * 4, aCurl));
        p.vx += px_ * aCurlClamped * dt;
        p.vy += py_ * aCurlClamped * dt;
      }

      // Curl-noise turbulence: shared flow field → nearby sparks swirl together.
      if (CURL_AMP > 0) {
        const [cx, cy] = curl2D(p.x * CURL_SCALE, p.y * CURL_SCALE, tSec * CURL_FLOW);
        p.vx += cx * CURL_AMP * dt;
        p.vy += cy * CURL_AMP * dt;
      }

      p.vy += GRAV * 0.3 * dt;
      p.vy -= WIND_UP * dt; // upward push
      p.vx *= dragK;
      p.vy *= dragK;
      p.px = p.x; p.py = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Birth flash: sharp brightness/size boost for first ~60ms of life.
      const birth = 1 + 0.6 * Math.exp(-age * 24);

      const shrink = (1 - t * 0.65) * (0.9 + 0.1 * birth);
      const alpha = Math.pow(1 - t, 1.35) * p.bright;
      const flick = 0.75 + 0.25 * Math.sin(tSec * p.flickerFreq + p.flickerPhase)
                          + 0.10 * Math.sin(tSec * p.flickerFreq * 0.37 + p.flickerPhase * 1.7);
      const a = Math.max(0, Math.min(1, alpha * flick * birth));
      if (a <= 0.002) continue;

      const speed = Math.hypot(p.vx, p.vy);
      const headingBase = speed > 0.1 ? Math.atan2(p.vy, p.vx) : (p.seed % (Math.PI * 2));
      const ang = headingBase + p.curveAmp * Math.sin(tSec * p.curveFreq + p.curvePhase);

      const lMod = 1 + 0.35 * Math.sin(tSec * p.aspectFreq + p.aspectPhase);
      const wMod = 1 + 0.25 * Math.sin(tSec * p.aspectFreq * 1.7 + p.aspectPhase + 1.2);
      const speedStretch = 1 + Math.min(0.6, speed * 0.0015);
      const L = Math.max(3, p.baseL * lMod * shrink * speedStretch);
      const W = Math.max(1.2, p.baseW * wMod * shrink / Math.max(1, speedStretch * 0.6));

      const [cr, cg, cb] = emberColor(p.tint[0], p.tint[1], p.tint[2], t);

      const jx = (Math.sin(tSec * 41 + p.seed) * 0.5);
      const jy = (Math.cos(tSec * 37 + p.seed * 1.3) * 0.5);
      const cxw = (p.x + jx) * dpr;
      const cyw = (p.y + jy) * dpr;

      // --- Halo ---
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

      // --- Tail smear ---
      {
        const TL = L * 1.35, TW = W * 0.55;
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

      // --- Main body ---
      ctx.setTransform(
        dpr * cos * (L * 0.5), dpr * sin * (L * 0.5),
        -dpr * sin * (W * 0.5), dpr * cos * (W * 0.5),
        cxw, cyw,
      );
      const hotX = 0.15 + 0.4 * Math.sin(tSec * 3.1 + p.hotPhase);
      const grad = ctx.createRadialGradient(hotX, 0, 0, 0, 0, 1);
      grad.addColorStop(0.00, `rgba(255,248,225,${Math.min(1, a * 1.1).toFixed(3)})`);
      grad.addColorStop(0.18, `rgba(${cr},${cg},${cb},${(a * 0.95).toFixed(3)})`);
      grad.addColorStop(0.55, `rgba(${cr},${cg},${cb},${(a * 0.55).toFixed(3)})`);
      grad.addColorStop(1.00, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, Math.PI * 2);
      ctx.fill();

      // --- Hot nucleus + chromatic aberration split ---
      {
        const NL = L * 0.28, NW = W * 0.55;
        const nShift = L * (0.10 + 0.15 * Math.sin(tSec * 2.7 + p.hotPhase * 1.3));
        const ncx = cxw + cos * nShift * dpr;
        const ncy = cyw + sin * nShift * dpr;
        const nA = Math.min(1, a * 1.3);

        // Chroma split: draw nucleus 3 times in pure R/G/B with tiny offsets.
        // Additive blending sums them back to white at zero offset, splits to
        // colored fringes at edges.
        const chromaPx = cfg.chroma * dpr;
        const channels: Array<[number, number, number, number, number]> = chromaPx > 0.05 ? [
          [255,   0,   0,  chromaPx,  0],
          [  0, 255,   0,  0,         0],
          [  0,   0, 255, -chromaPx,  0],
        ] : [
          [255, 248, 225, 0, 0],
        ];
        for (const [rr, gg, bb, ox, oy] of channels) {
          ctx.setTransform(
            dpr * cos * (NL * 0.5), dpr * sin * (NL * 0.5),
            -dpr * sin * (NW * 0.5), dpr * cos * (NW * 0.5),
            ncx + ox * cos - oy * sin, ncy + ox * sin + oy * cos,
          );
          const ng = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          if (chromaPx > 0.05) {
            // channels-mode: each pass contributes one primary
            ng.addColorStop(0.0, `rgba(${rr},${gg},${bb},${(nA * 0.7).toFixed(3)})`);
            ng.addColorStop(0.5, `rgba(${rr},${gg},${bb},${(nA * 0.28).toFixed(3)})`);
            ng.addColorStop(1.0, `rgba(${rr},${gg},${bb},0)`);
          } else {
            ng.addColorStop(0.0, `rgba(255,253,240,${nA.toFixed(3)})`);
            ng.addColorStop(0.5, `rgba(255,230,180,${(nA * 0.5).toFixed(3)})`);
            ng.addColorStop(1.0, `rgba(255,200,120,0)`);
          }
          ctx.fillStyle = ng;
          ctx.beginPath();
          ctx.arc(0, 0, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // --- Ash flecks ---
      if (p.ashRate > 0 && ash.length < MAX_ASH && Math.random() < p.ashRate * (1 - t)) {
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

    // ---------- Ash flecks ----------
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

    // ---------- Cooling embers (afterglow) ----------
    for (let i = cinders.length - 1; i >= 0; i--) {
      const c = cinders[i];
      const age = tSec - c.born;
      const k = age / c.life;
      if (k >= 1 || age < 0) { cinders.splice(i, 1); continue; }
      // gentle upward drift with slight wobble
      c.vx += Math.sin(age * 1.7 + c.born) * 6 * dt;
      c.vy -= 8 * dt; // buoyant rise
      c.vx *= 0.985; c.vy *= 0.985;
      c.x += c.vx * dt; c.y += c.vy * dt;
      // deep-red → smoke color ramp
      const k2 = k;
      const rr = Math.round(mix(200, 60, k2));
      const gg = Math.round(mix(40, 20, k2));
      const bb = Math.round(mix(20, 15, k2));
      const al = (1 - k) * (1 - k) * 0.55 * cfg.afterglow;
      const r = c.r0 * dpr * (1 + k * 0.6);
      const cx = c.x * dpr, cy = c.y * dpr;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
      grd.addColorStop(0.0, `rgba(${rr},${gg},${bb},${al.toFixed(3)})`);
      grd.addColorStop(0.4, `rgba(${rr},${gg},${bb},${(al * 0.4).toFixed(3)})`);
      grd.addColorStop(1.0, `rgba(${rr},${gg},${bb},0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";

    // ---------- WebGL2 post-process → screen ----------
    if (postfx) {
      postfx.update(sourceCanvas, dw, dh, tSec, cfg.bloom, cfg.shimmer);
    }
  };

  layer.resize = resize;
  layer.destroy = () => {
    ro.disconnect();
    registry.delete(layer);
    particles.length = 0;
    ash.length = 0;
    cinders.length = 0;
    glows.length = 0;
    postfx?.destroy();
    canvas.remove();
    sourceCanvas.remove();
  };

  registry.add(layer);
  return layer;
}

export function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1.0, 0.55, 0.15];
  const v = parseInt(m[1], 16);
  return [((v >> 16) & 0xff) / 255, ((v >> 8) & 0xff) / 255, (v & 0xff) / 255];
}
