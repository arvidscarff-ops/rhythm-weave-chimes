import { Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  pendulumDistanceAtPhase,
  pendulumMacroSeconds,
  R4_PENDULUM_STRANDS,
  R4_PENDULUM_TARGET_DISTANCE,
} from "@/lib/rhythm/pendulumFamily";
import {
  ticksToSeconds,
  type ReferenceRhythmEvent,
  type ReferenceRhythmSnapshot,
} from "@/lib/rhythm/referenceAuthority";
import { type ReferenceRuntimeDiagnostics } from "@/lib/rhythm/referenceRuntime";
import { r4PendulumRuntime } from "@/lib/rhythm/pendulumRuntime";

type PendulumReadout = {
  snapshot: ReferenceRhythmSnapshot;
  diagnostics: ReferenceRuntimeDiagnostics;
  lastEvent: ReferenceRhythmEvent | null;
};

const EVENT_VISUAL_SECONDS = 1.35;

export function R4PendulumPrototype() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [playing, setPlaying] = useState(() => r4PendulumRuntime.transport.isPlaying());
  const [readout, setReadout] = useState<PendulumReadout>(() => ({
    snapshot: r4PendulumRuntime.snapshot(),
    diagnostics: r4PendulumRuntime.diagnostics(),
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

      const snapshot = r4PendulumRuntime.snapshot();
      const recentEvents = r4PendulumRuntime.recentEvents();
      drawPendulumFrame(context, width, height, snapshot, recentEvents, reducedMotion.matches);

      if (frameTime - lastReadoutAt >= 100) {
        setReadout({
          snapshot,
          diagnostics: r4PendulumRuntime.diagnostics(),
          lastEvent: recentEvents.at(-1) ?? null,
        });
        lastReadoutAt = frameTime;
      }
      animationFrame = requestAnimationFrame(render);
    };

    animationFrame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrame);
      r4PendulumRuntime.releaseConsumer();
    };
  }, []);

  const togglePlaying = async () => {
    if (r4PendulumRuntime.transport.isPlaying()) {
      r4PendulumRuntime.pause();
      setPlaying(false);
      return;
    }
    await r4PendulumRuntime.play();
    setPlaying(true);
  };

  const resetPhaseZero = () => {
    r4PendulumRuntime.resetPhaseZero();
    setReadout({
      snapshot: r4PendulumRuntime.snapshot(),
      diagnostics: r4PendulumRuntime.diagnostics(),
      lastEvent: null,
    });
  };

  const { snapshot, diagnostics, lastEvent } = readout;

  return (
    <main className="relative h-[100svh] min-h-[36rem] overflow-hidden bg-[#061116] text-white">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-label="Nine Pendulum Fan voices derived from one authoritative musical position"
      />

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(1,8,11,0.22),transparent_28%,transparent_62%,rgba(1,7,10,0.78))]"
      />

      <header className="absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-4 px-4 py-4 sm:px-7 sm:py-6">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-white/40">
            Reset R4.1 · initial engine family
          </p>
          <h1 className="mt-1 text-lg font-medium tracking-[0.18em] sm:text-xl">
            Harmonic Pendulum
          </h1>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-white/45">
            Preserved fan geometry, now driven by one exact event authority. Contact represents the
            note—it never causes it.
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
        aria-label="Pendulum transport and diagnostics"
        className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5"
      >
        <div className="mx-auto max-w-6xl border border-white/15 bg-[oklch(0.145_0.018_220/0.94)] shadow-[0_24px_70px_rgba(0,0,0,0.42)] backdrop-blur-md">
          <div className="grid sm:grid-cols-[auto_1fr_auto]">
            <button
              type="button"
              onClick={togglePlaying}
              aria-label={playing ? "Pause Pendulum transport" : "Play Pendulum transport"}
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
              <Metric label="Closure" value={`${pendulumMacroSeconds().toFixed(4)}s`} />
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
          Provisional fixture · remount preserves canonical position · hidden-tab product policy
          remains unresolved
        </p>
      </section>

      <p className="sr-only" aria-live="polite">
        Pendulum transport is {playing ? "playing" : "paused"}. Macro phase{" "}
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

