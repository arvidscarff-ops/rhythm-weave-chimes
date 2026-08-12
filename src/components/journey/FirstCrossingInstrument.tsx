import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { engineClock } from "@/lib/engine/clock";
import {
  createProductionAudioGraph,
  type ProductionAudioGraph,
} from "@/lib/engine/productionAudioGraph";
import { engineScheduler } from "@/lib/engine/scheduler";
import { publishScheduledVisual } from "@/lib/engine/triggerBus";
import type { SceneGlobals } from "@/lib/engine/sceneTypes";
import type { ResolvedFirstCrossingBinding } from "@/lib/journey/firstCrossingBinding";
import {
  createCompositionRevisionSession,
  reconstructProductionInput,
  type CompositionRevisionSession,
  type ProductionTimelineEvent,
} from "@/lib/rhythm/productionRhythmBridge";
import { transportSecondsToNumber } from "@/lib/rhythm/liveTimelineAdapter";
import { phaseAlignRingsScene, type PhaseAlignRingsState } from "@/lib/scenes/phaseAlignRings";
import { BUILTIN_RUNTIME_PACKS, type RuntimePack } from "@/lib/sound/runtimePacks";

export type FirstCrossingInstrumentHandle = Readonly<{
  startAtPhaseZero(): Promise<void>;
  isReady(): boolean;
}>;

const HUES = [195, 210, 225, 245, 275, 310, 340, 25, 60, 105, 145, 175];

function FirstCrossingInstrumentInner(
  { binding }: { binding: ResolvedFirstCrossingBinding },
  forwardedRef: Ref<FirstCrossingInstrumentHandle>,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<ProductionAudioGraph | null>(null);
  const sessionRef = useRef<CompositionRevisionSession | null>(null);
  const projectionStateRef = useRef<PhaseAlignRingsState | null>(null);
  const recentEventsRef = useRef(new Map<string, number>());
  const readyRef = useRef(false);

  const composition = binding.compositionSnapshot;
  const authored = binding.authored.composition;
  const pack = BUILTIN_RUNTIME_PACKS.find(
    (candidate) => candidate.kind === "builtin" && candidate.id === binding.sound.pack.id,
  );
  if (!pack)
    throw new Error(`First Crossing production pack ${binding.sound.pack.id} is unavailable.`);

  const globalsFor = useCallback(
    (
      event?: ProductionTimelineEvent,
      graph: ProductionAudioGraph | null = audioRef.current,
    ): SceneGlobals => {
      const canvas = canvasRef.current;
      const occurrence = event
        ? transportSecondsToNumber(event.compositionTransportOccurrence)
        : Math.max(0, engineClock.t());
      return {
        W: canvas?.clientWidth ?? 0,
        H: canvas?.clientHeight ?? 0,
        bpm: 90,
        speed: 1,
        density: authored.density,
        pitchSemis: 0,
        audioNow: graph?.ctx.currentTime ?? 0,
        globalTime: occurrence,
        baseLaps: composition.baseLaps,
        macroCycleSeconds: transportSecondsToNumber(composition.macroCycleDuration),
        noteCount: composition.voices.length,
      };
    },
    [authored.density, composition],
  );

  const bindScheduler = useCallback(
    (graph: ProductionAudioGraph) => {
      const session = sessionRef.current;
      if (!session) throw new Error("First Crossing musical session is not initialized.");
      engineScheduler.setActive({
        session: () => {
          const current = sessionRef.current;
          if (!current) throw new Error("First Crossing scheduler lost its composition session.");
          return current;
        },
        setSession: (next) => {
          sessionRef.current = next;
        },
        project: (event) => {
          if (!phaseAlignRingsScene.projectAuthoritativeEvent) {
            throw new Error("Phase-Align Rings has no authoritative event projection.");
          }
          const globals = globalsFor(event, graph);
          const state =
            projectionStateRef.current ??
            (projectionStateRef.current = phaseAlignRingsScene.init(globals));
          return phaseAlignRingsScene.projectAuthoritativeEvent(
            state,
            event,
            transportSecondsToNumber(event.compositionTransportOccurrence),
            globals,
          );
        },
        audioCtx: graph.ctx,
        audioDest: graph.preFx,
        pack: () => pack as RuntimePack,
        visualSink: ({ id, presentation }) => {
          recentEventsRef.current.set(id, engineClock.t());
          publishScheduledVisual(presentation);
        },
      });
      engineScheduler.resync(session.activeFrom);
    },
    [globalsFor, pack],
  );

  useImperativeHandle(
    forwardedRef,
    () => ({
      async startAtPhaseZero() {
        const graph =
          audioRef.current ??
          (audioRef.current = createProductionAudioGraph({
            mainVolume: 0.52,
            filterCutoffHz: 2_400,
            delaySeconds: 0.55,
            reverbMix: 0.45,
          }));
        engineClock.attachAudio(graph.ctx);
        if (graph.ctx.state === "suspended") await graph.ctx.resume();
        engineClock.pause();
        engineClock.setSpeed(1);
        engineClock.resetPhaseZero();
        sessionRef.current = createCompositionRevisionSession(composition, 0);
        projectionStateRef.current = null;
        recentEventsRef.current.clear();
        bindScheduler(graph);
        readyRef.current = true;
        engineClock.resume();
      },
      isReady: () => readyRef.current,
    }),
    [bindScheduler, composition],
  );

  useEffect(() => {
    engineScheduler.start();
    let animationFrame = 0;
    const draw = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      const session = sessionRef.current;
      if (!canvas || !context || !session) {
        animationFrame = requestAnimationFrame(draw);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.clearRect(0, 0, rect.width, rect.height);

      const localSeconds = Math.max(
        0,
        engineClock.t() - transportSecondsToNumber(session.activeFrom),
      );
      const input = reconstructProductionInput(session.active, localSeconds);
      drawAuthoritativeRings(
        context,
        rect.width,
        rect.height,
        input.snapshot,
        recentEventsRef.current,
        engineClock.t(),
      );
      animationFrame = requestAnimationFrame(draw);
    };
    animationFrame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animationFrame);
      engineScheduler.setActive(null);
      engineScheduler.stop();
      engineClock.pause();
      readyRef.current = false;
      const graph = audioRef.current;
      audioRef.current = null;
      if (graph && graph.ctx.state !== "closed") void graph.ctx.close();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      data-first-crossing-trigger={binding.triggerEnginePresentation.id}
      data-composition={`${composition.id}@${composition.revision}`}
      data-pack={binding.sound.pack.id}
      data-scale={binding.sound.scale.id}
      aria-label="Provisional Phase-Align Rings authoritative Trigger Engine presentation"
      className="h-full w-full"
    />
  );
}

