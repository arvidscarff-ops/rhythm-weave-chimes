/**
 * SYS-008 journey integration laboratory.
 *
 * This route proves the journey-side composition contract. It is deliberately
 * diagnostic and is not a finished crossing, cockpit, hub, or game screen.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { PROVISIONAL_CROSSING_THRESHOLDS } from "@/lib/crossing/crossingRuntime";
import {
  createFirstCrossingCoordinator,
  hydrateFirstCrossingCoordinator,
  type FirstCrossingCoordinator,
  type FirstCrossingCoordinatorResult,
  type FirstCrossingCoordinatorSnapshotV1,
} from "@/lib/journey/firstCrossingCoordinator";
import { coordinatorConfigFromFirstCrossingBinding } from "@/lib/journey/firstCrossingBindingCoordinator";
import { resolveProvisionalFirstCrossingBinding } from "@/lib/journey/firstCrossingBindingFixture";
import { installFirstCrossingVisibility } from "@/lib/journey/firstCrossingVisibility";
import {
  createKeyboardInputAdapter,
  type KeyboardInputAdapter,
} from "@/lib/movement/movementInput";
import {
  createMovementState,
  DEFAULT_MOVEMENT_PARAMS,
  headingOf,
  stepMovement,
  type MovementInput,
  type MovementState,
} from "@/lib/movement/movementModel";
import { SAMPLE_TRANSMISSIONS } from "@/lib/transmissions/sampleTransmissions";

export const Route = createFileRoute("/dev/journey")({
  ssr: false,
  component: JourneyLab,
  head: () => ({
    meta: [
      { title: "First Crossing Journey Lab · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "SYS-008 development laboratory for the composed First Crossing journey runtime.",
      },
    ],
  }),
});

const NEUTRAL_INPUT: MovementInput = Object.freeze({ steerX: 0, steerY: 0 });
const PROVISIONAL_BINDING = resolveProvisionalFirstCrossingBinding();

function newRunId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `journey-lab-${Date.now()}`;
}

function createLabCoordinator(runId = newRunId()): FirstCrossingCoordinator {
  return createFirstCrossingCoordinator(
    coordinatorConfigFromFirstCrossingBinding(PROVISIONAL_BINDING, runId, {
      thresholds: PROVISIONAL_CROSSING_THRESHOLDS,
      transmissions: {
        definitionSetId: "journey-lab-transmissions-v1",
        seed: `journey-lab:${runId}`,
        definitions: SAMPLE_TRANSMISSIONS,
        admissionChance: 1,
        minGapSeconds: 4,
      },
    }),
  );
}

function lifecycleLabel(snapshot: FirstCrossingCoordinatorSnapshotV1): string {
  const lifecycle = snapshot.session.lifecycle;
  if (lifecycle.completed) return "completed";
  if (!lifecycle.started) return "not started";
  if (lifecycle.explicitlyPaused) return "paused";
  if (lifecycle.backgroundSuspended) return "hidden / suspended";
  return "running";
}

type LabReadout = Readonly<{
  snapshot: FirstCrossingCoordinatorSnapshotV1;
  movement: MovementState;
  input: MovementInput;
  movementDeltaSeconds: number;
}>;

function JourneyLab() {
  const [coordinator, setCoordinator] = useState(createLabCoordinator);
  const movementRef = useRef(createMovementState(DEFAULT_MOVEMENT_PARAMS));
  const keyboardRef = useRef<KeyboardInputAdapter | null>(null);
  const crossingLogRef = useRef<string[]>([]);
  const transmissionLogRef = useRef<string[]>([]);
  const lastResultRef = useRef<FirstCrossingCoordinatorResult | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<FirstCrossingCoordinatorSnapshotV1 | null>(
    null,
  );
  const [crossingLog, setCrossingLog] = useState<string[]>([]);
  const [transmissionLog, setTransmissionLog] = useState<string[]>([]);
  const [reconstructionNote, setReconstructionNote] = useState("No reconstruction yet.");
  const [readout, setReadout] = useState<LabReadout>(() => ({
    snapshot: coordinator.snapshot(),
    movement: movementRef.current,
    input: NEUTRAL_INPUT,
    movementDeltaSeconds: 0,
  }));

  const accept = useCallback(
    (result: FirstCrossingCoordinatorResult, input: MovementInput): void => {
      movementRef.current = stepMovement(
        movementRef.current,
        input,
        result.movementDeltaSeconds,
        DEFAULT_MOVEMENT_PARAMS,
      );
      if (result.crossingTransitions.length > 0) {
        crossingLogRef.current = [
          ...result.crossingTransitions.map(
            ({ id, atProgress }) => `${id} @ ${(atProgress * 100).toFixed(1)}%`,
          ),
          ...crossingLogRef.current,
        ].slice(0, 10);
        setCrossingLog(crossingLogRef.current);
      }
      if (result.transmissionEvents.length > 0) {
        transmissionLogRef.current = [
          ...result.transmissionEvents.map(
            ({ type, definitionId, atActiveSeconds }) =>
              `${type} · ${definitionId} @ ${atActiveSeconds.toFixed(2)}s`,
          ),
          ...transmissionLogRef.current,
        ].slice(0, 12);
        setTransmissionLog(transmissionLogRef.current);
      }
      lastResultRef.current = result;
    },
    [],
  );

  const publishReadout = useCallback(
    (input = keyboardRef.current?.read() ?? NEUTRAL_INPUT): void => {
      setReadout({
        snapshot: coordinator.snapshot(),
        movement: movementRef.current,
        input,
        movementDeltaSeconds: lastResultRef.current?.movementDeltaSeconds ?? 0,
      });
    },
    [coordinator],
  );

  useEffect(() => {
    const keyboard = createKeyboardInputAdapter(window);
    keyboardRef.current = keyboard;
    const removeVisibility = installFirstCrossingVisibility(document, {
      suspendForBackground() {
        const input = keyboard.read();
        accept(coordinator.suspendForBackground(), input);
        publishReadout(input);
      },
      resumeFromBackground() {
        const input = keyboard.read();
        accept(coordinator.resumeFromBackground(), input);
        publishReadout(input);
      },
    });
    let frame = 0;
    let lastUiFrame = 0;

    const loop = (time: number) => {
      frame = requestAnimationFrame(loop);
      const input = keyboard.read();
      if (coordinator.snapshot().session.lifecycle.started) {
        accept(coordinator.sample(), input);
      }
      if (time - lastUiFrame >= 100) {
        lastUiFrame = time;
        publishReadout(input);
      }
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      removeVisibility();
      keyboard.dispose();
      if (keyboardRef.current === keyboard) keyboardRef.current = null;
    };
  }, [accept, coordinator, publishReadout]);

  const runAction = (action: () => FirstCrossingCoordinatorResult) => {
    const input = keyboardRef.current?.read() ?? NEUTRAL_INPUT;
    accept(action(), input);
    publishReadout(input);
  };

  const start = () => runAction(() => coordinator.start());
  const pause = () => runAction(() => coordinator.pause());
  const resume = () => runAction(() => coordinator.resume());

  const saveSnapshot = () => {
    const saved = JSON.parse(
      JSON.stringify(coordinator.snapshot()),
    ) as FirstCrossingCoordinatorSnapshotV1;
    setSavedSnapshot(saved);
    setReconstructionNote("Snapshot captured. No child events were emitted.");
  };

  const hydrateSavedSnapshot = () => {
    if (!savedSnapshot) return;
    const restored = hydrateFirstCrossingCoordinator(savedSnapshot);
    movementRef.current = createMovementState(DEFAULT_MOVEMENT_PARAMS);
    crossingLogRef.current = [];
    transmissionLogRef.current = [];
    lastResultRef.current = null;
    setCrossingLog([]);
    setTransmissionLog([]);
    setCoordinator(restored);
    setReadout({
      snapshot: restored.snapshot(),
      movement: movementRef.current,
      input: NEUTRAL_INPUT,
      movementDeltaSeconds: 0,
    });
    setReconstructionNote(
      "Hydrated through child validators: zero historical events and zero movement catch-up.",
    );
  };

  const createNewRun = () => {
    const next = createLabCoordinator();
    movementRef.current = createMovementState(DEFAULT_MOVEMENT_PARAMS);
    crossingLogRef.current = [];
    transmissionLogRef.current = [];
    lastResultRef.current = null;
    setSavedSnapshot(null);
    setCrossingLog([]);
    setTransmissionLog([]);
    setCoordinator(next);
    setReadout({
      snapshot: next.snapshot(),
      movement: movementRef.current,
      input: NEUTRAL_INPUT,
      movementDeltaSeconds: 0,
    });
    setReconstructionNote("New caller-generated run identity created.");
  };

  const { snapshot, movement, input, movementDeltaSeconds } = readout;
  const lifecycle = snapshot.session.lifecycle;
  const currentTransmission = snapshot.transmissions.current?.definitionId ?? "—";
  const heading = headingOf(movement);
  const markerX = 50 + Math.max(-42, Math.min(42, movement.position.x * 0.25));
  const markerY = 50 - Math.max(-42, Math.min(42, movement.position.y * 0.25));

  return (
    <main style={{ fontFamily: "monospace", maxWidth: 1080, padding: 24 }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>SYS-008 First Crossing journey lab</h1>
      <p style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 780, opacity: 0.72 }}>
        Development-only composition proof. This is not the final First Crossing, graphics, cockpit,
        transmission content, or musical runtime. W/A/S/D and arrow keys affect only ephemeral local
        movement; hiding this tab freezes the entire journey-side composition.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "16px 0" }}>
        <button type="button" onClick={start} disabled={lifecycle.started}>
          Start run
        </button>
        <button
          type="button"
          onClick={pause}
          disabled={!lifecycle.started || lifecycle.completed || lifecycle.explicitlyPaused}
        >
          Pause
        </button>
        <button
          type="button"
          onClick={resume}
          disabled={!lifecycle.explicitlyPaused || lifecycle.completed}
        >
          Resume
        </button>
        <button type="button" onClick={saveSnapshot}>
          Capture snapshot
        </button>
        <button type="button" onClick={hydrateSavedSnapshot} disabled={!savedSnapshot}>
          Hydrate snapshot
        </button>
        <button type="button" onClick={createNewRun}>
          New run identity
        </button>
      </div>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
        }}
      >
        <DiagnosticPanel title="Coordinator">
          <Row
            label="BINDING"
            value={`${PROVISIONAL_BINDING.authored.id}@${PROVISIONAL_BINDING.authored.revision}`}
          />
          <Row label="BINDING STATUS" value={PROVISIONAL_BINDING.authored.status} />
          <Row label="RUN" value={snapshot.identity.runId} />
          <Row label="ROUTE" value={snapshot.identity.routeDefinitionId} />
          <Row
            label="COMPOSITION"
            value={`${PROVISIONAL_BINDING.compositionSnapshot.id}@${PROVISIONAL_BINDING.compositionSnapshot.revision}`}
          />
          <Row
            label="TRIGGER PRESENTATION"
            value={`${PROVISIONAL_BINDING.triggerEnginePresentation.id} (${PROVISIONAL_BINDING.authored.triggerEnginePresentation.status})`}
          />
          <Row
            label="SOUND / SCALE"
            value={`${PROVISIONAL_BINDING.sound.pack.id} / ${PROVISIONAL_BINDING.sound.scale.id}`}
          />
          <Row label="ENVIRONMENT" value={PROVISIONAL_BINDING.environment.id} />
          <Row label="SESSION" value={lifecycleLabel(snapshot)} />
          <Row label="ACTIVE TIME" value={`${lifecycle.activeElapsedSeconds.toFixed(3)} s`} />
          <Row label="CROSSING PHASE" value={snapshot.crossing.phase} />
          <Row label="PROGRESS" value={`${(snapshot.crossing.progress * 100).toFixed(2)}%`} />
          <Row label="TRANSMISSION" value={currentTransmission} />
          <Row
            label="TX REMAINING"
            value={snapshot.transmissions.remainingSeconds?.toFixed(2) ?? "—"}
          />
          <Row label="MOVEMENT DELTA" value={`${movementDeltaSeconds.toFixed(4)} s`} />
        </DiagnosticPanel>

        <DiagnosticPanel title="Ephemeral movement">
          <div
            aria-label="Simple local movement visualization"
            style={{
              position: "relative",
              height: 150,
              border: "1px solid currentColor",
              opacity: 0.8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                bottom: 0,
                borderLeft: "1px dashed currentColor",
                opacity: 0.25,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: 0,
                right: 0,
                borderTop: "1px dashed currentColor",
                opacity: 0.25,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: `${markerX}%`,
                top: `${markerY}%`,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "currentColor",
                transform: "translate(-50%, -50%)",
              }}
            />
          </div>
          <Row
            label="POSITION"
            value={`x ${movement.position.x.toFixed(2)} · y ${movement.position.y.toFixed(2)} · z ${movement.position.z.toFixed(2)}`}
          />
          <Row
            label="INPUT"
            value={`x ${input.steerX.toFixed(1)} · y ${input.steerY.toFixed(1)}`}
          />
          <Row
            label="HEADING"
            value={`yaw ${(heading.yaw * 57.2958).toFixed(1)}° · pitch ${(heading.pitch * 57.2958).toFixed(1)}°`}
          />
          <p style={{ fontSize: 11, opacity: 0.62 }}>
            Movement is intentionally absent from the persistent coordinator snapshot.
          </p>
        </DiagnosticPanel>

        <DiagnosticPanel title="Recent crossing transitions">
          <EventList entries={crossingLog} empty="No crossing transitions yet." />
        </DiagnosticPanel>

        <DiagnosticPanel title="Recent transmission events">
          <EventList entries={transmissionLog} empty="No transmission events yet." />
        </DiagnosticPanel>
      </section>

      <p style={{ marginTop: 16, fontSize: 11, opacity: 0.65 }}>{reconstructionNote}</p>
    </main>
  );
}

function DiagnosticPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ border: "1px solid currentColor", padding: 14 }}>
      <h2 style={{ fontSize: 12, textTransform: "uppercase", margin: "0 0 10px" }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px minmax(0, 1fr)",
        gap: 8,
        fontSize: 11,
        marginBottom: 5,
      }}
    >
      <span style={{ opacity: 0.55 }}>{label}</span>
      <span style={{ overflowWrap: "anywhere" }}>{value}</span>
    </div>
  );
}

function EventList({ entries, empty }: { entries: string[]; empty: string }) {
  if (entries.length === 0) return <p style={{ fontSize: 11, opacity: 0.55 }}>{empty}</p>;
  return (
    <ol style={{ paddingLeft: 18, margin: 0, fontSize: 11, lineHeight: 1.6 }}>
      {entries.map((entry, index) => (
        <li key={`${entry}:${index}`}>{entry}</li>
      ))}
    </ol>
  );
}
