import { deterministicUnit, type GraphicsLabBackend } from "./graphicsLab";

export type AtmosphereRenderInput = {
  width: number;
  height: number;
  visualSeconds: number;
  reducedMotion: boolean;
  cloudLayers: number;
  particleCount: number;
};

export type AtmosphereRenderer = {
  backend: GraphicsLabBackend;
  render: (input: AtmosphereRenderInput) => void;
  dispose: () => void;
};

/**
 * Comparative graphics boundary only. Both implementations consume decorative
 * visual time and never import or emit rhythm, audio, route, or gameplay state.
 */
export function createAtmosphereRenderer(
  backend: GraphicsLabBackend,
  canvas: HTMLCanvasElement,
): AtmosphereRenderer {
  return backend === "webgl-2" ? createWebGlRenderer(canvas) : createCanvasRenderer(canvas);
}

function createCanvasRenderer(canvas: HTMLCanvasElement): AtmosphereRenderer {
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Canvas 2D is unavailable on this device.");

  const particleSeeds = Array.from({ length: 64 }, (_, index) => ({
    x: deterministicUnit(0x50484153, index * 4),
    y: deterministicUnit(0x50484153, index * 4 + 1),
    depth: 0.2 + deterministicUnit(0x50484153, index * 4 + 2) * 0.8,
    drift: 0.18 + deterministicUnit(0x50484153, index * 4 + 3) * 0.42,
  }));

  return {
    backend: "canvas-2d",
    render: ({ width, height, visualSeconds, reducedMotion, cloudLayers, particleCount }) => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.filter = "none";
      context.globalCompositeOperation = "source-over";

      const sky = context.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, "#5f96bd");
      sky.addColorStop(0.38, "#8fbbd1");
      sky.addColorStop(0.52, "#d4e4e9");
      sky.addColorStop(0.7, "#95b4c3");
      sky.addColorStop(1, "#4f7289");
      context.fillStyle = sky;
      context.fillRect(0, 0, width, height);

      const light = context.createRadialGradient(
        width * 0.72,
        height * 0.15,
        0,
        width * 0.72,
        height * 0.15,
        Math.max(width, height) * 0.5,
      );
      light.addColorStop(0, "rgba(248, 252, 245, 0.74)");
      light.addColorStop(0.2, "rgba(222, 239, 239, 0.28)");
      light.addColorStop(1, "rgba(158, 200, 216, 0)");
      context.fillStyle = light;
      context.fillRect(0, 0, width, height);

      const horizonY = height * 0.51;
      context.fillStyle = "rgba(241, 248, 249, 0.38)";
      context.fillRect(0, horizonY, width, Math.max(1, height * 0.006));

      context.save();
      context.globalCompositeOperation = "screen";
      for (let layer = 0; layer < cloudLayers; layer += 1) {
        const depth = (layer + 1) / (cloudLayers + 1);
        const drift = reducedMotion ? 0 : visualSeconds * (1.2 + depth * 4.8);
        const y = horizonY + height * (0.025 + depth * 0.37);
        const cloudWidth = width * (0.14 + depth * 0.46);
        const cloudHeight = height * (0.018 + depth * 0.075);
        const blur = Math.max(5, width * (0.003 + depth * 0.008));
        context.filter = `blur(${blur}px)`;
        context.fillStyle = `rgba(${198 + layer * 5}, ${220 + layer * 4}, ${
          226 + layer * 3
        }, ${0.1 + depth * 0.16})`;

        for (let cloud = -2; cloud < 6; cloud += 1) {
          const period = width + cloudWidth * 2;
          const rawX = cloud * cloudWidth * 0.72 + drift * (layer % 2 === 0 ? 1 : -1);
          const x = (((rawX % period) + period) % period) - cloudWidth;
          context.beginPath();
          context.ellipse(
            x,
            y + Math.sin(cloud * 1.7 + layer * 0.9) * cloudHeight * 0.42,
            cloudWidth * 0.56,
            cloudHeight,
            -0.035 + depth * 0.06,
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      context.restore();

      const lowerAir = context.createLinearGradient(0, horizonY, 0, height);
      lowerAir.addColorStop(0, "rgba(231, 242, 244, 0)");
      lowerAir.addColorStop(0.35, "rgba(185, 210, 220, 0.13)");
      lowerAir.addColorStop(1, "rgba(48, 82, 104, 0.42)");
      context.fillStyle = lowerAir;
      context.fillRect(0, horizonY, width, height - horizonY);

      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = 0; index < particleCount; index += 1) {
        const particle = particleSeeds[index];
        if (!particle) continue;
        const travel = reducedMotion ? 0 : (visualSeconds * particle.drift * 0.009) % 1;
        const y = height * (0.54 + ((particle.y + travel) % 1) * 0.46);
        const x = width * 0.5 + (particle.x - 0.5) * width * (0.24 + (y / height) * 0.9);
        const radius = 0.35 + particle.depth * 1.15;
        context.fillStyle = `rgba(230, 246, 248, ${0.04 + particle.depth * 0.12})`;
        context.beginPath();
        context.arc(x, y, radius, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();

      context.strokeStyle = "rgba(235, 248, 249, 0.24)";
      context.lineWidth = Math.max(1, width / 2200);
      context.beginPath();
      context.moveTo(width * 0.08, horizonY);
      context.lineTo(width * 0.92, horizonY);
      context.stroke();
    },
    dispose: () => {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.filter = "none";
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}

function createWebGlRenderer(canvas: HTMLCanvasElement): AtmosphereRenderer {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error("WebGL2 is unavailable; use the Canvas 2D comparison.");

  const vertexShader = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
    in vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }`,
  );
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
    precision highp float;
    uniform vec2 uResolution;
    uniform float uTime;
    uniform float uMotion;
    uniform float uCloudLayers;
    out vec4 outColor;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 345.45));
      p += dot(p, p + 34.345);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0)), f.x), f.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.52;
      for (int octave = 0; octave < 6; octave++) {
        if (float(octave) >= uCloudLayers) break;
        value += amplitude * noise(p);
        p = p * 2.03 + vec2(17.1, 9.2);
        amplitude *= 0.5;
      }
      return value;
    }

    void main() {
      vec2 uv = gl_FragCoord.xy / uResolution;
      vec2 centered = (gl_FragCoord.xy * 2.0 - uResolution) / min(uResolution.x, uResolution.y);
      float time = uTime * uMotion;

      vec3 lower = vec3(0.25, 0.43, 0.56);
      vec3 horizon = vec3(0.80, 0.89, 0.92);
      vec3 zenith = vec3(0.24, 0.48, 0.66);
      vec3 sky = mix(lower, horizon, smoothstep(0.02, 0.50, uv.y));
      sky = mix(sky, zenith, smoothstep(0.50, 1.0, uv.y));

      vec2 sunPoint = vec2(0.42, 0.68);
      float sun = exp(-7.0 * length(centered - sunPoint));
      sky += vec3(0.30, 0.34, 0.30) * sun;

      float belowHorizon = 1.0 - smoothstep(0.48, 0.56, uv.y);
      float depth = clamp((0.54 - uv.y) / 0.54, 0.0, 1.0);
      vec2 cloudUv = vec2(centered.x * (0.58 + depth) + time * 0.009,
                          centered.y * 1.3 - time * 0.0015);
      float field = fbm(cloudUv * 2.2 + vec2(0.0, 2.4));
      float broad = fbm(cloudUv * 0.68 - vec2(time * 0.003, 1.1));
      float cloudField = smoothstep(0.31, 0.79, field * 0.74 + broad * 0.58);
      float cloudMask = belowHorizon * cloudField * (0.36 + depth * 0.64);
      vec3 cloudColor = mix(vec3(0.43, 0.61, 0.70), vec3(0.88, 0.94, 0.95), field);
      sky = mix(sky, cloudColor, cloudMask * 0.76);

      float horizonLine = 1.0 - smoothstep(0.0, 0.006, abs(uv.y - 0.515));
      sky = mix(sky, vec3(0.94, 0.97, 0.97), horizonLine * 0.22);

      float vignette = smoothstep(1.5, 0.22, length(centered * vec2(0.7, 0.92)));
      sky *= 0.79 + vignette * 0.21;
      float grain = hash(gl_FragCoord.xy + floor(uTime * 8.0)) - 0.5;
      sky += grain * 0.006;
      outColor = vec4(sky, 1.0);
    }`,
  );

  const program = gl.createProgram();
  if (!program) throw new Error("WebGL2 program creation failed.");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || "Unknown WebGL2 link error.";
    gl.deleteProgram(program);
    throw new Error(message);
  }

  const buffer = gl.createBuffer();
  if (!buffer) throw new Error("WebGL2 geometry buffer creation failed.");
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

  const position = gl.getAttribLocation(program, "aPosition");
  const resolution = gl.getUniformLocation(program, "uResolution");
  const time = gl.getUniformLocation(program, "uTime");
  const motion = gl.getUniformLocation(program, "uMotion");
  const cloudLayers = gl.getUniformLocation(program, "uCloudLayers");

  gl.useProgram(program);
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  return {
    backend: "webgl-2",
    render: (input) => {
      gl.viewport(0, 0, input.width, input.height);
      gl.useProgram(program);
      gl.uniform2f(resolution, input.width, input.height);
      gl.uniform1f(time, input.visualSeconds);
      gl.uniform1f(motion, input.reducedMotion ? 0 : 1);
      gl.uniform1f(cloudLayers, input.cloudLayers);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    },
  };
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL2 shader creation failed.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Unknown WebGL2 shader error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}
