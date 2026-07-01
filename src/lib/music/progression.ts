/**
 * Chord Progression Engine
 * ------------------------
 *
 * Admin-authored scales live in Cloud (`custom_scales` + `scale_progressions`).
 * This module keeps an in-memory registry of published scales and derives the
 * currently active progression step from the global clock.
 *
 * Progression state is a pure function of `(globalTime, bpm, activeScale)` —
 * nothing is persisted at runtime. Callers just ask for `activeStep(scaleId)`
 * when it's time to fire a note; the answer is stable for the duration of
 * that bar and advances automatically as the clock rolls forward.
 */

import { engineClock } from "@/lib/engine/clock";

export type ProgressionStep = {
  step_order: number;
  chord_tones: number[];
  accent_tones: number[];
  duration_bars: number;
};

export type ActiveScale = {
  id: string;
  name: string;
  pool_size: number;
  intervals: number[];
  steps: ProgressionStep[];
};

/** Probability that a note picks from `accent_tones` instead of chord tones. */
export const ACCENT_PROBABILITY = 0.15;

const registry = new Map<string, ActiveScale>();
const listeners = new Set<() => void>();
let tempoBpm = 90;

/** Global fallback if no scale is loaded — chromatic single-tone. */
const FALLBACK: ActiveScale = {
  id: "__fallback",
  name: "Fallback",
  pool_size: 5,
  intervals: [0, 3, 5, 7, 10],
  steps: [{ step_order: 0, chord_tones: [0, 2, 4], accent_tones: [1, 3], duration_bars: 4 }],
};

export function setRegistry(scales: ActiveScale[]) {
  registry.clear();
  for (const s of scales) registry.set(s.id, s);
  listeners.forEach((l) => l());
}

export function subscribeRegistry(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function getScale(id: string | null | undefined): ActiveScale {
  if (!id) {
    const first = registry.values().next().value as ActiveScale | undefined;
    return first ?? FALLBACK;
  }
  return registry.get(id) ?? FALLBACK;
}

export function listScales(): ActiveScale[] {
  return Array.from(registry.values());
}

/** Master tempo. Set from the UI whenever BPM changes. */
export function setTempo(bpm: number) {
  tempoBpm = Math.max(20, bpm);
}

export function getTempo(): number {
  return tempoBpm;
}

/** Elapsed bars since engine phase-zero, at the current tempo. */
export function currentBar(): number {
  const t = engineClock.t(); // seconds since phase zero
  const secPerBeat = 60 / tempoBpm;
  const secPerBar = secPerBeat * 4; // assume 4/4
  return t / secPerBar;
}

/** Which progression step is active right now for a given scale. */
export function activeStep(scale: ActiveScale): ProgressionStep {
  const steps = scale.steps.length > 0 ? scale.steps : FALLBACK.steps;
  const total = steps.reduce((n, s) => n + Math.max(1, s.duration_bars), 0);
  if (total <= 0) return steps[0];
  const bar = currentBar();
  const modBar = ((bar % total) + total) % total;
  let acc = 0;
  for (const s of steps) {
    acc += Math.max(1, s.duration_bars);
    if (modBar < acc) return s;
  }
  return steps[steps.length - 1];
}

/** Pick a scale-pool index for the current step, using the accent-gate rule. */
export function pickToneForStep(step: ProgressionStep): number {
  const useAccent = Math.random() < ACCENT_PROBABILITY && step.accent_tones.length > 0;
  const pool = useAccent ? step.accent_tones : step.chord_tones;
  if (pool.length === 0) return 0;
  return pool[Math.floor(Math.random() * pool.length)];
}