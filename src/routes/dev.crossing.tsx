/**
 * SYS-007 developer sandbox — diagnostic surface for the crossing runtime.
 *
 * PROTOTYPE-ONLY. Deliberately unstyled/plain so it is never mistaken for the
 * PHASE HUD. Not linked from the player experience. This component owns the
 * polling cadence (its own rAF); the runtime owns no loop of its own.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createCrossingRuntime,
  type CrossingPhase,
  type CrossingState,
} from "@/lib/crossing/crossingRuntime";
import { FIRST_CROSSING_ROUTE, nodeLabel } from "@/lib/crossing/routes";

export const Route = createFileRoute("/dev/crossing")({
  ssr: false,
  component: CrossingSandbox,
  head: () => ({
    meta: [
      { title: "Crossing Runtime Sandbox · Dev" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Developer diagnostic surface for the SYS-007 crossing route runtime prototype." },
    ],
  }),
});

function CrossingSandbox() {
  const runtime = useMemo(
    () =>
      createCrossingRuntime({
        id: FIRST_CROSSING_ROUTE.id,
        originId: FIRST_CROSSING_ROUTE.originId,
        destinationId: FIRST_CROSSING_ROUTE.destinationId,
        durationSeconds: FIRST_CROSSING_ROUTE.defaultDurationSeconds,
      }),
    [],
  );

  const [state, setState] = useState<CrossingState>(() => runtime.peek());
  const [duration, setDuration] = useState(FIRST_CROSSING_ROUTE.defaultDurationSeconds);
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<string[]>([]);

  useEffect(() => {
    const push = (line: string) => {
      logRef.current = [line, ...logRef.current].slice(0, 12);
      setLog(logRef.current);
    };
    const off = runtime.subscribe({
      crossingStarted: () => push("crossingStarted"),
      phaseChanged: (p: CrossingPhase) => push(`phaseChanged → ${p}`),
      crossingArrived: () => push("crossingArrived"),
    });
    let raf = 0;
    const loop = () => {
      setState(runtime.sample());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      off();
    };
  }, [runtime]);

  const rows: [string, string][] = [
    ["PHASE", state.phase],
    ["PROGRESS", state.progress.toFixed(4)],
    ["ELAPSED", `${state.elapsedSeconds.toFixed(2)} s`],
    ["DURATION", `${state.durationSeconds.toFixed(0)} s`],
    ["ORIGIN", nodeLabel(state.originId)],
    ["DESTINATION", nodeLabel(state.destinationId)],
    ["PAUSED", String(state.paused)],
  ];

  return (
    <main style={{ fontFamily: "monospace", padding: 24, maxWidth: 620 }}>
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>SYS-007 crossing runtime sandbox</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
        Diagnostic only — prototype pending Codex review. Not PHASE HUD.
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

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => runtime.start({ durationSeconds: duration })}>START</button>
        <button onClick={() => (state.paused ? runtime.resume() : runtime.pause())}>
          {state.paused ? "RESUME" : "PAUSE"}
        </button>
        <button onClick={() => runtime.reset()}>RESET</button>
      </div>

      <label style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
        duration (30–120 s): {duration}
        <input
          type="range"
          min={30}
          max={120}
          step={1}
          value={duration}
          onChange={(e) => {
            const v = Number(e.target.value);
            setDuration(v);
            runtime.setDuration(v);
          }}
          style={{ display: "block", width: "100%" }}
        />
      </label>

      <label style={{ display: "block", fontSize: 12, marginBottom: 16 }}>
        scrub progress (dev only): {state.progress.toFixed(3)}
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={state.progress}
          onChange={(e) => runtime.scrubTo(Number(e.target.value))}
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