function drawPendulumFrame(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: ReferenceRhythmSnapshot,
  events: ReferenceRhythmEvent[],
  reducedMotion: boolean,
) {
  const background = context.createRadialGradient(
    width * 0.5,
    height * 0.28,
    0,
    width * 0.5,
    height * 0.42,
    Math.max(width, height) * 0.78,
  );
  background.addColorStop(0, "#16434a");
  background.addColorStop(0.4, "#0b2830");
  background.addColorStop(1, "#051116");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const anchorX = width * 0.5;
  const anchorY = Math.max(120, height * 0.15);
  const stringLength = Math.max(190, Math.min(height * 0.61, width * 0.58, 520));
  const recentByVoice = new Map<string, ReferenceRhythmEvent>();
  const voiceById = new Map(snapshot.voices.map((voice) => [voice.id, voice]));
  for (const event of events) recentByVoice.set(event.voiceId, event);

  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  for (const strand of R4_PENDULUM_STRANDS) {
    const voice = voiceById.get(strand.voiceId);
    if (!voice) continue;

    const hue = voice.hue;
    const tipX = anchorX + Math.sin(strand.angle) * stringLength;
    const tipY = anchorY + Math.cos(strand.angle) * stringLength;
    const targetX = anchorX + Math.sin(strand.angle) * stringLength * R4_PENDULUM_TARGET_DISTANCE;
    const targetY = anchorY + Math.cos(strand.angle) * stringLength * R4_PENDULUM_TARGET_DISTANCE;

    const event = recentByVoice.get(voice.id);
    const eventAge = event
      ? Math.max(0, ticksToSeconds(snapshot.positionTick - event.tick))
      : EVENT_VISUAL_SECONDS;
    const eventEnergy = Math.max(0, 1 - eventAge / EVENT_VISUAL_SECONDS);

    context.strokeStyle = `oklch(0.78 0.08 ${hue} / ${0.2 + strand.order * 0.009})`;
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(anchorX, anchorY);
    context.lineTo(tipX, tipY);
    context.stroke();

    context.strokeStyle = `oklch(0.88 0.12 ${hue} / ${0.2 + eventEnergy * 0.68})`;
    context.lineWidth = 1 + eventEnergy * 1.8;
    context.beginPath();
    context.arc(targetX, targetY, 6 + eventEnergy * 5, 0, Math.PI * 2);
    context.stroke();

    const targetGlow = context.createRadialGradient(
      targetX,
      targetY,
      0,
      targetX,
      targetY,
      35 + eventEnergy * 15,
    );
    targetGlow.addColorStop(0, `oklch(0.94 0.13 ${hue} / ${0.08 + eventEnergy * 0.68})`);
    targetGlow.addColorStop(1, `oklch(0.68 0.12 ${hue} / 0)`);
    context.fillStyle = targetGlow;
    context.beginPath();
    context.arc(targetX, targetY, 35 + eventEnergy * 15, 0, Math.PI * 2);
    context.fill();

    const distance = reducedMotion
      ? 0.59 + voice.phase * 0.13
      : pendulumDistanceAtPhase(voice.phase);
    const nodeX = anchorX + Math.sin(strand.angle) * stringLength * distance;
    const nodeY = anchorY + Math.cos(strand.angle) * stringLength * distance;
    const nodeRadius = reducedMotion ? 12 : 17 + eventEnergy * 9;
    const nodeGlow = context.createRadialGradient(nodeX, nodeY, 0, nodeX, nodeY, nodeRadius);
    nodeGlow.addColorStop(0, `oklch(0.97 0.11 ${hue} / 0.94)`);
    nodeGlow.addColorStop(0.2, `oklch(0.86 0.16 ${hue} / 0.76)`);
    nodeGlow.addColorStop(1, `oklch(0.66 0.14 ${hue} / 0)`);
    context.fillStyle = nodeGlow;
    context.beginPath();
    context.arc(nodeX, nodeY, nodeRadius, 0, Math.PI * 2);
    context.fill();
  }

  const phaseZeroEnergy = Math.max(
    0,
    ...events
      .filter((event) => event.isPhaseZero)
      .map((event) => {
        const age = ticksToSeconds(snapshot.positionTick - event.tick);
        return Math.max(0, 1 - age / 1.6);
      }),
  );
  const anchorGlow = context.createRadialGradient(
    anchorX,
    anchorY,
    0,
    anchorX,
    anchorY,
    24 + phaseZeroEnergy * 32,
  );
  anchorGlow.addColorStop(0, `rgba(226, 255, 249, ${0.72 + phaseZeroEnergy * 0.24})`);
  anchorGlow.addColorStop(1, "rgba(120, 230, 221, 0)");
  context.fillStyle = anchorGlow;
  context.beginPath();
  context.arc(anchorX, anchorY, 24 + phaseZeroEnergy * 32, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = `rgba(220, 255, 249, ${0.2 + phaseZeroEnergy * 0.58})`;
  context.lineWidth = 1 + phaseZeroEnergy * 2;
  context.beginPath();
  context.arc(anchorX, anchorY, 9 + phaseZeroEnergy * 8, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}
