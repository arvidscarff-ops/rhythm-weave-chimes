/**
 * SYS-010 developer sandbox — diagnostic surface for the transmission runtime.
 *
 * PROTOTYPE-ONLY. Deliberately unstyled so it is never mistaken for PHASE comms
 * UI. No audio, no subtitles, no radio art direction. This component owns the
 * polling cadence (its own rAF); neither runtime owns a loop.
 *
 * It wires SYS-007 → SYS-010 through the minimal read-only snapshot only:
 *   crossingRuntime.sample() → { crossingId, progress, phase } → transmissionRuntime.update()
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createCrossingRuntime, type CrossingState } from "@/lib/crossing/crossingRuntime";
import { FIRST_CROSSING_ROUTE } from "@/lib/crossing/routes";
import { createTransmissionRuntime, type TransmissionState } from "@/lib/transmissions/transmissionRuntime";
import { SAMPLE_TRANSMISSIONS } from "@/lib/transmissions/sampleTransmissions";

export const Route = createFileRoute("/dev/transmissions")({
  ssr: false,
  component: TransmissionSandbox,
  head: () => ({
    meta: [
      { title: "Transmission Runtime Sandbox · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Developer diagnostic surface for the SYS-010 transmission runtime prototype driven by the crossing runtime.",
      },
    ],
  }),
});

const labelFor = (id: string) =>
  SAMPLE_TRANSMISSIONS.find((d) => d.id === id)?.label ?? id;

function TransmissionSandbox() {
  const crossing = useMemo(
    () =>
      createCrossingRuntime({
        id: FIRST_CROSSING_ROUTE.id,
        originId: FIRST_CROSSING_ROUTE.originId,
        destinationId: FIRST_CROSSING_ROUTE.destinationId,
        durationSeconds: FIRST_CROSSING_ROUTE.defaultDurationSeconds,
      }),
    [],
  );

  const transmissions = useMemo(
    () =>
      createTransmissionRuntime({
        definitions: SAMPLE_TRANSMISSIONS,
        admissionChance: 0.7,
        minGapSeconds: 4,
      }),
    [],
  );

  const [seedInput, setSeedInput] = useState("1234");
  const [crossingState, setCrossingState] = useState<CrossingState>(() => crossing.peek());
  const [txState, setTxState] = useState<TransmissionState>(() => transmissions.peek());
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<string[]>([]);

  useEffect(() => {
    const push = (line: string) => {
      logRef.current = [line, ...logRef.current].slice(0, 12);
      setLog(logRef.current);
    };
    const offTx = transmissions.subscribe({
      transmissionStarted: (t) => push(`started → ${t.definition.label}`),
      transmissionEnded: (t, reason) => push(`ended → ${t.definition.label} (${reason})`),
      eligibilityChanged: (ids) => push(`eligible → [${ids.map(labelFor).join(", ") || "—"}]`),
    });

    let raf = 0;
    const loop = () => {
      const cs = crossing.sample();
      setCrossingState(cs);
      // The only coupling point: an immutable read-only snapshot.
      setTxState(
        transmissions.update({ crossingId: cs.id, progress: cs.progress, phase: cs.phase }),
      );
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      offTx();
    };
  }, [crossing, transmissions]);

  const startRun = () => {
    transmissions.startCrossing({ crossingId: FIRST_CROSSING_ROUTE.id, seed: seedInput });
    crossing.start();
  };

  const resetRun = () => {
    crossing.reset();
    transmissions.reset();
    logRef.current = [];
    setLog([]);
  };

  const rows: [string, string][] = [
    ["CROSSING", crossingState.phase],
    ["PROGRESS", `${Math.round(crossingState.progress * 100)}%`],
    ["SEED", txState.seed || "—"],
    ["PAUSED", String(crossingState.paused)],
  ];

  return (
    <main style={{ fontFamily: "monospace", padding: 24, maxWidth: 620 }}>
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>SYS-010 transmission runtime sandbox</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
        Diagnostic only — prototype pending Codex review. Placeholder content, no audio, not PHASE comms UI.
      </p>

      <table style={{ fontSize: 13, marginBottom: 16 }}>
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ paddingRight: 16, opacity: 0.6 }}>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section style={{ fontSize: 13, marginBottom: 16 }}>
        <div style={{ opacity: 0.6 }}>CURRENT</div>
        {txState.current ? (
          <div>
            {txState.current.definition.label} — remaining{" "}
            {(txState.remainingSeconds ?? 0).toFixed(1)}s
          </div>
        ) : (
          <div style={{ opacity: 0.4 }}>—</div>
        )}

        <div style={{ opacity: 0.6, marginTop: 10 }}>PLAYED</div>
        {txState.playedTransmissionIds.length === 0 ? (
          <div style={{ opacity: 0.4 }}>—</div>
        ) : (
          txState.playedTransmissionIds.map((id) => <div key={id}>{labelFor(id)}</div>)
        )}

        <div style={{ opacity: 0.6, marginTop: 10 }}>ELIGIBLE</div>
        {txState.eligibleTransmissionIds.length === 0 ? (
          <div style={{ opacity: 0.4 }}>—</div>
        ) : (
          txState.eligibleTransmissionIds.map((id) => (
            <div key={id}>
              {labelFor(id)}
              {txState.admittedTransmissionIds.includes(id) ? " (admitted)" : " (not admitted)"}
            </div>
          ))
        )}
      </section>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={startRun}>START CROSSING</button>
        <button onClick={() => (crossingState.paused ? crossing.resume() : crossing.pause())}>
          {crossingState.paused ? "RESUME" : "PAUSE"}
        </button>
        <button onClick={resetRun}>RESET</button>
      </div>

      <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
        seed (restart run to apply)
        <input
          value={seedInput}
          onChange={(e) => setSeedInput(e.target.value)}
          style={{ display: "block", width: 200 }}
        />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 16 }}>
        scrub progress (dev only): {crossingState.progress.toFixed(3)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={crossingState.progress}
          onChange={(e) => crossing.scrubTo(Number(e.target.value))}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <div style={{ fontSize: 12 }}>
        <div style={{ opacity: 0.6, marginBottom: 4 }}>EVENTS</div>
        {log.length === 0 ? <div style={{ opacity: 0.4 }}>—</div> : null}
        {log.map((l, i) => (
          <div key={`${l}-${i}`}>{l}</div>
        ))}
      </div>
    </main>
  );
}
