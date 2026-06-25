import { useEffect, useRef } from "react";

/**
 * Slow concentric dot-ring "halo" behind the scene.
 * Inspired by interwovenRingPulses + spiralRadiatingPulse from the
 * Circle Animations reference, but tuned to be *barely there* — max alpha
 * ~0.12 so it never competes with notes or trigger blooms.
 *
 * Breathing tempo is locked to the project BPM: one full pulse cycle per bar
 * (4 beats), so the ambient layer feels musical, not decorative.
 */

type Props = {
  bpm: number;
  playing: boolean;
};

const RINGS = [
  { rFactor: 0.18, count: 6,  rot:  0.012, phase: 0.0,  amp: 0.6 },
  { rFactor: 0.26, count: 12, rot: -0.009, phase: 0.6,  amp: 0.7 },
  { rFactor: 0.34, count: 18, rot:  0.007, phase: 1.2,  amp: 0.8 },
  { rFactor: 0.42, count: 24, rot: -0.005, phase: 1.8,  amp: 0.9 },
  { rFactor: 0.50, count: 30, rot:  0.004, phase: 2.4,  amp: 1.0 },
  { rFactor: 0.58, count: 36, rot: -0.003, phase: 3.0,  amp: 1.0 },
];

export function DotAtmosphere({ bpm, playing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bpmRef = useRef(bpm);
  const playRef = useRef(playing);
  bpmRef.current = bpm;
  playRef.current = playing;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastT = 0;
    let time = 0; // seconds, gated by playing
    let driftT = 0; // seconds, always advancing for the gentle rotation

    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const parent = canvas.parentElement;
      const w = parent?.clientWidth ?? window.innerWidth;
      const h = parent?.clientHeight ?? window.innerHeight;
      canvas.width = Math.max(2, Math.floor(w * dpr));
      canvas.height = Math.max(2, Math.floor(h * dpr));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const tick = (now: number) => {
      if (!lastT) lastT = now;
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      driftT += dt;
      if (playRef.current) time += dt;

      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const cx = W / 2;
      const cy = H / 2;
      const unit = Math.min(W, H);

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";

      // One breath per bar (4 beats at current BPM)
      const barSec = (60 / Math.max(20, bpmRef.current)) * 4;
      const breath = 0.5 + 0.5 * Math.sin((time / barSec) * Math.PI * 2);

      for (let ri = 0; ri < RINGS.length; ri++) {
        const ring = RINGS[ri];
        const radius = ring.rFactor * unit * 0.5;
        if (radius < 4) continue;

        const rotation = driftT * ring.rot + ring.phase;
        // local breath, slightly offset per ring → interwoven feel
        const localPulse =
          0.5 + 0.5 * Math.sin((time / barSec) * Math.PI * 2 + ring.phase * 0.7);
        const alphaBase = 0.04 + breath * 0.05 + localPulse * 0.03; // ≤ ~0.12
        const size = 1.1 + localPulse * 0.6;

        for (let i = 0; i < ring.count; i++) {
          const a = (i / ring.count) * Math.PI * 2 + rotation;
          // tiny radial wobble so the ring "breathes" outward
          const wobble = Math.sin(driftT * 0.6 + i * 0.4 + ri) * 0.6;
          const x = cx + Math.cos(a) * (radius + wobble);
          const y = cy + Math.sin(a) * (radius + wobble);
          // per-dot shimmer keeps it from looking like a static grid
          const shimmer =
            0.6 + 0.4 * Math.sin(driftT * 1.1 + i * 0.5 + ri * 0.9);
          const alpha = Math.min(0.13, alphaBase * shimmer);
          ctx.fillStyle = `rgba(225,240,245,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0, mixBlendMode: "screen" }}
      aria-hidden
    />
  );
}