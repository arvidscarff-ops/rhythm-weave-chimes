import { Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  ticksToSeconds,
  type ReferenceRhythmEvent,
  type ReferenceRhythmSnapshot,
} from "@/lib/rhythm/referenceAuthority";
import {
  type ReferenceRuntime,
  type ReferenceRuntimeDiagnostics,
} from "@/lib/rhythm/referenceRuntime";

export type AuthoritativeFrameRenderer = (
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: ReferenceRhythmSnapshot,
  events: ReferenceRhythmEvent[],
  reducedMotion: boolean,
) => void;

type Readout = {
  snapshot: ReferenceRhythmSnapshot;
  diagnostics: ReferenceRuntimeDiagnostics;
  lastEvent: ReferenceRhythmEvent | null;
};

type AuthoritativeEnginePrototypeProps = {
  runtime: ReferenceRuntime;
  stageLabel: string;
  title: string;
  description: string;
  canvasLabel: string;
  closureSeconds: number;
  drawFrame: AuthoritativeFrameRenderer;
  footerNote: string;
};

/**
 * Shared R4 family shell.
 *
 * Each engine supplies geometry only. Transport, playback, diagnostics,
 * lifecycle cleanup, and event identity remain identical across the family.
 */
export function AuthoritativeEnginePrototype({
  runtime,
  stageLabel,
  title,
  description,
  canvasLabel,
  closureSeconds,
  drawFrame,
  footerNote,
}: AuthoritativeEnginePrototypeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => runtime.transport.isPlaying());
  const [readout, setReadout] = useState<Readout>(() => ({
    snapshot: runtime.snapshot(),
    diagnostics: runtime.diagnostics(),
    lastEvent: null,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let animationFrame = 0;
    let lastReadoutAt = 0;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const render = (frameTime: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      const pixelWidth = Math.floor(width * dpr);
      const pixelHeight = Math.floor(height * dpr);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const snapshot = runtime.snapshot();
      const recentEvents = runtime.recentEvents();
      drawFrame(context, width, height, snapshot, recentEvents, reducedMotion.matches);

      if (frameTime - lastReadoutAt >= 100) {
        setReadout({
          snapshot,
          diagnostics: runtime.diagnostics(),
          lastEvent: recentEvents.at(-1) ?? null,
        });
        lastReadoutAt = frameTime;
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      runtime.releaseConsumer();
    };
  }, [drawFrame, runtime]);

  const togglePlaying = async () => {
    if (runtime.transport.isPlaying()) {
      runtime.pause();
      setPlaying(false);
      return;
    }
    await runtime.play();
    setPlaying(true);
  };

  const resetPhaseZero = () => {
    runtime.resetPhaseZero();
    setReadout({
      snapshot: runtime.snapshot(),
      diagnostics: runtime.diagnostics(),
      lastEvent: null,
    });
  };

  const { snapshot, diagnostics, lastEvent } = readout;

  return (
    <main className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-[#061116] text-white">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={canvasLabel} />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,11,0.22),transparent_28%,transparent_62%,rgba(1,7,10,0.78))]"
      />

      <header className="absolute inset-x-0 top-0 z-10 flex min-w-0 flex-col items-start gap-3 px-4 py-4 sm:flex-row sm:justify-between sm:gap-4 sm:px-7 sm:py-6">
        <div className="min-w-0">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
            {stageLabel}
          </p>
          <h1 className="mt-1 text-lg font-medium tracking-[0.18em] sm:text-xl">{title}</h1>
          <p className="mt-2 max-w-xl break-words text-xs leading-relaxed text-white/45">
            {description}
          </p>
        </div>
        <Link
          to="/"
          search={{ shell: "reset" }}
          className="shrink-0 rounded-sm border border-white/15 bg-black/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/60 transition-colors motion-reduce:transition-none hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Instrument
        </Link>
      </header>

      <section
        aria-label={`${title} transport and diagnostics`}
        className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="mx-auto max-w-6xl border border-white/15 bg-[oklch(0.145_0.018_220/0.94)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="grid sm:grid-cols-[auto_1fr_auto]">
            <button
              type="button"
              onClick={togglePlaying}
              aria-label={playing ? `Pause ${title} transport` : `Play ${title} transport`}
              className="flex min-h-16 items-center justify-center gap-3 border-b border-white/10 px-6 text-left transition-colors motion-reduce:transition-none hover:bg-white/[0.06] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:min-w-44 sm:border-r sm:border-b-0"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full border border-white/25 bg-white/[0.05]">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
              </span>
              <span>
                <span className="block font-mono text-[8px] uppercase tracking-[0.24em] text-white/35">
                  Authority
                </span>
                <span className="mt-0.5 block text-sm">{playing ? "Pause" : "Begin"}</span>
              </span>
            </button>

            <div className="grid grid-cols-2 divide-x divide-white/10 border-b border-white/10 sm:grid-cols-4 sm:border-b-0">
              <Metric
                label="Position"
                value={`${ticksToSeconds(snapshot.positionTick).toFixed(3)}s`}
              />
              <Metric label="Closure" value={`${closureSeconds.toFixed(4)}s`} />
              <Metric label="Macro phase" value={`${(snapshot.macroPhase * 100).toFixed(2)}%`} />
              <Metric label="Events" value={diagnostics.scheduledEventCount.toString()} />
            </div>

            <button
              type="button"
              onClick={resetPhaseZero}
              className="flex min-h-14 items-center justify-center gap-2 border-t border-white/10 px-5 font-mono text-[9px] uppercase tracking-[0.18em] text-white/55 transition-colors motion-reduce:transition-none hover:bg-white/[0.06] hover:text-white focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70 sm:min-w-36 sm:border-t-0 sm:border-l"
            >
              <RotateCcw className="h-4 w-4" />
              Phase Zero
            </button>
          </div>

          <div className="grid gap-2 border-t border-white/10 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/35 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:px-5">
            <span className="truncate text-white/55">
              {lastEvent ? `Shared event · ${lastEvent.id}` : "Waiting for the first shared event"}
            </span>
            <span>Voices · {snapshot.voices.length}</span>
            <span>Duplicates · {diagnostics.duplicateEventCount}</span>
            <span>Late windows · {diagnostics.lateWindowCount}</span>
          </div>
        </div>

        <p className="mx-auto mt-2 max-w-6xl font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">
          {footerNote}
        </p>
      </section>

      <p className="sr-only" aria-live="polite">
        {title} transport is {playing ? "playing" : "paused"}. Macro phase{" "}
        {(snapshot.macroPhase * 100).toFixed(0)} percent.
      </p>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-h-14 flex-col justify-center px-4 py-2">
      <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-white/30">{label}</span>
      <span className="mt-1 text-xs tabular-nums text-white/75">{value}</span>
    </div>
  );
}
