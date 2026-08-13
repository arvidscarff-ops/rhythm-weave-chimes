import { createFileRoute, Link } from "@tanstack/react-router";
import { Pause, Play, RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PerfProbeMount } from "@/components/dev/PerfProbeMount";
import {
  FirstCrossingAtmosphere,
  type FirstCrossingAtmosphereFrame,
} from "@/components/journey/FirstCrossingAtmosphere";
import {
  FirstCrossingInstrument,
  type FirstCrossingInstrumentHandle,
} from "@/components/journey/FirstCrossingInstrument";
import { PROVISIONAL_CROSSING_THRESHOLDS } from "@/lib/crossing/crossingRuntime";
import { engineClock } from "@/lib/engine/clock";
import type { GraphicsLabBackend } from "@/lib/graphics/graphicsLab";
import { coordinatorConfigFromFirstCrossingBinding } from "@/lib/journey/firstCrossingBindingCoordinator";
import { resolveProvisionalFirstCrossingBinding } from "@/lib/journey/firstCrossingBindingFixture";
import {
  createFirstCrossingCoordinator,
  type FirstCrossingCoordinator,
  type FirstCrossingCoordinatorResult,
  type FirstCrossingCoordinatorSnapshotV1,
} from "@/lib/journey/firstCrossingCoordinator";
import { coordinateFirstCrossingLifecycle } from "@/lib/journey/firstCrossingLifecycle";
import {
  createFirstCrossingRunSnapshot,
  hydrateFirstCrossingRun,
  type FirstCrossingRunSnapshotV1,
} from "@/lib/journey/firstCrossingRun";
import { installFirstCrossingVisibility } from "@/lib/journey/firstCrossingVisibility";
import {
  createKeyboardInputAdapter,
  type KeyboardInputAdapter,
} from "@/lib/movement/movementInput";
import {
  createMovementState,
  DEFAULT_MOVEMENT_PARAMS,
  stepMovement,
  type MovementInput,
  type MovementState,
} from "@/lib/movement/movementModel";
import { SAMPLE_TRANSMISSIONS } from "@/lib/transmissions/sampleTransmissions";

export const Route = createFileRoute("/dev/first-crossing")({
  ssr: false,
  component: FirstCrossingVerticalSlice,
  head: () => ({
    meta: [
      { title: "Integrated First Crossing · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "SYS-011 integrated First Crossing vertical-slice proof.",
      },
    ],
  }),
});

const BINDING = resolveProvisionalFirstCrossingBinding();
const NEUTRAL_INPUT: MovementInput = Object.freeze({ steerX: 0, steerY: 0 });
const TRANSMISSION_LABELS = new Map(
  SAMPLE_TRANSMISSIONS.map((definition) => [definition.id, definition.label]),
);

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `first-crossing-${Date.now()}`;
}

function createCoordinator(runId = newRunId()): FirstCrossingCoordinator {
  return createFirstCrossingCoordinator(
    coordinatorConfigFromFirstCrossingBinding(BINDING, runId, {
      thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
      transmissions: {
        definitionSetId: BINDING.transmissionSet?.id ?? "journey-lab-transmissions-v1",
        seed: `first-crossing:${runId}`,
        definitions: SAMPLE_TRANSMISSIONS,
        admissionChance: 1,
        minGapSeconds: 4,
      },
    }),
  );
}

type ExperienceReadout = Readonly<{
  snapshot: FirstCrossingCoordinatorSnapshotV1;
  movement: MovementState;
  input: MovementInput;
}>;

function lifecycleLabel(snapshot: FirstCrossingCoordinatorSnapshotV1): string {
  const lifecycle = snapshot.session.lifecycle;
  if (lifecycle.completed) return "ARRIVED";
  if (!lifecycle.started) return "READY";
  if (lifecycle.explicitlyPaused) return "PAUSED";
  if (lifecycle.backgroundSuspended) return "SUSPENDED";
  return snapshot.crossing.phase.replace("_", " ").toUpperCase();
}

