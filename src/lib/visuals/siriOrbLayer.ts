const VERTEX_SHADER = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;

// Siri-style fluid dots shader adapted for drawing many small orbs through one
// shared WebGL canvas. The metaball constants and motion vocabulary mirror the
// reference fluid-dots component; iOrigin lets each orb render into a scissored
// square while preserving the reference's local iResolution/iTime model.
const FLUID_DOTS_SHADER = `precision highp float;
uniform vec2 iResolution;
uniform vec2 iOrigin;
uniform float iTime;
uniform float iEnergy;
uniform float iHue;
uniform float iSeed;

const float TAU = 6.28318530718;
const int   N   = 6;
const float SMOOTH_K = 0.08;
const float INTENSITY  = 0.0025;
const float FALLOFF_P  = 1.35;
const float FADE_START = 0.02;
const float FADE_END   = 0.56;
const float ABERR = 0.005;
const vec3  SPECTRAL = vec3(0.0, 0.5, 1.0) * ABERR;
const float HUE_SPEED = 0.06;
const float COLOR_K   = 0.5;
const float SAT       = 0.01;
const float HUE_SPAN  = 0.667;
const float MERGE_PERIOD = 6.0;
const float T_MOVE   = 1.25;
const float STAGGER  = 0.33;
const float HOLD     = 0.0;
const float W = 4.6;
const float L = 3.2;
const float PIERCE  = 0.12;
const float RECOIL  = 0.035;
const float REC_LAG = 0.11;
const float GATHER_PERIOD = 12.0;
const float GATHER_START  = 9.2;
const float GATHER_HOLD   = 0.8;
const float GATHER_R      = 0.008;
const float GATHER_DIM    = 0.85;
const float GATHER_IN     = 1.8;
const float GATHER_IN_L   = 7.5;
const float BURST_W = 6.5;
const float BURST_L = 4.0;
const float CHARGE_T     = 0.30;
const float CHARGE_SHRK  = 0.18;
const float CHARGE_GLOW  = 0.35;
const float FLASH_GAIN   = 1.2;
const float FLASH_DECAY  = 7.0;

float hash11(float n){ return fract(sin(n*127.1 + 311.7)*43758.5453); }
float settleWL(float tau, float w, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*cos(w*tau);
}
float settle(float tau){ return settleWL(tau, W, L); }
float settleCrit(float tau, float l){
    if(tau <= 0.0) return 0.0;
    return 1.0 - exp(-l*tau)*(1.0 + l*tau);
}
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

vec4 scene(vec2 p, float t){
    float k  = floor(t/MERGE_PERIOD);
    float u  = fract(t/MERGE_PERIOD);
    float te = u * MERGE_PERIOD;

    float tg = mod(t, GATHER_PERIOD);
    float g  = settleCrit((tg - GATHER_START) * GATHER_IN, GATHER_IN_L)
             - settleWL(tg - GATHER_START - GATHER_HOLD, BURST_W, BURST_L);
    float gC = clamp(g, 0.0, 1.0);
    float tb     = tg - (GATHER_START + GATHER_HOLD);
    float charge = smoothstep(-CHARGE_T, 0.0, min(tb, 0.0)) * gC;
    float flash  = tb > 0.0 ? exp(-tb * FLASH_DECAY) : 0.0;
    float gBright = mix(1.0, GATHER_DIM, gC) * (1.0 + CHARGE_GLOW*charge + FLASH_GAIN*flash + 1.35*iEnergy);

    vec3 total3 = vec3(1e5);
    vec3 cAcc = vec3(0.0);
    float wAcc = 1e-6;

    for(int i=0; i<N; i++){
        float fi = float(i);
        float seed = hash11(fi + k*11.7 + iSeed*19.1);
        float a = TAU*(fi/float(N)) + k*0.31 + 0.18*sin(t*0.25 + iSeed);

        vec2 radial = vec2(cos(a), sin(a));
        vec2 home = radial * (0.105 + 0.025*sin(t*0.74 + seed*TAU));
        vec2 scatter = vec2(cos(a*1.61 + seed*TAU + t*0.17), sin(a*1.27 - seed*TAU + t*0.21))
                     * (0.205 + 0.035*seed);

        float tau = te - fi*STAGGER;
        float launch = settle(tau*T_MOVE);
        float returnHome = settle(tau*T_MOVE - (1.65 + HOLD));
        float travel = clamp(launch - returnHome, 0.0, 1.0);
        float recoil = settleWL(tau - REC_LAG, W, L) * (1.0 - travel);

        vec2 pos = mix(home, scatter * (1.0 + PIERCE), travel);
        pos -= radial * RECOIL * recoil;
        pos = mix(pos, radial * GATHER_R, gC);

        float r = dotR(fi, seed, t) * (1.0 - CHARGE_SHRK*charge + 0.22*flash + 0.22*iEnergy);
        float shapeDamp = mix(1.0, 0.28, gC);

        vec2 ab = vec2(SPECTRAL.r, -SPECTRAL.r);
        total3.r = smin(total3.r, dotSD(p + ab, pos, r, t, fi, shapeDamp), SMOOTH_K);
        ab = vec2(SPECTRAL.g, -SPECTRAL.g);
        total3.g = smin(total3.g, dotSD(p + ab, pos, r, t, fi, shapeDamp), SMOOTH_K);
        ab = vec2(SPECTRAL.b, -SPECTRAL.b);
        total3.b = smin(total3.b, dotSD(p + ab, pos, r, t, fi, shapeDamp), SMOOTH_K);

        float hw = 0.65 + 0.35*sin(t*0.23 + fi + seed*TAU);
        cAcc += hue2rgb(iHue + HUE_SPEED*t + HUE_SPAN*fi/float(N)) * hw;
        wAcc += hw;
    }

    float d = (total3.r + total3.g + total3.b) / 3.0;
    float body = smoothstep(FADE_END, FADE_START, d);
    float glow = INTENSITY / pow(max(d + 0.052, 0.002), FALLOFF_P);
    glow = clamp(glow, 0.0, 1.85);

    vec3 spectralEdge = vec3(
        smoothstep(FADE_END, FADE_START, total3.r),
        smoothstep(FADE_END, FADE_START, total3.g),
        smoothstep(FADE_END, FADE_START, total3.b)
    );
    vec3 tint = cAcc / wAcc;
    tint = mix(vec3(1.0), tint, COLOR_K);
    tint = mix(vec3(dot(tint, vec3(0.333))), tint, SAT + 0.42);

    vec3 col = tint * (body*1.35 + glow*2.35) + spectralEdge*0.30*body;
    col += vec3(1.0) * pow(body, 3.0) * (0.85 + iEnergy*0.8);
    col *= gBright;

    float alpha = clamp(body*0.86 + glow*0.58, 0.0, 1.0);
    return vec4(max(col, 0.0), alpha);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 q = fragCoord - iOrigin;
    if(q.x < 0.0 || q.y < 0.0 || q.x > iResolution.x || q.y > iResolution.y){
        fragColor = vec4(0.0);
        return;
    }
    vec2 R = iResolution.xy;
    vec2 p = (q + 0.5) * 2.0 / R - 1.0;
    p.x *= R.x / R.y;
    vec4 s = scene(p, iTime + iSeed*17.0);
    float vign = smoothstep(1.16, 0.68, length(p));
    fragColor = vec4(s.rgb * vign, s.a * vign);
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
    origin: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    energy: WebGLUniformLocation | null;
    hue: WebGLUniformLocation | null;
    seed: WebGLUniformLocation | null;
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
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.scissor(0, 0, canvas.width, canvas.height);
    gl.enable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    for (const orb of this.commands) {
      const sizePx = Math.round(orb.size * dpr);
      const xPx = Math.round((orb.x - orb.size / 2) * dpr);
      const yPx = Math.round((cssH - orb.y - orb.size / 2) * dpr);
      if (xPx > canvas.width || yPx > canvas.height || xPx + sizePx < 0 || yPx + sizePx < 0) continue;

      gl.viewport(xPx, yPx, sizePx, sizePx);
      gl.scissor(xPx, yPx, sizePx, sizePx);
      gl.uniform2f(this.uniforms.resolution, sizePx, sizePx);
      gl.uniform2f(this.uniforms.origin, xPx, yPx);
      gl.uniform1f(this.uniforms.time, this.time * 0.82);
      gl.uniform1f(this.uniforms.energy, orb.energy);
      gl.uniform1f(this.uniforms.hue, orb.hue);
      gl.uniform1f(this.uniforms.seed, hashSeed(orb.id));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.disable(gl.SCISSOR_TEST);
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
        origin: gl.getUniformLocation(program, "iOrigin"),
        time: gl.getUniformLocation(program, "iTime"),
        energy: gl.getUniformLocation(program, "iEnergy"),
        hue: gl.getUniformLocation(program, "iHue"),
        seed: gl.getUniformLocation(program, "iSeed"),
      };
    } catch (err) {
      console.warn("[siri-orb] WebGL unavailable", err);
      this.failed = true;
      this.destroy();
    }
  }
}

export const siriOrbLayer = new SiriOrbLayer();