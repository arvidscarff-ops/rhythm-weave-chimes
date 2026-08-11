import { Activity, Layers3, Wind } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PerfProbeMount } from "@/components/dev/PerfProbeMount";
import {
  createAtmosphereRenderer,
  type AtmosphereRenderer,
} from "@/lib/graphics/atmosphereRenderer";
import {
  advanceDecorativeVisualTime,
  resolveGraphicsLabBudget,
  type GraphicsLabBackend,
  type GraphicsLabQuality,
} from "@/lib/graphics/graphicsLab";

type MotionSetting = "system" | "standard" | "reduced";

/**
 * Reset R7 comparative evidence only. This surface owns decorative visual time,
 * but imports no transport, rhythm, audio, crossing, or gameplay authority.
 */
export function R7GraphicsLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const systemReducedMotion = useSystemReducedMotion();
  const [backend, setBackend] = useState<GraphicsLabBackend>("canvas-2d");
  const [quality, setQuality] = useState<GraphicsLabQuality>("auto");
  const [motionSetting, setMotionSetting] = useState<MotionSetting>("system");
  const [rendererError, setRendererError] = useState<string | null>(null);

  const reducedMotion =
    motionSetting === "reduced" || (motionSetting === "system" && systemReducedMotion);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: AtmosphereRenderer;
    try {
      renderer = createAtmosphereRenderer(backend, canvas);
      setRendererError(null);
    } catch (error) {
      setRendererError(error instanceof Error ? error.message : "Renderer initialization failed.");
      return;
    }

    let animationFrame = 0;
    let lastFrameAt = performance.now();
    let visualSeconds = 0;

    const render = (frameTime: number) => {
      const rect = canvas.getBoundingClientRect();
      const budget = resolveGraphicsLabBudget({
        width: rect.width,
        height: rect.height,
        devicePixelRatio: window.devicePixelRatio || 1,
        quality,
        reducedMotion,
      });
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const pixelWidth = Math.max(1, Math.floor(rect.width * dpr * budget.renderScale));
      const pixelHeight = Math.max(1, Math.floor(rect.height * dpr * budget.renderScale));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }

      visualSeconds = advanceDecorativeVisualTime(
        visualSeconds,
        frameTime - lastFrameAt,
        reducedMotion,
      );
      lastFrameAt = frameTime;
      renderer.render({
        width: pixelWidth,
        height: pixelHeight,
        visualSeconds,
        reducedMotion,
        cloudLayers: budget.cloudLayers,
        particleCount: budget.particleCount,
      });
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      renderer.dispose();
    };
  }, [backend, quality, reducedMotion]);

  const modeLabel = backend === "canvas-2d" ? "Layered Canvas 2D" : "Procedural WebGL2";
  const motionLabel = reducedMotion ? "Reduced / frozen" : "Slow monumental drift";

  return (
    <main className="relative h-[100svh] min-h-[42rem] overflow-hidden bg-[#07161a] text-[#e8f7f4]">
      <canvas
        key={backend}
        ref={canvasRef}
        data-renderer={backend}
        data-reduced-motion={reducedMotion ? "true" : "false"}
        aria-label={`${modeLabel} exterior high-altitude atmosphere experiment`}
        className="absolute inset-0 h-full w-full"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,16,19,0.08),transparent_45%,rgba(3,11,14,0.36)_78%,rgba(2,8,10,0.82))]"
      />

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-7 sm:pt-6">
        <div className="max-w-[13rem] sm:max-w-xl">
          <p className="font-mono text-[8px] uppercase tracking-[0.32em] text-white/48">
            Reset R7 · comparative graphics laboratory
          </p>
          <h1 className="mt-1 text-lg font-medium tracking-[0.16em] sm:text-xl">
            Exterior Atmosphere Study
          </h1>
          <p className="mt-2 hidden max-w-lg text-xs leading-relaxed text-white/52 sm:block">
            Open upper atmosphere, stable distant horizon, and cloud geography below. No renderer,
            craft silhouette, or production environment has been selected.
          </p>
        </div>
        <a
          href="/"
          className="hidden shrink-0 border border-white/18 bg-[#071114]/65 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.18em] text-white/68 backdrop-blur-md transition-colors motion-reduce:transition-none hover:border-white/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:block"
        >
          Exit lab
        </a>
      </header>

      <section
        aria-label="Graphics laboratory controls"
        className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="mx-auto max-w-6xl border border-white/15 bg-[#071519]/90 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="grid lg:grid-cols-[1.7fr_0.8fr]">
            <div className="grid gap-px bg-white/10 sm:grid-cols-3">
              <ControlGroup label="Renderer">
                <SegmentButton
                  active={backend === "canvas-2d"}
                  onClick={() => setBackend("canvas-2d")}
                >
                  Canvas 2D
                </SegmentButton>
                <SegmentButton active={backend === "webgl-2"} onClick={() => setBackend("webgl-2")}>
                  WebGL2
                </SegmentButton>
              </ControlGroup>

              <ControlGroup label="Fidelity">
                {(["auto", "balanced", "reduced"] as const).map((value) => (
                  <SegmentButton
                    key={value}
                    active={quality === value}
                    onClick={() => setQuality(value)}
                  >
                    {value}
                  </SegmentButton>
                ))}
              </ControlGroup>

              <ControlGroup label="Motion">
                {(["system", "standard", "reduced"] as const).map((value) => (
                  <SegmentButton
                    key={value}
                    active={motionSetting === value}
                    onClick={() => setMotionSetting(value)}
                  >
                    {value}
                  </SegmentButton>
                ))}
              </ControlGroup>
            </div>

            <div className="grid grid-cols-2 divide-x divide-white/10 border-t border-white/10 lg:border-l lg:border-t-0">
              <Status icon={Layers3} label="Mode" value={modeLabel} />
              <Status icon={Wind} label="Motion" value={motionLabel} />
            </div>
          </div>

          <div className="grid gap-2 border-t border-white/10 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.15em] text-white/38 sm:grid-cols-[1fr_auto] sm:px-5">
            <span className={rendererError ? "text-amber-200/85" : "text-white/54"}>
              {rendererError ??
                "Decorative renderer only · no audio, note, rhythm, or route authority"}
            </span>
            <a
              className="text-white/55 underline underline-offset-4 hover:text-white"
              href="/dev/performance"
            >
              SYS-005 results
            </a>
          </div>
        </div>
        <p className="mx-auto mt-2 max-w-6xl font-mono text-[8px] uppercase tracking-[0.15em] text-white/30">
          Add <code>?perf=1</code> to measure this surface with SYS-005 · no final renderer selected
        </p>
      </section>

      <p className="sr-only" aria-live="polite">
        Graphics laboratory renderer is {modeLabel}. Motion is {motionLabel}.
        {rendererError ? ` Renderer error: ${rendererError}` : ""}
      </p>
      <PerfProbeMount />
    </main>
  );
}

function useSystemReducedMotion(): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMatches(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return matches;
}

function ControlGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 bg-[#071519] px-3 py-3">
      <legend className="sr-only">{label}</legend>
      <span className="mb-2 block font-mono text-[8px] uppercase tracking-[0.22em] text-white/36">
        {label}
      </span>
      <div className="flex min-w-0 gap-1">{children}</div>
    </fieldset>
  );
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-0 flex-1 border px-2 py-2 font-mono text-[8px] uppercase tracking-[0.1em] transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
        active
          ? "border-[#bce9e2]/38 bg-[#bce9e2]/12 text-[#e8fffb]"
          : "border-white/10 bg-white/[0.025] text-white/44 hover:border-white/24 hover:text-white/72"
      }`}
    >
      {children}
    </button>
  );
}

function Status({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-16 min-w-0 items-center gap-2 px-3 py-2">
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0 text-[#a8d9d3]/52" />
      <span className="min-w-0">
        <span className="block font-mono text-[8px] uppercase tracking-[0.18em] text-white/32">
          {label}
        </span>
        <span className="mt-1 block truncate text-[10px] text-white/72">{value}</span>
      </span>
    </div>
  );
}
