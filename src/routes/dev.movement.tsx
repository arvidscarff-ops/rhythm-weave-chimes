/**
 * SYS-006 developer movement sandbox — PROTOTYPE, NON-CANON.
 *
 * Diagnostic surface only. Everything visible here (visuals, bindings,
 * defaults, presets, camera) exists so movement feel can be experimented with,
 * not to define PHASE movement. Deletable without touching any other system.
 *
 * Ownership:
 *   - this route owns the rAF loop and derives dt from monotonic rAF
 *     timestamps (no TimeSource indirection; engineClock untouched)
 *   - movementModel owns the simulation maths and clamps pathological dt
 *   - the keyboard adapter only normalizes device state
 *   - the camera reads movement state and never writes to it
 * No audio, no trigger engines, no crossing ownership.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_MOVEMENT_PARAMS,
  createMovementState,
  headingOf,
  lateralSpeedOf,
  speedOf,
  stepMovement,
  type MovementInput,
  type MovementParams,
  type MovementState,
} from "@/lib/movement/movementModel";
import { createKeyboardInputAdapter } from "@/lib/movement/movementInput";
import {
  DEFAULT_CAMERA_PARAMS,
  createCameraState,
  stepCamera,
  type CameraParams,
  type CameraState,
} from "@/lib/movement/movementCamera";
import { MOVEMENT_PRESETS } from "@/lib/movement/movementPresets";
import { PerfProbeMount } from "@/components/dev/PerfProbeMount";

export const Route = createFileRoute("/dev/movement")({
  ssr: false,
  component: MovementSandbox,
  head: () => ({
    meta: [
      { title: "Transit Movement Sandbox · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Developer diagnostic sandbox for the SYS-006 transit movement prototype: steering feel, damping and camera parameters.",
      },
    ],
  }),
});

/** Sparse depth markers: a fixed lattice the craft flies through. */
const MARKERS = (() => {
  const out: { x: number; y: number; z: number }[] = [];
  // Deterministic lattice — no Math.random, so nothing changes between reloads.
  for (let ring = 0; ring < 60; ring++) {
    const z = ring * 40;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + ring * 0.21;
      const r = 60 + ((ring * 37) % 40);
      out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.55, z });
    }
  }
  return out;
})();
const LATTICE_DEPTH = 60 * 40;

const MOVEMENT_SLIDERS: {
  key: keyof MovementParams;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "baseSpeed", label: "BASE SPEED (forward, +Z)", min: 0, max: 80, step: 0.5 },
  { key: "steeringStrength", label: "STEERING STRENGTH", min: 0, max: 2, step: 0.01 },
  { key: "acceleration", label: "ACCELERATION (1/s)", min: 0.2, max: 14, step: 0.1 },
  { key: "damping", label: "DAMPING / RELEASE (1/s)", min: 0.1, max: 12, step: 0.1 },
  { key: "maxLateralSpeed", label: "MAX LATERAL SPEED (|x,y|)", min: 0, max: 40, step: 0.5 },
  { key: "forwardResponse", label: "FORWARD RESPONSE (1/s)", min: 0.2, max: 10, step: 0.1 },
];

const CAMERA_SLIDERS: {
  key: keyof CameraParams;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  { key: "followStrength", label: "CAMERA FOLLOW", min: 0.2, max: 12, step: 0.1 },
  { key: "lookAhead", label: "CAMERA LOOK-AHEAD (s)", min: 0, max: 2, step: 0.01 },
  { key: "damping", label: "CAMERA DAMPING", min: 0.2, max: 12, step: 0.1 },
  { key: "distance", label: "CAMERA DISTANCE", min: 2, max: 40, step: 0.5 },
  { key: "height", label: "CAMERA HEIGHT", min: -10, max: 20, step: 0.5 },
];

