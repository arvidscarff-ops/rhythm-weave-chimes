/**
 * SYS-005 developer surface — /dev/performance
 *
 * PROTOTYPE-ONLY. Diagnostic appearance, deliberately not PHASE HUD styling.
 * Not linked from the player. Note this route renders no scene of its own, so
 * measuring here reflects an essentially idle page; to profile the real
 * experience use the in-player probe (`/?perf=1`) which shares these modules,
 * then open this page to inspect and export the handed-off result.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { createFrameCollector, type CollectorTick } from "@/lib/perf/frameCollector";
import {
  buildResult,
  downloadResult,
  formatDuration,
  readStashedResult,
  resultToJson,
  type PerfResult,
} from "@/lib/perf/session";

export const Route = createFileRoute("/dev/performance")({
  ssr: false,
  component: PerformanceHarness,
  head: () => ({
    meta: [
      { title: "Performance Harness · Dev" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content: "Developer-only frame performance measurement harness for PHASE (SYS-005).",
      },
    ],
  }),
});

const mono = { fontFamily: "monospace" } as const;

function PerformanceHarness() {
  const collector = useMemo(() => createFrameCollector(), []);
  const [tick, setTick] = useState<CollectorTick>(() => collector.snapshot());
  const [label, setLabel] = useState("");
  const [result, setResult] = useState<PerfResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = collector.subscribe(setTick);
    setResult(readStashedResult());
    return () => {
      off();
      collector.dispose();
    };
  }, [collector]);

  const s = tick.stats;
  const live: [string, string][] = [
    ["STATE", tick.status.toUpperCase()],
    ["FPS", s.averageFps.toFixed(1)],
    ["FRAME", `${s.averageFrameMs.toFixed(1)}ms`],
    ["MEDIAN", `${s.medianFrameMs.toFixed(1)}ms`],
    ["P95", `${s.p95FrameMs.toFixed(1)}ms`],
    ["P99", `${s.p99FrameMs.toFixed(1)}ms`],
    ["WORST", `${s.worstFrameMs.toFixed(1)}ms`],
    ["SLOW >16", `${s.slowFrames16.count} / ${s.sampleCount}`],
    ["SLOW >33", `${s.slowFrames33.count} / ${s.sampleCount}`],
    ["SLOW >50", `${s.slowFrames50.count} / ${s.sampleCount}`],
    ["SESSION", formatDuration(tick.durationMs)],
    ["SAMPLES", `${tick.sampleCount} (observed ${tick.totalFramesObserved})`],
  ];

  return (
    <main style={{ ...mono, padding: 24, maxWidth: 720 }}>
      <h1 style={{ fontSize: 16, marginBottom: 4 }}>SYS-005 performance harness</h1>
      <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 16 }}>
        Diagnostic only — prototype pending Codex review. This route renders no scene; use{" "}
        <Link to="/" search={{ perf: "1" }} style={{ textDecoration: "underline" }}>
          /?perf=1
        </Link>{" "}
        to measure the live player with the same collector.
      </p>

      <table style={{ fontSize: 13, marginBottom: 16 }}>
        <tbody>
          {live.map(([k, v]) => (
            <tr key={k}>
              <td style={{ paddingRight: 20, opacity: 0.6 }}>{k}</td>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {tick.truncated ? (
        <p style={{ fontSize: 12, marginBottom: 12 }}>
          TRUNCATED — analysed the most recent {tick.sampleCount} of {tick.totalFramesObserved}{" "}
          frames (ring buffer cap).
        </p>
      ) : null}

      <label style={{ display: "block", fontSize: 12, marginBottom: 10 }}>
        label
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="GFX-001 cloud pass A"
          style={{ ...mono, display: "block", width: "100%", padding: 4, marginTop: 4 }}
        />
      </label>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => { setResult(null); collector.start(); }}>START MEASUREMENT</button>
        <button
          onClick={() => {
            collector.stop();
            setResult(buildResult(collector, label));
          }}
        >
          STOP
        </button>
        <button onClick={() => { collector.reset(); setResult(null); }}>RESET</button>
      </div>

      {result ? (
        <section style={{ fontSize: 12 }}>
          <div style={{ opacity: 0.6, marginBottom: 4 }}>RESULT</div>
          {result.truncated ? (
            <div style={{ marginBottom: 6 }}>
              TRUNCATED — analysed the most recent {result.stats.sampleCount} of{" "}
              {result.totalFramesObserved} frames.
            </div>
          ) : null}
          <pre
            style={{
              whiteSpace: "pre-wrap",
              maxHeight: 320,
              overflow: "auto",
              padding: 8,
              border: "1px solid currentColor",
              opacity: 0.85,
            }}
          >
            {resultToJson(result)}
          </pre>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={() => {
                void navigator.clipboard?.writeText(resultToJson(result));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "COPIED" : "COPY RESULTS"}
            </button>
            <button onClick={() => downloadResult(result)}>EXPORT JSON</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}