import { useEffect, useRef, useState } from "react";
import { flashBus } from "@/lib/neural/flashBus";
import {
  loadNeuralSettings,
  subscribeNeuralSettings,
  presetById,
  type NeuralSettings,
} from "@/lib/neural/palette";

type Props = {
  /** Override settings; otherwise uses persisted/global settings. */
  settings?: NeuralSettings;
  /** z-index for the canvas (default 0). */
  zIndex?: number;
  /** CSS mix-blend-mode for the canvas (default "plus-lighter"). */
  blendMode?: string;
};

/**
 * Global, reactive neural-noise background.
 * - Slow "breathing" gradient blend between two colors.
 * - Cursor brightens a local region.
 * - flashBus.flash(x,y,intensity) lights up a transient bloom at viewport-normalized coords.
 * SSR-safe: only mounts canvas after first client render.
 */
export function NeuralNoise({ settings, zIndex = 0, blendMode = "plus-lighter" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [live, setLive] = useState<NeuralSettings | null>(null);

  useEffect(() => {
    setMounted(true);
    setLive(settings ?? loadNeuralSettings());
    if (settings) return;
    return subscribeNeuralSettings((s) => setLive(s));
  }, [settings]);

  useEffect(() => {
    if (!mounted || !live) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true }) ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) {
      // eslint-disable-next-line no-console
      console.warn("NeuralNoise: WebGL unavailable");
      return;
    }

    const vs = `
      precision mediump float;
      attribute vec2 a_position;
      varying vec2 vUv;
      void main() {
        vUv = 0.5 * (a_position + 1.0);
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fs = `
      precision mediump float;
      varying vec2 vUv;
      uniform float u_time;
      uniform float u_ratio;
      uniform vec2  u_pointer;
      uniform vec3  u_colorA;
      uniform vec3  u_colorB;
      uniform float u_mix;       // 0..1 breathing blend
      uniform float u_speed;
      uniform float u_opacity;
      uniform vec2  u_flash_pos;
      uniform float u_flash_int;
      uniform float u_reduce;    // 0 normal, 1 reduced motion

      vec2 rot(vec2 uv, float th) {
        return mat2(cos(th), sin(th), -sin(th), cos(th)) * uv;
      }
      float neuro(vec2 uv, float t, float p) {
        vec2 acc = vec2(0.0);
        vec2 res = vec2(0.0);
        float scale = 8.0;
        for (int j = 0; j < 14; j++) {
          uv  = rot(uv, 1.0);
          acc = rot(acc, 1.0);
          vec2 layer = uv * scale + float(j) + acc - t;
          acc += sin(layer) + 2.4 * p;
          res += (0.5 + 0.5 * cos(layer)) / scale;
          scale *= 1.2;
        }
        return res.x + res.y;
      }

      void main() {
        vec2 uv = 0.5 * vUv;
        uv.x *= u_ratio;

        // cursor influence
        vec2 ptr = vUv - u_pointer;
        ptr.x *= u_ratio;
        float p = clamp(length(ptr), 0.0, 1.0);
        // very gentle cursor warp — barely perceptible drift
        p = 0.18 * pow(1.0 - p, 2.0);

        // flash is decoupled from distortion: it only adds a soft additive bloom
        vec2 fp = vUv - u_flash_pos;
        fp.x *= u_ratio;
        float fd = length(fp);
        float flash = u_flash_int * exp(-fd * 9.0);

        float t = u_speed * u_time * (u_reduce > 0.5 ? 0.0 : 1.0);
        float noise = neuro(uv, t, p);
        // softer contrast — keep faint filaments visible everywhere, no white-out
        noise = pow(noise, 1.6);
        noise = max(0.0, noise - 0.18);
        // gentle vignette: corners keep ~55% weight instead of fading to 0
        noise *= mix(0.55, 1.0, 1.0 - length(vUv - 0.5));
        // hard cap so peaks can't saturate to pure white
        noise = min(noise, 0.55);

        // gradient between A & B via breathing mix + spatial drift
        float g = clamp(u_mix * 0.6 + 0.4 * vUv.y + 0.2 * vUv.x, 0.0, 1.0);
        vec3 col = mix(u_colorA, u_colorB, g) * noise;

        // gentle additive bloom in the palette color (no geometry warp)
        vec3 bloomCol = mix(u_colorA, u_colorB, g);
        col += bloomCol * flash * 0.12;

        float a = noise * u_opacity * 0.9 + flash * 0.18 * u_opacity;
        gl_FragColor = vec4(col, clamp(a, 0.0, 0.6));
      }
    `;

    const compile = (src: string, type: number) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        // eslint-disable-next-line no-console
        console.error("NeuralNoise shader:", gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vsh = compile(vs, gl.VERTEX_SHADER);
    const fsh = compile(fs, gl.FRAGMENT_SHADER);
    if (!vsh || !fsh) return;
    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      // eslint-disable-next-line no-console
      console.error("NeuralNoise link:", gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    const verts = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, "a_position");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = {
      time: gl.getUniformLocation(prog, "u_time"),
      ratio: gl.getUniformLocation(prog, "u_ratio"),
      pointer: gl.getUniformLocation(prog, "u_pointer"),
      colorA: gl.getUniformLocation(prog, "u_colorA"),
      colorB: gl.getUniformLocation(prog, "u_colorB"),
      mix: gl.getUniformLocation(prog, "u_mix"),
      speed: gl.getUniformLocation(prog, "u_speed"),
      opacity: gl.getUniformLocation(prog, "u_opacity"),
      flashPos: gl.getUniformLocation(prog, "u_flash_pos"),
      flashInt: gl.getUniformLocation(prog, "u_flash_int"),
      reduce: gl.getUniformLocation(prog, "u_reduce"),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const state = {
      ptr: { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 },
      flash: { x: 0.5, y: 0.5, level: 0, target: 0 },
      live: live!,
    };

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform1f(u.ratio, w / h);
    };
    resize();
    window.addEventListener("resize", resize);

    const onPointer = (x: number, y: number) => {
      state.ptr.tx = x / window.innerWidth;
      state.ptr.ty = 1 - y / window.innerHeight;
    };
    const onPM = (e: PointerEvent) => onPointer(e.clientX, e.clientY);
    const onTM = (e: TouchEvent) => {
      if (e.targetTouches[0]) onPointer(e.targetTouches[0].clientX, e.targetTouches[0].clientY);
    };
    window.addEventListener("pointermove", onPM, { passive: true });
    window.addEventListener("touchmove", onTM, { passive: true });

    const unsubFlash = flashBus.subscribe((f) => {
      if (reduceMotion) return;
      state.flash.x = f.x;
      state.flash.y = 1 - f.y; // shader uses gl-style y-up
      // raise the *target* — actual level eases toward it (no snap)
      state.flash.target = Math.min(1, state.flash.target + 0.25 + f.intensity * 0.35);
    });

    let raf = 0;
    let last = performance.now();
    const startedAt = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.066, (now - last) / 1000);
      last = now;
      const s = state.live;
      const preset = presetById(s.presetId);
      const colorA = preset.color;
      const colorB = preset.colorB ?? preset.color;

      // ease pointer
      state.ptr.x += (state.ptr.tx - state.ptr.x) * 0.04;
      state.ptr.y += (state.ptr.ty - state.ptr.y) * 0.04;
      // flash envelope: soft attack (~250ms), long release (~1.4s)
      const attack = 1 - Math.exp(-dt / 0.25);
      const release = 1 - Math.exp(-dt / 1.4);
      state.flash.level += (state.flash.target - state.flash.level) * attack;
      state.flash.target += (0 - state.flash.target) * release;

      const elapsed = (now - startedAt) / 1000;
      const breath = 0.5 + 0.5 * Math.sin(elapsed * (Math.PI * 2) / 18);

      gl.uniform1f(u.time, now);
      gl.uniform2f(u.pointer, state.ptr.x, state.ptr.y);
      gl.uniform3f(u.colorA, colorA[0], colorA[1], colorA[2]);
      gl.uniform3f(u.colorB, colorB[0], colorB[1], colorB[2]);
      gl.uniform1f(u.mix, breath);
      gl.uniform1f(u.speed, 0.00009 * Math.max(0, s.speed));
      gl.uniform1f(u.opacity, Math.max(0, Math.min(0.55, s.opacity * 1.6)));
      gl.uniform2f(u.flashPos, state.flash.x, state.flash.y);
      gl.uniform1f(u.flashInt, state.flash.level);
      gl.uniform1f(u.reduce, reduceMotion ? 1 : 0);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };

    // keep state.live current
    const unsubSettings = settings
      ? () => {}
      : subscribeNeuralSettings((s) => { state.live = s; });
    if (settings) state.live = settings;

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPM);
      window.removeEventListener("touchmove", onTM);
      unsubFlash();
      unsubSettings();
      try {
        gl.deleteProgram(prog);
        gl.deleteShader(vsh);
        gl.deleteShader(fsh);
        gl.deleteBuffer(buf);
      } catch {
        /* ignore */
      }
    };
  }, [mounted, live, settings]);

  if (!mounted) return null;
  const op = live?.opacity ?? 0.35;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex,
        mixBlendMode: blendMode as React.CSSProperties["mixBlendMode"],
        opacity: op > 0 ? 1 : 0,
        transition: "opacity 300ms ease",
      }}
    />
  );
}

export default NeuralNoise;