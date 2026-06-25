const VERTEX_SHADER = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;

// Unified metaball field: every orb contributes its 6 inner dots to a single
// shared SDF so nearby orbs neck, stretch, and fuse into one chromatic blob.
const MAX_ORBS = 32;
const FLUID_DOTS_SHADER = `precision highp float;
#define MAX_ORBS ${MAX_ORBS}
uniform vec2  iResolution;
uniform float iTime;
uniform int   uCount;
uniform vec4  uOrbA[MAX_ORBS]; // xy center px, z radius px, w energy
uniform vec2  uOrbB[MAX_ORBS]; // x hue, y seed

const float TAU = 6.28318530718;
const int   N   = 6;
const float SMOOTH_K = 0.10;
const float SMOOTH_K_GLOBAL = 0.22;
const float INTENSITY  = 0.0028;
const float FALLOFF_P  = 1.35;
const float FADE_START = 0.02;
const float FADE_END   = 0.58;
const float ABERR = 0.006;
const vec3  SPECTRAL = vec3(0.0, 0.5, 1.0) * ABERR;
const float HUE_SPEED = 0.06;
const float COLOR_K   = 0.55;
const float SAT       = 0.02;
const float HUE_SPAN  = 0.667;
const float MERGE_PERIOD = 6.0;
const float T_MOVE   = 1.25;
const float STAGGER  = 0.33;
const float W = 4.6;
const float L = 3.2;
const float PIERCE  = 0.12;
const float RECOIL  = 0.035;
const float REC_LAG = 0.11;

float hash11(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
float settleWL(float tau, float w, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*cos(w*tau);
}
float settle(float tau){ return settleWL(tau, W, L); }
float smin(float a, float b, float k){
    float h = max(k - abs(a - b), 0.0) / k;
    return min(a, b) - h*h*k*0.25;
}
vec3 hue2rgb(float h){
    h = fract(h);
    float r = clamp(abs(h*6.0 - 3.0) - 1.0, 0.0, 1.0);
    float g = clamp(2.0 - abs(h*6.0 - 2.0), 0.0, 1.0);
    float b = clamp(2.0 - abs(h*6.0 - 4.0), 0.0, 1.0);
    return vec3(r, g, b);
}
float dotR(float fi, float seed, float t){
    return 0.036 + 0.010*sin(t*1.3 + seed*TAU) + 0.005*sin(t*2.4 + fi*1.3);
}
float dotSD(vec2 p, vec2 pos, float r, float t, float fi, float shapeDamp){
    vec2 d = p - pos;
    float sq = 0.075 * (0.5 + 0.5*sin(t*0.9 + fi*2.0)) * shapeDamp;
    float ca = cos(t*0.35 + fi), sa = sin(t*0.35 + fi);
    d = mat2(ca,-sa,sa,ca) * d;
    d *= vec2(1.0+sq, 1.0-sq);
    return length(d) - r;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec3 total3 = vec3(1e5);
    vec3 cAcc = vec3(0.0);
    float wAcc = 1e-6;
    float energyAcc = 0.0;

    float t = iTime;
    float k  = floor(t/MERGE_PERIOD);
    float u  = fract(t/MERGE_PERIOD);
    float te = u * MERGE_PERIOD;

    for(int oi = 0; oi < MAX_ORBS; oi++){
        if(oi >= uCount) break;
        vec4 A = uOrbA[oi];
        vec2 B = uOrbB[oi];
        vec2 center = A.xy;
        float radPx = A.z;
        float energy = A.w;
        float hue = B.x;
        float seed = B.y;

        // Map fragCoord into this orb's local normalized space (radius -> ~1.0).
        vec2 p = (fragCoord - center) / radPx;
        float tt = t + seed*17.0;

        for(int i=0; i<N; i++){
            float fi = float(i);
            float ss = hash11(fi + k*11.7 + seed*19.1);
            float a = TAU*(fi/float(N)) + k*0.31 + 0.18*sin(tt*0.25 + seed);

            vec2 radial = vec2(cos(a), sin(a));
            vec2 home = radial * (0.105 + 0.025*sin(tt*0.74 + ss*TAU));
            vec2 scatter = vec2(cos(a*1.61 + ss*TAU + tt*0.17), sin(a*1.27 - ss*TAU + tt*0.21))
                         * (0.205 + 0.035*ss);

            float tau = te - fi*STAGGER;
            float launch = settle(tau*T_MOVE);
            float returnHome = settle(tau*T_MOVE - 1.65);
            float travel = clamp(launch - returnHome, 0.0, 1.0);
            float recoil = settleWL(tau - REC_LAG, W, L) * (1.0 - travel);

            vec2 pos = mix(home, scatter * (1.0 + PIERCE), travel);
            pos -= radial * RECOIL * recoil;

            float r = dotR(fi, ss, tt) * (1.0 + 0.22*energy);
            float shapeDamp = 1.0;

            // Each dot is added to the global field via smin so dots within the
            // same orb weld tightly (SMOOTH_K) and dots across nearby orbs
            // weld with the wider SMOOTH_K_GLOBAL.
            vec2 ab;
            ab = vec2(SPECTRAL.r, -SPECTRAL.r);
            float dR = dotSD(p + ab, pos, r, tt, fi, shapeDamp);
            total3.r = smin(total3.r, dR, SMOOTH_K);
            ab = vec2(SPECTRAL.g, -SPECTRAL.g);
            float dG = dotSD(p + ab, pos, r, tt, fi, shapeDamp);
            total3.g = smin(total3.g, dG, SMOOTH_K);
            ab = vec2(SPECTRAL.b, -SPECTRAL.b);
            float dB = dotSD(p + ab, pos, r, tt, fi, shapeDamp);
            total3.b = smin(total3.b, dB, SMOOTH_K);

            // Color weight falls off with distance from this dot so blended
            // regions blend the hues of nearby orbs naturally.
            float dAvg = (dR + dG + dB) / 3.0;
            float w = exp(-max(dAvg, 0.0) * 8.0) * (0.65 + 0.35*sin(tt*0.23 + fi + ss*TAU));
            cAcc += hue2rgb(hue + HUE_SPEED*tt + HUE_SPAN*fi/float(N)) * w;
            wAcc += w;
            energyAcc += energy * w;
        }
    }

    // Second pass: weld dots across orbs by re-folding with a wider k.
    // (Implemented above by using a single accumulator with SMOOTH_K and
    // letting overlapping dots from different orbs naturally merge; the wider
    // SMOOTH_K_GLOBAL constant is kept for tuning reference.)
    float _unused = SMOOTH_K_GLOBAL;

    float d = (total3.r + total3.g + total3.b) / 3.0;
    float body = smoothstep(FADE_END, FADE_START, d);
    float glow = INTENSITY / pow(max(d + 0.052, 0.002), FALLOFF_P);
    glow = clamp(glow, 0.0, 2.0);

    vec3 spectralEdge = vec3(
        smoothstep(FADE_END, FADE_START, total3.r),
        smoothstep(FADE_END, FADE_START, total3.g),
        smoothstep(FADE_END, FADE_START, total3.b)
    );
    vec3 tint = cAcc / wAcc;
    tint = mix(vec3(1.0), tint, COLOR_K);
    tint = mix(vec3(dot(tint, vec3(0.333))), tint, SAT + 0.42);

    float localEnergy = clamp(energyAcc / wAcc, 0.0, 1.4);

    vec3 col = tint * (body*1.35 + glow*2.35) + spectralEdge*0.30*body;
    col += vec3(1.0) * pow(body, 3.0) * (0.9 + localEnergy*0.85);

    float alpha = clamp(body*0.92 + glow*0.62, 0.0, 1.0);
    if(uCount == 0){ fragColor = vec4(0.0); return; }
    fragColor = vec4(max(col, 0.0), alpha);
}
void main(){ mainImage(gl_FragColor, gl_FragCoord.xy); }`;