function drawAuthoritativeRings(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  snapshot: ReturnType<typeof reconstructProductionInput>["snapshot"],
  recentEvents: Map<string, number>,
  now: number,
): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const maxRadius = Math.min(width, height) * 0.43;
  const ringStep = maxRadius / Math.max(1, snapshot.voices.length);
  context.save();
  context.globalCompositeOperation = "screen";
  context.lineCap = "round";

  snapshot.voices.forEach((voice, index) => {
    const radius = ringStep * (index + 1);
    const hue = HUES[index % HUES.length];
    const angle = -Math.PI / 2 + voice.phase.normalizedForRendering * Math.PI * 2;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const voicePrefix = `:${encodeURIComponent(voice.id)}:`;
    let flash = 0;
    for (const [eventId, occurredAt] of recentEvents) {
      const age = now - occurredAt;
      if (age > 0.65) recentEvents.delete(eventId);
      else if (eventId.includes(voicePrefix)) flash = Math.max(flash, 1 - age / 0.65);
    }

    context.strokeStyle = `hsla(${hue}, 72%, 82%, ${0.12 + flash * 0.2})`;
    context.lineWidth = 0.7 + flash * 1.2;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();

    const glow = context.createRadialGradient(x, y, 0, x, y, 16 + flash * 18);
    glow.addColorStop(0, `hsla(${hue}, 82%, 92%, ${0.78 + flash * 0.18})`);
    glow.addColorStop(1, `hsla(${hue}, 80%, 55%, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(x, y, 16 + flash * 18, 0, Math.PI * 2);
    context.fill();
  });

  context.strokeStyle = snapshot.isPhaseZero
    ? "rgba(226, 253, 255, 0.78)"
    : "rgba(220, 248, 250, 0.18)";
  context.lineWidth = snapshot.isPhaseZero ? 1.8 : 0.7;
  context.beginPath();
  context.moveTo(centerX, centerY - maxRadius - 8);
  context.lineTo(centerX, centerY);
  context.stroke();
  context.restore();
}

export const FirstCrossingInstrument = forwardRef(FirstCrossingInstrumentInner);
