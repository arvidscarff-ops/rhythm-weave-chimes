import { useEffect, useRef } from "react";
import {
  createAtmosphereRenderer,
  type AtmosphereRenderer,
} from "@/lib/graphics/atmosphereRenderer";
import { resolveGraphicsLabBudget, type GraphicsLabBackend } from "@/lib/graphics/graphicsLab";
import type { MovementState } from "@/lib/movement/movementModel";

export type FirstCrossingAtmosphereFrame = Readonly<{
  activeJourneySeconds: number;
  movement: MovementState;
}>;

export function FirstCrossingAtmosphere({
  backend,
  readFrame,
  onBackendUnavailable,
}: {
  backend: GraphicsLabBackend;
  readFrame(): FirstCrossingAtmosphereFrame;
  onBackendUnavailable?(backend: GraphicsLabBackend, error: unknown): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: AtmosphereRenderer;
    try {
      renderer = createAtmosphereRenderer(backend, canvas);
    } catch (error) {
      console.warn("[first-crossing] provisional atmosphere unavailable", error);
      onBackendUnavailable?.(backend, error);
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animationFrame = 0;
    const render = () => {
      const frame = readFrameRef.current();
      const rect = canvas.getBoundingClientRect();
      const reducedMotion = motionQuery.matches;
      const budget = resolveGraphicsLabBudget({
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        quality: "auto",
        reducedMotion,
      });
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.floor(rect.width * dpr * budget.renderScale));
      const height = Math.max(1, Math.floor(rect.height * dpr * budget.renderScale));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      renderer.render({
        width,
        height,
        visualSeconds: reducedMotion ? 0 : frame.activeJourneySeconds,
        reducedMotion,
        cloudLayers: budget.cloudLayers,
        particleCount: budget.particleCount,
      });

      const lateral = Math.max(-18, Math.min(18, frame.movement.position.x * -0.018));
      const vertical = Math.max(-12, Math.min(12, frame.movement.position.y * 0.018));
      canvas.style.transform = reducedMotion
        ? "scale(1.025)"
        : `translate3d(${lateral}px, ${vertical}px, 0) scale(1.04)`;
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
    };
  }, [backend, onBackendUnavailable]);

  return (
    <canvas
      ref={canvasRef}
      data-first-crossing-environment={backend}
      aria-label="Provisional extreme-altitude exterior atmosphere"
      className="absolute inset-0 h-full w-full transition-transform duration-700 motion-reduce:transition-none"
    />
  );
}