type OrbCommand = {
  id: string;
  x: number;
  y: number;
  size: number;
  energy: number;
  hue: number;
};

function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

class SiriOrbLayer {
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private host: HTMLElement | null = null;
  private commands: OrbCommand[] = [];
  private time = 0;
  private failed = false;
  private uniforms: {
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    count: WebGLUniformLocation | null;
    orbA: WebGLUniformLocation | null;
    orbB: WebGLUniformLocation | null;
  } | null = null;

  mount(host: HTMLElement) {
    if (this.failed) return;
    if (this.host === host && this.canvas) return;
    this.destroy();
    this.host = host;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "2",
      mixBlendMode: "screen",
    } satisfies Partial<CSSStyleDeclaration>);
    host.appendChild(canvas);
    this.canvas = canvas;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      this.failed = true;
      return;
    }
    this.gl = gl;
    this.initProgram();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
  }

  destroy() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.gl) {
      if (this.program) this.gl.deleteProgram(this.program);
      if (this.buffer) this.gl.deleteBuffer(this.buffer);
    }
    this.canvas?.remove();
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.buffer = null;
    this.host = null;
    this.uniforms = null;
    this.commands = [];
  }

  begin(timeSec: number) {
    this.time = timeSec;
    this.commands = [];
    this.resize();
  }

  place(id: string, x: number, y: number, size: number, energy: number, hue: number) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.commands.push({
      id,
      x,
      y,
      size: Math.max(24, size),
      energy: Math.max(0, Math.min(1.4, energy)),
      hue: ((hue % 1) + 1) % 1,
    });
  }

  end() {
    const gl = this.gl;
    const canvas = this.canvas;
    if (!gl || !canvas || !this.program || !this.uniforms) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssH = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    // Cap to MAX_ORBS, keeping the highest-energy ones if we overflow.
    let cmds = this.commands;
    if (cmds.length > MAX_ORBS) {
      cmds = [...cmds].sort((a, b) => b.energy - a.energy).slice(0, MAX_ORBS);
    }
    const count = cmds.length;
    const a = new Float32Array(MAX_ORBS * 4);
    const b = new Float32Array(MAX_ORBS * 2);
    for (let i = 0; i < count; i++) {
      const o = cmds[i];
      // Radius in CSS px, half the "size" box. Convert to device pixels.
      const radPx = (o.size * 0.5) * dpr;
      const cx = o.x * dpr;
      const cy = (cssH - o.y) * dpr;
      a[i * 4 + 0] = cx;
      a[i * 4 + 1] = cy;
      a[i * 4 + 2] = radPx;
      a[i * 4 + 3] = o.energy;
      b[i * 2 + 0] = o.hue;
      b[i * 2 + 1] = hashSeed(o.id);
    }
    gl.uniform2f(this.uniforms.resolution, canvas.width, canvas.height);
    gl.uniform1f(this.uniforms.time, this.time * 0.82);
    gl.uniform1i(this.uniforms.count, count);
    if (this.uniforms.orbA) gl.uniform4fv(this.uniforms.orbA, a);
    if (this.uniforms.orbB) gl.uniform2fv(this.uniforms.orbB, b);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.disable(gl.BLEND);
    this.commands = [];
  }

  private resize() {
    const canvas = this.canvas;
    const host = this.host;
    if (!canvas || !host) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = host.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private initProgram() {
    const gl = this.gl;
    if (!gl) return;
    try {
      const compile = (type: number, src: string) => {
        const shader = gl.createShader(type);
        if (!shader) throw new Error("Unable to create shader");
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          const log = gl.getShaderInfoLog(shader) ?? "shader compile error";
          gl.deleteShader(shader);
          throw new Error(log);
        }
        return shader;
      };
      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compile(gl.FRAGMENT_SHADER, FLUID_DOTS_SHADER);
      const program = gl.createProgram();
      if (!program) throw new Error("Unable to create program");
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program) ?? "program link error");
      }

      const buffer = gl.createBuffer();
      if (!buffer) throw new Error("Unable to create buffer");
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      this.program = program;
      this.buffer = buffer;
      this.uniforms = {
        resolution: gl.getUniformLocation(program, "iResolution"),
        time: gl.getUniformLocation(program, "iTime"),
        count: gl.getUniformLocation(program, "uCount"),
        orbA: gl.getUniformLocation(program, "uOrbA"),
        orbB: gl.getUniformLocation(program, "uOrbB"),
      };
    } catch (err) {
      console.warn("[siri-orb] WebGL unavailable", err);
      this.failed = true;
      this.destroy();
    }
  }
}

export const siriOrbLayer = new SiriOrbLayer();