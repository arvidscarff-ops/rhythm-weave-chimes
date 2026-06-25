import { useEffect, useRef } from "react";
import { shockwaveBus, type Shockwave } from "@/lib/visuals/shockwaveBus";

/**
 * Expanding dot-ring shockwaves emitted on every note trigger.
 * Inspired by the pulseWaveShockwave variant in the Circle Animations reference,
 * scaled down and softened so it reads as a quiet "splash" rather than a flash.
 *
 * Lives above the scene canvas but below dock chrome; pointer-events-none.
 */

const MAX_LIVE = 12;
const LIFE_MS = 850;          // total fade life
const MAX_RADIUS_FRAC = 0.085; // of min(W,H) — small "splash", not a screen-wide wave
const RING_DOTS = 18;

export function ShockwaveLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const liveRef = useRef<Shockwave[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    const unsub = shockwaveBus.subscribe((s) => {
      const arr = liveRef.current;
      arr.push(s);
      if (arr.length > MAX_LIVE) arr.splice(0, arr.length - MAX_LIVE);
    });

    let raf = 0;
    const tick = () => {
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const unit = Math.min(W, H);
      const now = performance.now();
      ctx.clearRect(0, 0, W, H);

      const arr = liveRef.current;
      const surviving: Shockwave[] = [];
      ctx.globalCompositeOperation = "lighter";

      for (const s of arr) {
        const age = (now - s.born) / LIFE_MS;
        if (age >= 1) continue;
        surviving.push(s);

        // ease-out expansion (fast start, slow tail)
        const eased = 1 - Math.pow(1 - age, 2.2);
        const r = eased * unit * MAX_RADIUS_FRAC;
        // fade: brief peak around age 0.2 then long tail
        const peak = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 0.8;
        const alpha = Math.max(0, peak) * s.intensity * 0.55;

        if (r < 0.5 || alpha < 0.01) continue;

        const cx = s.x * W;
        const cy = s.y * H;
        const dotSize = 1.2 + (1 - age) * 1.2;

        // subtle warm/cool drift from hue hint (kept very desaturated)
        const tint = 220 + Math.round(s.hue * 25); // 220..245 blue-ish

        for (let i = 0; i < RING_DOTS; i++) {
          const ang = (i / RING_DOTS) * Math.PI * 2;
          // gentle per-dot phase wobble for organic feel
          const wob = Math.sin(age * Math.PI * 2 + i) * 0.4;
          const x = cx + Math.cos(ang) * (r + wob);
          const y = cy + Math.sin(ang) * (r + wob);
          ctx.fillStyle = `rgba(${tint},240,245,${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(x, y, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = "source-over";
      liveRef.current = surviving;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      unsub();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 2, mixBlendMode: "screen" }}
      aria-hidden
    />
  );
}