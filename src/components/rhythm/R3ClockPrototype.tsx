import { Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  R3_REFERENCE_COMPOSITION,
  ticksToSeconds,
  type ReferenceRhythmEvent,
  type ReferenceRhythmSnapshot,
} from "@/lib/rhythm/referenceAuthority";
import {
  r3ReferenceRuntime,
  type ReferenceRuntimeDiagnostics,
} from "@/lib/rhythm/referenceRuntime";

type Readout = {
  snapshot: ReferenceRhythmSnapshot;
  diagnostics: ReferenceRuntimeDiagnostics;
  lastEvent: ReferenceRhythmEvent | null;
};

const EVENT_VISUAL_SECONDS = 1.35;

export function R3ClockPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => r3ReferenceRuntime.transport.isPlaying());
  const [readout, setReadout] = useState<Readout>(() => ({
    snapshot: r3ReferenceRuntime.snapshot(),
    diagnostics: r3ReferenceRuntime.diagnostics(),
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

      const snapshot = r3ReferenceRuntime.snapshot();
      const recentEvents = r3ReferenceRuntime.recentEvents();
      drawReferenceFrame(context, width, height, snapshot, recentEvents, reducedMotion.matches);

      if (frameTime - lastReadoutAt >= 100) {
        setReadout({
          snapshot,
          diagnostics: r3ReferenceRuntime.diagnostics(),
          lastEvent: recentEvents.at(-1) ?? null,
        });
        lastReadoutAt = frameTime;
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      r3ReferenceRuntime.releaseConsumer();
    };
  }, []);

  const togglePlaying = async () => {
    if (r3ReferenceRuntime.transport.isPlaying()) {
      r3ReferenceRuntime.pause();
      setPlaying(false);
      return;
    }
    await r3ReferenceRuntime.play();
    setPlaying(true);
  };

  const resetPhaseZero = () => {
    r3ReferenceRuntime.resetPhaseZero();
    setReadout({
      snapshot: r3ReferenceRuntime.snapshot(),
      diagnostics: r3ReferenceRuntime.diagnostics(),
      lastEvent: null,
    });
  };

  const { snapshot, diagnostics, lastEvent } = readout;

  return (
    <main className="relative h-[100svh] min-h-[34rem] overflow-hidden bg-[#071217] text-white">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Three reference voices derived from one authoritative musical position"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,10,13,0.2),transparent_28%,transparent_62%,rgba(2,8,11,0.68))]"
      />

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-4 py-4 sm:px-7 sm:py-6">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
            Reset R3 · reference event path
          </p>
          <h1 className="mt-1 text-lg font-medium tracking-[0.2em] sm:text-xl">
            One clock. One event identity.
          </h1>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-white/45">
            Provisional engineering proof—not the selected production engine family.
          </p>
        </div>
        <Link
          to="/"
          search={{ shell: "reset" }}
          className="rounded-sm border border-white/15 bg-black/20 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-white/60 transition-colors motion-reduce:transition-none hover:border-white/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          Instrument
        </Link>
      </header>

      <section
        aria-label="Reference transport and diagnostics"
        className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="mx-auto max-w-5xl border border-white/15 bg-[oklch(0.145_0.018_220/0.94)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="grid sm:grid-cols-[auto_1fr_auto]">
            <button
              type="button"
              onClick={togglePlaying}
              aria-label={playing ? "Pause reference transport" : "Play reference transport"}
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
              <Metric label="Macro cycle" value={snapshot.macroCycleIndex.toString()} />
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

          <div className="grid gap-2 border-t border-white/10 px-4 py-2.5 font-mono text-[8px] uppercase tracking-[0.16em] text-white/35 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:px-5">
            <span className="truncate text-white/55">
              {lastEvent ? `Shared event · ${lastEvent.id}` : "Waiting for the first shared event"}
            </span>
            <span>Duplicates · {diagnostics.duplicateEventCount}</span>
            <span>Late windows · {diagnostics.lateWindowCount}</span>
          </div>
        </div>

        <p className="mx-auto mt-2 max-w-5xl font-mono text-[8px] uppercase tracking-[0.15em] text-white/25">
          Hidden-tab policy remains unresolved · render frames never generate notes
        </p>
      </section>

      <p className="sr-only" aria-live="polite">
        Reference transport is {playing ? "playing" : "paused"}. Macro phase{" "}
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

function drawReferenceFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: ReferenceRhythmSnapshot,
  events: ReferenceRhythmEvent[],
  reducedMotion: boolean,
) {
  const gradient = context.createRadialGradient(
    width * 0.5,
    height * 0.43,
    0,
    width * 0.5,
    height * 0.43,
    Math.max(width, height) * 0.68,
  );
  gradient.addColorStop(0, "#173b43");
  gradient.addColorStop(0.45, "#0c252d");
  gradient.addColorStop(1, "#061116");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  const centerX = width * 0.5;
  const centerY = Math.max(190, Math.min(height * 0.44, height - 250));
  const maximumRadius = Math.max(60, Math.min(width * 0.25, height * 0.27, 205));
  const radii = [maximumRadius * 0.54, maximumRadius * 0.77, maximumRadius];
  const recentByVoice = new Map<string, ReferenceRhythmEvent>();
  for (const event of events) recentByVoice.set(event.voiceId, event);

  context.save();
  context.lineCap = "round";
  snapshot.voices.forEach((voice, index) => {
    const radius = radii[index];
    const hue = voice.hue;
    context.strokeStyle = `oklch(0.78 0.08 ${hue} / 0.24)`;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();

    const event = recentByVoice.get(voice.id);
    const eventAge = event
      ? Math.max(0, ticksToSeconds(snapshot.positionTick - event.tick))
      : EVENT_VISUAL_SECONDS;
    const eventEnergy = Math.max(0, 1 - eventAge / EVENT_VISUAL_SECONDS);
    const gateX = centerX;
    const gateY = centerY - radius;
    const gateGlow = context.createRadialGradient(gateX, gateY, 0, gateX, gateY, 32);
    gateGlow.addColorStop(0, `oklch(0.92 0.14 ${hue} / ${0.2 + eventEnergy * 0.62})`);
    gateGlow.addColorStop(1, `oklch(0.72 0.12 ${hue} / 0)`);
    context.fillStyle = gateGlow;
    context.beginPath();
    context.arc(gateX, gateY, 32, 0, Math.PI * 2);
    context.fill();

    if (reducedMotion) {
      context.strokeStyle = `oklch(0.9 0.12 ${hue} / 0.72)`;
      context.lineWidth = 2.5;
      context.beginPath();
      context.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + voice.phase * Math.PI * 2);
      context.stroke();
      return;
    }

    const angle = -Math.PI / 2 + voice.phase * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const particleGlow = context.createRadialGradient(x, y, 0, x, y, 18 + eventEnergy * 9);
    particleGlow.addColorStop(0, `oklch(0.96 0.14 ${hue} / 0.96)`);
    particleGlow.addColorStop(1, `oklch(0.72 0.16 ${hue} / 0)`);
    context.fillStyle = particleGlow;
    context.beginPath();
    context.arc(x, y, 18 + eventEnergy * 9, 0, Math.PI * 2);
    context.fill();
  });

  const phaseZeroEnergy = Math.max(
    0,
    ...events
      .filter((event) => event.isPhaseZero)
      .map((event) => {
        const age = ticksToSeconds(snapshot.positionTick - event.tick);
        return Math.max(0, 1 - age / 1.2);
      }),
  );
  context.strokeStyle = `rgba(220, 250, 247, ${0.1 + phaseZeroEnergy * 0.55})`;
  context.lineWidth = 1 + phaseZeroEnergy * 2;
  context.beginPath();
  context.arc(centerX, centerY, 18 + phaseZeroEnergy * 14, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
