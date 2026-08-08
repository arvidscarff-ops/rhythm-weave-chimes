/**
 * SYS-005 — result snapshot assembly.
 *
 * Epoch timestamps ARE used here, deliberately: this is measurement/history
 * data for manual comparison between runs, not simulation timing. Nothing in
 * this module is a clock authority and nothing consumes it at runtime.
 */

import type { FrameCollector } from "./frameCollector";
import type { FrameStats } from "./frameStats";
import { getActiveScene } from "@/lib/scenes/activeScene";

export type PerfContext = {
  route?: string;
  sceneName?: string;
  viewport?: { width: number; height: number };
  devicePixelRatio?: number;
};

export type PerfResult = {
  label: string;
  startedAtIso: string;
  startedAtEpochMs: number;
  /** Session wall duration minus hidden (backgrounded) time, ms. */
  durationMs: number;
  /** True when the ring buffer overflowed and only recent frames were analysed. */
  truncated: boolean;
  /** Frames observed over the whole session, including any dropped by truncation. */
  totalFramesObserved: number;
  stats: FrameStats;
  context?: PerfContext;
};

/**
 * Best-effort environment context. Anything unavailable is OMITTED rather than
 * guessed — no scraping, no invented values.
 */
export function collectContext(): PerfContext | undefined {
  if (typeof window === "undefined") return undefined;
  const ctx: PerfContext = {};
  try {
    ctx.route = window.location.pathname;
    ctx.viewport = { width: window.innerWidth, height: window.innerHeight };
    ctx.devicePixelRatio = window.devicePixelRatio;
    const scene = getActiveScene();
    if (scene?.name) ctx.sceneName = scene.name;
  } catch {
    /* context is optional by design */
  }
  return Object.keys(ctx).length > 0 ? ctx : undefined;
}

export function buildResult(collector: FrameCollector, label: string): PerfResult {
  const snap = collector.snapshot();
  const startedAtEpochMs = collector.getStartedAtEpochMs() ?? Date.now();
  return {
    label: label.trim() || "unlabelled",
    startedAtIso: new Date(startedAtEpochMs).toISOString(),
    startedAtEpochMs,
    durationMs: Math.round(snap.durationMs),
    truncated: snap.truncated,
    totalFramesObserved: snap.totalFramesObserved,
    stats: snap.stats,
    context: collectContext(),
  };
}

export function resultToJson(result: PerfResult): string {
  return JSON.stringify(result, null, 2);
}

export function downloadResult(result: PerfResult): void {
  const safe = result.label.replace(/[^a-z0-9_-]+/gi, "-").toLowerCase();
  const stamp = new Date(result.startedAtEpochMs).toISOString().replace(/[:.]/g, "-");
  const blob = new Blob([resultToJson(result)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `phase-perf-${safe}-${stamp}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Hand-off slot so the in-player probe's last result can be opened in /dev/performance. */
export const PERF_HANDOFF_KEY = "phase:perf:lastResult";

export function stashResult(result: PerfResult): void {
  try {
    sessionStorage.setItem(PERF_HANDOFF_KEY, resultToJson(result));
  } catch {
    /* private-browsing fallback */
  }
}

export function readStashedResult(): PerfResult | null {
  try {
    const raw = sessionStorage.getItem(PERF_HANDOFF_KEY);
    return raw ? (JSON.parse(raw) as PerfResult) : null;
  } catch {
    return null;
  }
}

export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}