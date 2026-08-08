/**
 * SYS-005 in-player probe — dev-only.
 *
 * Mounted ONLY when the player URL carries `?perf=1`, and lazily imported so
 * its code never loads in the normal path. Runs the exact same
 * frameCollector / frameStats / session modules as /dev/performance, so the
 * numbers are directly comparable.
 *
 * Deliberately minimal: this is not a polished profiler overlay, and it does
 * not alter any normal player UI.
 */
import { useEffect, useMemo, useState } from "react";
import { createFrameCollector, type CollectorTick } from "@/lib/perf/frameCollector";
import { buildResult, formatDuration, stashResult } from "@/lib/perf/session";

export default function PerformanceProbe() {
  const collector = useMemo(() => createFrameCollector(), []);
  const [tick, setTick] = useState<CollectorTick>(() => collector.snapshot());

  useEffect(() => {
    const off = collector.subscribe(setTick);
    return () => {
      off();
      collector.dispose();
    };
  }, [collector]);

  const s = tick.stats;
  const rows: [string, string][] = [
    ["FPS", s.averageFps.toFixed(1)],
    ["FRAME", `${s.averageFrameMs.toFixed(1)}ms`],
    ["P95", `${s.p95FrameMs.toFixed(1)}ms`],
    ["P99", `${s.p99FrameMs.toFixed(1)}ms`],
    ["SESSION", formatDuration(tick.durationMs)],
  ];

  return (
    <div
      style={{
        position: "fixed",
        right: 8,
        top: 8,
        zIndex: 9999,
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.5,
        padding: "8px 10px",
        background: "rgba(0,0,0,0.72)",
        color: "#d8f0e4",
        border: "1px solid rgba(255,255,255,0.18)",
        borderRadius: 4,
        pointerEvents: "auto",
      }}
    >
      <div style={{ opacity: 0.6, marginBottom: 4 }}>PERF · {tick.status.toUpperCase()}</div>
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: "flex", gap: 10, justifyContent: "space-between" }}>
          <span style={{ opacity: 0.55 }}>{k}</span>
          <span>{v}</span>
        </div>
      ))}
      {tick.truncated ? <div style={{ marginTop: 4 }}>TRUNCATED</div> : null}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button style={btn} onClick={() => collector.start()}>
          START
        </button>
        <button
          style={btn}
          onClick={() => {
            collector.stop();
            stashResult(buildResult(collector, "in-player probe"));
          }}
        >
          STOP
        </button>
        <a href="/dev/performance" target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none" }}>
          OPEN
        </a>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: 10,
  padding: "2px 6px",
  background: "transparent",
  color: "inherit",
  border: "1px solid rgba(255,255,255,0.3)",
  borderRadius: 3,
  cursor: "pointer",
};