function MovementSandbox() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [params, setParams] = useState<MovementParams>({ ...DEFAULT_MOVEMENT_PARAMS });
  const [cameraParams, setCameraParams] = useState<CameraParams>({ ...DEFAULT_CAMERA_PARAMS });
  const [copied, setCopied] = useState(false);

  // Live params for the loop without re-subscribing rAF on every slider tick.
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const cameraParamsRef = useRef(cameraParams);
  cameraParamsRef.current = cameraParams;

  // Simulation state lives in refs; React only renders the readout at ~10 Hz.
  const moveRef = useRef<MovementState>(createMovementState(DEFAULT_MOVEMENT_PARAMS));
  const camRef = useRef<CameraState>(createCameraState(moveRef.current, DEFAULT_CAMERA_PARAMS));
  const inputRef = useRef<MovementInput>({ steerX: 0, steerY: 0 });
  const dtRef = useRef(0);

  const [readout, setReadout] = useState(() => ({
    move: moveRef.current,
    input: inputRef.current,
    dt: 0,
  }));

  const reset = useCallback(() => {
    // Reset goes through the model's explicit initializer, not route state.
    moveRef.current = createMovementState(paramsRef.current);
    camRef.current = createCameraState(moveRef.current, cameraParamsRef.current);
    dtRef.current = 0;
  }, []);

  useEffect(() => {
    const keyboard = createKeyboardInputAdapter(window);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d") ?? null;

    let raf = 0;
    let last = 0;
    let lastUi = 0;

    const resize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    };
    resize();
    window.addEventListener("resize", resize);

    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      // dt from monotonic rAF timestamps; the model clamps pathological values.
      const dt = last === 0 ? 0 : (t - last) / 1000;
      last = t;
      dtRef.current = dt;

      const input = keyboard.read();
      inputRef.current = input;
      moveRef.current = stepMovement(moveRef.current, input, dt, paramsRef.current);
      camRef.current = stepCamera(camRef.current, moveRef.current, dt, cameraParamsRef.current);

      if (ctx && canvas) draw(ctx, canvas, moveRef.current, camRef.current);

      if (t - lastUi > 100) {
        lastUi = t;
        setReadout({ move: moveRef.current, input, dt });
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      keyboard.dispose();
    };
  }, []);

  const copySettings = async () => {
    const json = JSON.stringify({ sys: "SYS-006", prototype: true, movement: params, camera: cameraParams }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — surface the JSON so it can still be copied by hand.
      window.prompt("Copy settings JSON", json);
    }
  };

  const heading = useMemo(() => headingOf(readout.move), [readout.move]);

  const rows: [string, string][] = [
    ["POSITION", `x ${readout.move.position.x.toFixed(2)}  y ${readout.move.position.y.toFixed(2)}  z ${readout.move.position.z.toFixed(1)}`],
    ["VELOCITY", `x ${readout.move.velocity.x.toFixed(2)}  y ${readout.move.velocity.y.toFixed(2)}  z ${readout.move.velocity.z.toFixed(2)}`],
    ["SPEED", `${speedOf(readout.move).toFixed(2)} (lateral ${lateralSpeedOf(readout.move).toFixed(2)} / cap ${params.maxLateralSpeed})`],
    ["HEADING", `yaw ${(heading.yaw * 57.2958).toFixed(1)}°  pitch ${(heading.pitch * 57.2958).toFixed(1)}°`],
    ["STEER", `x ${readout.input.steerX.toFixed(2)}  y ${readout.input.steerY.toFixed(2)}`],
    ["DELTA TIME", `${(readout.dt * 1000).toFixed(2)} ms`],
  ];

  return (
    <main style={{ fontFamily: "monospace", padding: 24, maxWidth: 1100 }}>
      <PerfProbeMount />
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>SYS-006 transit movement sandbox</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16, maxWidth: 720 }}>
        Diagnostic only — prototype pending Codex review. Nothing here is canon: equations, defaults,
        presets, camera, visuals, key bindings and baseline speed are all experiment material.
        Steer with W/A/S/D or the arrow keys. Releasing the keys is the interesting part. Append{" "}
        <code>?perf=1</code> to enable the SYS-005 profiler probe.
      </p>

      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: 380,
          display: "block",
          background: "#05070a",
          border: "1px solid #1d2530",
          borderRadius: 4,
          marginBottom: 16,
        }}
      />

      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-start" }}>
        <section style={{ minWidth: 320, flex: "1 1 320px" }}>
          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 8 }}>MOVEMENT PARAMETERS</div>
          {MOVEMENT_SLIDERS.map((s) => (
            <label key={s.key} style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
              {s.label}: {params[s.key].toFixed(2)}
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={params[s.key]}
                onChange={(e) => setParams((p) => ({ ...p, [s.key]: Number(e.target.value) }))}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          ))}

          <div style={{ opacity: 0.6, fontSize: 12, margin: "16px 0 8px" }}>CAMERA (separate)</div>
          {CAMERA_SLIDERS.map((s) => (
            <label key={s.key} style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
              {s.label}: {cameraParams[s.key].toFixed(2)}
              <input
                type="range"
                min={s.min}
                max={s.max}
                step={s.step}
                value={cameraParams[s.key]}
                onChange={(e) => setCameraParams((p) => ({ ...p, [s.key]: Number(e.target.value) }))}
                style={{ display: "block", width: "100%" }}
              />
            </label>
          ))}
        </section>

        <section style={{ minWidth: 300, flex: "1 1 300px" }}>
          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 8 }}>DEV PRESETS (not modes, not canon)</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {MOVEMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => setParams({ ...preset.params })}
                title={preset.note}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
            <button
              onClick={() => {
                setParams({ ...DEFAULT_MOVEMENT_PARAMS });
                setCameraParams({ ...DEFAULT_CAMERA_PARAMS });
                reset();
              }}
            >
              RESET DEFAULTS
            </button>
            <button onClick={reset}>RESET POSITION</button>
            <button onClick={copySettings}>{copied ? "COPIED" : "COPY SETTINGS"}</button>
          </div>

          <div style={{ opacity: 0.6, fontSize: 12, marginBottom: 8 }}>DEBUG READOUT</div>
          <table style={{ fontSize: 12 }}>
            <tbody>
              {rows.map(([k, v]) => (
                <tr key={k}>
                  <td style={{ paddingRight: 14, opacity: 0.6, verticalAlign: "top" }}>{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ opacity: 0.6, fontSize: 12, margin: "16px 0 6px" }}>ACTIVE PARAMS</div>
          <pre style={{ fontSize: 11, opacity: 0.8, margin: 0, whiteSpace: "pre-wrap" }}>
            {JSON.stringify({ movement: params, camera: cameraParams }, null, 1)}
          </pre>
        </section>
      </div>
    </main>
  );
}