function alignMusicalTransportToRestoredLifecycle(
  session: FirstCrossingCoordinatorSnapshotV1["session"]["lifecycle"],
): void {
  if (engineClock.isBackgroundSuspended()) engineClock.resumeFromBackground();
  if (session.backgroundSuspended) {
    engineClock.suspendForBackground();
  } else if (!session.started || session.completed || session.explicitlyPaused) {
    engineClock.pause();
  } else {
    engineClock.resume();
  }
}

function FirstCrossingVerticalSlice() {
  const [coordinator, setCoordinator] = useState(createCoordinator);
  const [readout, setReadout] = useState<ExperienceReadout>(() => ({
    snapshot: coordinator.snapshot(),
    movement: createMovementState(DEFAULT_MOVEMENT_PARAMS),
    input: NEUTRAL_INPUT,
  }));
  const [savedRun, setSavedRun] = useState<FirstCrossingRunSnapshotV1 | null>(null);
  const [restoreNote, setRestoreNote] = useState("No run snapshot captured.");
  const [diagnostics, setDiagnostics] = useState(false);
  const [backend, setBackend] = useState<GraphicsLabBackend>("canvas-2d");
  const [rendererNotice, setRendererNotice] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const instrumentRef = useRef<FirstCrossingInstrumentHandle>(null);
  const keyboardRef = useRef<KeyboardInputAdapter | null>(null);
  const movementRef = useRef(createMovementState(DEFAULT_MOVEMENT_PARAMS));
  const readoutRef = useRef(readout);
  readoutRef.current = readout;

  const lifecycle = useMemo(
    () => coordinateFirstCrossingLifecycle(coordinator, engineClock),
    [coordinator],
  );

  const accept = useCallback(
    (result: FirstCrossingCoordinatorResult, input: MovementInput): void => {
      movementRef.current = stepMovement(
        movementRef.current,
        input,
        result.movementDeltaSeconds,
        DEFAULT_MOVEMENT_PARAMS,
      );
      readoutRef.current = {
        snapshot: result.snapshot,
        movement: movementRef.current,
        input,
      };
    },
    [],
  );

  const publishReadout = useCallback(() => {
    setReadout({ ...readoutRef.current });
  }, []);

  const selectBackend = useCallback((nextBackend: GraphicsLabBackend) => {
    setRendererNotice(null);
    setBackend(nextBackend);
  }, []);

  const handleBackendUnavailable = useCallback((unavailableBackend: GraphicsLabBackend) => {
    if (unavailableBackend === "webgl-2") {
      setRendererNotice("WebGL 2 is unavailable in this browser. Canvas 2D is active instead.");
      setBackend((current) => (current === "webgl-2" ? "canvas-2d" : current));
      return;
    }
    setRendererNotice("Canvas 2D is unavailable in this browser; the atmosphere cannot render.");
  }, []);

  useEffect(() => {
    const keyboard = createKeyboardInputAdapter(window);
    keyboardRef.current = keyboard;
    const removeVisibility = installFirstCrossingVisibility(document, {
      suspendForBackground() {
        accept(lifecycle.suspendForBackground(), keyboard.read());
        publishReadout();
      },
      resumeFromBackground() {
        accept(lifecycle.resumeFromBackground(), keyboard.read());
        publishReadout();
      },
    });
    let animationFrame = 0;
    let lastUiUpdate = 0;
    const loop = (frameTime: number) => {
      const input = keyboard.read();
      const snapshot = coordinator.snapshot();
      if (
        snapshot.session.lifecycle.started &&
        !snapshot.session.lifecycle.completed &&
        !snapshot.session.lifecycle.explicitlyPaused &&
        !snapshot.session.lifecycle.backgroundSuspended
      ) {
        accept(coordinator.sample(), input);
      }
      if (frameTime - lastUiUpdate >= 100) {
        lastUiUpdate = frameTime;
        publishReadout();
      }
      animationFrame = requestAnimationFrame(loop);
    };
    animationFrame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrame);
      removeVisibility();
      keyboard.dispose();
      if (keyboardRef.current === keyboard) keyboardRef.current = null;
    };
  }, [accept, coordinator, lifecycle, publishReadout]);

  const start = async () => {
    try {
      setRuntimeError(null);
      await instrumentRef.current?.startAtPhaseZero();
      accept(coordinator.start(), keyboardRef.current?.read() ?? NEUTRAL_INPUT);
      publishReadout();
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : "First Crossing failed to start.");
    }
  };

  const pause = () => {
    accept(lifecycle.pause(), keyboardRef.current?.read() ?? NEUTRAL_INPUT);
    publishReadout();
  };

  const resume = () => {
    accept(lifecycle.resume(), keyboardRef.current?.read() ?? NEUTRAL_INPUT);
    publishReadout();
  };

  const capture = () => {
    const snapshot = createFirstCrossingRunSnapshot(BINDING, coordinator.snapshot());
    setSavedRun(JSON.parse(JSON.stringify(snapshot)) as FirstCrossingRunSnapshotV1);
    setRestoreNote("Exact binding revision and coordinator state captured locally.");
  };

  const restore = () => {
    if (!savedRun) return;
    const restored = hydrateFirstCrossingRun(savedRun, (reference) =>
      reference.id === BINDING.authored.id && reference.revision === BINDING.authored.revision
        ? BINDING
        : undefined,
    );
    movementRef.current = createMovementState(DEFAULT_MOVEMENT_PARAMS);
    const restoredSnapshot = restored.coordinator.snapshot();
    readoutRef.current = {
      snapshot: restoredSnapshot,
      movement: movementRef.current,
      input: NEUTRAL_INPUT,
    };
    alignMusicalTransportToRestoredLifecycle(restoredSnapshot.session.lifecycle);
    setCoordinator(restored.coordinator);
    publishReadout();
    setRestoreNote(
      "Restored exact binding revision with no historical crossing or transmission events.",
    );
  };

  const reset = () => {
    engineClock.pause();
    const next = createCoordinator();
    movementRef.current = createMovementState(DEFAULT_MOVEMENT_PARAMS);
    readoutRef.current = {
      snapshot: next.snapshot(),
      movement: movementRef.current,
      input: NEUTRAL_INPUT,
    };
    setCoordinator(next);
    setSavedRun(null);
    setRuntimeError(null);
    setRestoreNote("New run identity created from the same provisional binding.");
    publishReadout();
  };

  const readAtmosphereFrame = useCallback(
    (): FirstCrossingAtmosphereFrame => ({
      activeJourneySeconds: readoutRef.current.snapshot.session.lifecycle.activeElapsedSeconds,
      movement: movementRef.current,
    }),
    [],
  );

  const { snapshot, movement, input } = readout;
  const session = snapshot.session.lifecycle;
  const transmission = snapshot.transmissions.current;
  const arrivalFade = snapshot.transmissions.arrivalFadeRequestedForStartEventId !== null;
  const activeTransmissionLabel = transmission
    ? (TRANSMISSION_LABELS.get(transmission.definitionId) ?? transmission.definitionId)
    : null;
  const canPause = session.started && !session.completed && !session.explicitlyPaused;
  const canResume = session.explicitlyPaused && !session.completed;
  const status = lifecycleLabel(snapshot);

  return (
    <main className="relative h-[100svh] min-h-[38rem] overflow-hidden bg-[#06141b] text-white">
      <FirstCrossingAtmosphere
        backend={backend}
        readFrame={readAtmosphereFrame}
        onBackendUnavailable={handleBackendUnavailable}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,12,18,0.06),transparent_38%,rgba(2,10,15,0.3)_70%,rgba(2,8,12,0.72))]"
      />

      <div
        className="pointer-events-none absolute left-1/2 top-[47%] z-10 h-[min(68vw,34rem)] w-[min(68vw,34rem)] -translate-x-1/2 -translate-y-1/2 opacity-90 mix-blend-screen"
        style={{
          transform: `translate(calc(-50% + ${Math.max(-22, Math.min(22, movement.position.x * 0.025))}px), calc(-50% + ${Math.max(-15, Math.min(15, movement.position.y * -0.025))}px))`,
        }}
      >
        <FirstCrossingInstrument ref={instrumentRef} binding={BINDING} />
      </div>

      <header className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-4 px-4 pt-4 sm:px-7 sm:pt-6">
        <div>
          <p className="font-mono text-[8px] uppercase tracking-[0.34em] text-white/45">
            SYS-011 · integrated development proof
          </p>
          <h1 className="mt-1 text-base font-medium tracking-[0.2em] text-white/90 sm:text-lg">
            FIRST CROSSING
          </h1>
          <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.18em] text-white/42">
            {BINDING.authored.status} binding · all artistic selections provisional
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDiagnostics((value) => !value)}
            aria-pressed={diagnostics}
            className="border border-white/15 bg-[#06141b]/55 p-2 text-white/58 backdrop-blur-md hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Toggle development diagnostics"
          >
            <SlidersHorizontal size={14} />
          </button>
          <Link
            to="/"
            className="border border-white/15 bg-[#06141b]/55 px-3 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/58 backdrop-blur-md hover:text-white"
          >
            Instrument
          </Link>
        </div>
      </header>

      {!session.started ? (
        <section className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[#041016]/18 px-6 backdrop-blur-[1px]">
          <div className="pointer-events-auto w-full max-w-sm border border-white/18 bg-[#07171d]/82 px-6 py-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <p className="font-mono text-[8px] uppercase tracking-[0.28em] text-white/42">
              One route · one composition · one run
            </p>
            <h2 className="mt-3 text-xl font-light tracking-[0.12em]">Enter the crossing</h2>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-white/52">
              Listen, drift, or steer. Inactivity is valid. W/A/S/D and arrow keys bend the view;
              they never alter the music or route clock.
            </p>
            <button
              type="button"
              onClick={start}
              className="mt-6 inline-flex items-center gap-2 border border-[#c4ece7]/36 bg-[#b9e6df]/10 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.2em] text-[#e4fffa] hover:bg-[#b9e6df]/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
            >
              <Play size={13} fill="currentColor" /> Begin
            </button>
            {runtimeError ? <p className="mt-3 text-xs text-amber-200">{runtimeError}</p> : null}
          </div>
        </section>
      ) : null}

      <section className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5">
        <div className="mx-auto max-w-6xl border border-white/14 bg-[#061419]/78 shadow-[0_24px_70px_rgba(0,0,0,0.4)] backdrop-blur-xl">
          <div className="h-px bg-white/10">
            <div
              className="h-px bg-[#d4f3ee]/70 transition-[width] duration-100 motion-reduce:transition-none"
              style={{ width: `${snapshot.crossing.progress * 100}%` }}
            />
          </div>
          <div className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:px-5">
            <div className="min-w-0">
              <p className="font-mono text-[8px] uppercase tracking-[0.23em] text-white/38">
                Route
              </p>
              <p className="mt-1 truncate text-xs tracking-[0.1em] text-white/76">
                ORIGIN — DESTINATION <span className="text-white/34">· PLACEHOLDER</span>
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={pause}
                disabled={!canPause}
                className="border border-white/14 p-2 text-white/60 disabled:opacity-25"
                aria-label="Pause crossing"
              >
                <Pause size={13} />
              </button>
              <button
                type="button"
                onClick={resume}
                disabled={!canResume}
                className="border border-white/14 p-2 text-white/60 disabled:opacity-25"
                aria-label="Resume crossing"
              >
                <Play size={13} />
              </button>
              <span className="min-w-28 text-center font-mono text-[9px] uppercase tracking-[0.18em] text-white/72">
                {status}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <p className="font-mono text-[8px] uppercase tracking-[0.23em] text-white/38">
                Progress
              </p>
              <p className="mt-1 font-mono text-xs tracking-[0.12em] text-white/76">
                {(snapshot.crossing.progress * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </section>

      <aside
        aria-live="polite"
        className={`absolute left-1/2 top-[22%] z-20 -translate-x-1/2 border border-white/12 bg-[#061419]/72 px-5 py-3 text-center backdrop-blur-lg transition-all duration-700 ${
          activeTransmissionLabel && !arrivalFade
            ? "translate-y-0 opacity-100"
            : "-translate-y-2 opacity-0"
        }`}
      >
        <p className="font-mono text-[7px] uppercase tracking-[0.28em] text-white/36">
          Development transmission · non-canon
        </p>
        <p className="mt-1 text-xs tracking-[0.12em] text-white/72">
          {activeTransmissionLabel ?? "—"}
        </p>
      </aside>

      {session.completed ? (
        <section className="absolute inset-0 z-[25] grid place-items-center bg-[#dbeef0]/[0.08] px-6 backdrop-blur-[2px]">
          <div className="border border-white/20 bg-[#061419]/78 px-8 py-7 text-center backdrop-blur-xl">
            <p className="font-mono text-[8px] uppercase tracking-[0.3em] text-white/46">
              Route boundary reached
            </p>
            <h2 className="mt-2 text-2xl font-light tracking-[0.2em]">ARRIVED</h2>
            <p className="mt-3 text-xs text-white/48">
              Arrival did not wait for musical Phase Zero.
            </p>
          </div>
        </section>
      ) : null}

      {diagnostics ? (
        <aside className="absolute right-3 top-20 z-40 w-[min(92vw,23rem)] border border-white/16 bg-[#041116]/92 p-4 font-mono text-[8px] uppercase tracking-[0.12em] text-white/58 shadow-2xl backdrop-blur-xl sm:right-6">
          <div className="flex items-center justify-between gap-3">
            <strong className="tracking-[0.22em] text-white/78">Integration diagnostics</strong>
            <div className="flex gap-1">
              {(["canvas-2d", "webgl-2"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => selectBackend(value)}
                  className={`border px-2 py-1 ${backend === value ? "border-white/35 text-white" : "border-white/12"}`}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
            <dt className="text-white/32">binding</dt>
            <dd>
              {BINDING.authored.id}@{BINDING.authored.revision}
            </dd>
            <dt className="text-white/32">run</dt>
            <dd className="truncate normal-case">{snapshot.identity.runId}</dd>
            <dt className="text-white/32">composition</dt>
            <dd>
              {BINDING.compositionSnapshot.id}@{BINDING.compositionSnapshot.revision}
            </dd>
            <dt className="text-white/32">music</dt>
            <dd>
              {engineClock.t().toFixed(3)}s · {engineClock.isPaused() ? "frozen" : "running"}
            </dd>
            <dt className="text-white/32">journey</dt>
            <dd>
              {session.activeElapsedSeconds.toFixed(3)}s · {status}
            </dd>
            <dt className="text-white/32">movement</dt>
            <dd>
              x {movement.position.x.toFixed(1)} · y {movement.position.y.toFixed(1)} · z{" "}
              {movement.position.z.toFixed(1)}
            </dd>
            <dt className="text-white/32">input</dt>
            <dd>
              {input.steerX.toFixed(1)}, {input.steerY.toFixed(1)}
            </dd>
            <dt className="text-white/32">transmission</dt>
            <dd>
              {activeTransmissionLabel ?? "silence"}
              {arrivalFade ? " · fading" : ""}
            </dd>
            <dt className="text-white/32">renderer</dt>
            <dd>{backend} · provisional</dd>
          </dl>
          {rendererNotice ? (
            <p className="mt-3 normal-case leading-relaxed tracking-normal text-amber-100/62">
              {rendererNotice}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={capture}
              className="flex items-center gap-1 border border-white/14 px-2 py-1.5"
            >
              <Save size={11} /> capture
            </button>
            <button
              type="button"
              onClick={restore}
              disabled={!savedRun}
              className="border border-white/14 px-2 py-1.5 disabled:opacity-25"
            >
              restore
            </button>
            <button
              type="button"
              onClick={reset}
              className="flex items-center gap-1 border border-white/14 px-2 py-1.5"
            >
              <RotateCcw size={11} /> new run
            </button>
          </div>
          <p className="mt-3 normal-case leading-relaxed tracking-normal text-white/38">
            {restoreNote}
          </p>
          <p className="mt-2 normal-case leading-relaxed tracking-normal text-amber-100/48">
            Provisional: Trigger family, pack, scale context, route duration, renderer, environment,
            transmission content, and arrival treatment. Crystallization absent.
          </p>
        </aside>
      ) : null}

      <PerfProbeMount />
    </main>
  );
}