/**
 * Deliberately cheap Canvas2D perspective render: a fixed marker lattice, a
 * horizon line and a craft marker. Enough to read direction, inertia and
 * settling; not artwork, and never allocating per-marker objects.
 */
function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  move: MovementState,
  cam: CameraState,
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#05070a";
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const focal = h * 0.9;

  // Horizon / directional reference, offset by the camera's aim.
  const aimDx = (cam.target.x - cam.position.x) * 0.6;
  const aimDy = (cam.target.y - cam.position.y) * 0.6;
  ctx.strokeStyle = "rgba(120,180,200,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, cy - aimDy);
  ctx.lineTo(w, cy - aimDy);
  ctx.stroke();

  // Depth markers, wrapped so the lattice is effectively endless.
  ctx.fillStyle = "rgba(150,220,235,0.8)";
  for (let i = 0; i < MARKERS.length; i++) {
    const m = MARKERS[i]!;
    let dz = m.z - cam.position.z;
    dz = ((dz % LATTICE_DEPTH) + LATTICE_DEPTH) % LATTICE_DEPTH;
    if (dz < 1 || dz > 900) continue;
    const dx = m.x - cam.position.x;
    const dy = m.y - cam.position.y;
    const s = focal / dz;
    const px = cx + dx * s - aimDx * 0.4;
    const py = cy - dy * s - aimDy * 0.4;
    if (px < -20 || px > w + 20 || py < -20 || py > h + 20) continue;
    const fade = Math.max(0, 1 - dz / 900);
    const r = Math.max(0.6, 3 * s * 6);
    ctx.globalAlpha = fade * 0.9;
    ctx.fillRect(px, py, r, r);
  }
  ctx.globalAlpha = 1;

  // Craft marker: a simple chevron banked by lateral velocity.
  const dzc = move.position.z - cam.position.z || 1;
  const sc = focal / dzc;
  const gx = cx + (move.position.x - cam.position.x) * sc - aimDx * 0.4;
  const gy = cy - (move.position.y - cam.position.y) * sc - aimDy * 0.4;
  const bank = Math.atan2(move.velocity.x, Math.max(1, move.velocity.z)) * 1.6;

  ctx.save();
  ctx.translate(gx, gy);
  ctx.rotate(bank);
  ctx.strokeStyle = "rgba(200,255,240,0.95)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-22, 12);
  ctx.lineTo(0, -14);
  ctx.lineTo(22, 12);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  // Velocity guide: lateral/vertical direction and magnitude.
  ctx.strokeStyle = "rgba(255,190,120,0.8)";
  ctx.beginPath();
  ctx.moveTo(gx, gy);
  ctx.lineTo(gx + move.velocity.x * 6, gy - move.velocity.y * 6);
  ctx.stroke();
}
