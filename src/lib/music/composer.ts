/**
 * Generative composer: Euclidean rhythm gating + in-scale note picking.
 *
 * Used by every scene (wheel / pendulum / bars). A "trigger event" from
 * a scene calls composerAdvance({ sourceId, slot }) which:
 *   1. advances that source's step counter,
 *   2. checks the Euclidean pattern for the slot,
 *   3. if a hit, picks the next scale degree per `noteMode` and
 *      returns a frequency.
 *
 * Settings are global and persist in localStorage; subscribers are
 * notified on change (mirrors the neural settings module).
 */

import { degreeToFreq, type ScaleId, type RootName, SCALES } from "./scales";
import { euclid } from "./euclidean";

export type NoteMode = "sequential" | "random" | "arpeggio" | "brownian";

export type SlotSettings = {
  k: number;            // Euclidean hits
  n: number;            // Euclidean steps
  rotation: number;     // 0..n-1
  octaveLow: number;    // inclusive
  octaveHigh: number;   // inclusive
  noteMode: NoteMode;
  gain: number;         // 0..1 per-slot trim (reserved)
};

export type ComposerSettings = {
  enabled: boolean;
  root: RootName;
  scale: ScaleId;
  slots: SlotSettings[]; // length 6
};

const STORAGE_KEY = "phase.composer.v1";

const DEFAULT_SLOTS: SlotSettings[] = [
  { k: 3, n: 8,  rotation: 0, octaveLow: 3, octaveHigh: 4, noteMode: "sequential", gain: 1 },
  { k: 5, n: 8,  rotation: 2, octaveLow: 4, octaveHigh: 5, noteMode: "random",     gain: 1 },
  { k: 2, n: 5,  rotation: 0, octaveLow: 2, octaveHigh: 3, noteMode: "arpeggio",   gain: 1 },
  { k: 3, n: 7,  rotation: 1, octaveLow: 3, octaveHigh: 5, noteMode: "brownian",   gain: 1 },
  { k: 4, n: 9,  rotation: 0, octaveLow: 4, octaveHigh: 5, noteMode: "sequential", gain: 1 },
  { k: 5, n: 12, rotation: 3, octaveLow: 2, octaveHigh: 4, noteMode: "random",     gain: 1 },
];

export const DEFAULT_COMPOSER: ComposerSettings = {
  enabled: true,
  root: "A",
  scale: "pentaMin",
  slots: DEFAULT_SLOTS,
};

let current: ComposerSettings = DEFAULT_COMPOSER;
const listeners = new Set<(s: ComposerSettings) => void>();

// Per-source state.
type SourceState = {
  step: number;
  cursor: number;     // current scale degree (sequential / brownian)
  arpIdx: number;     // 0..2 for arpeggio (1-3-5)
  patternKey: string; // invalidate when k/n/rot changes
  pattern: boolean[];
};
const sources = new Map<string, SourceState>();

function patternKey(s: SlotSettings) {
  return `${s.k}/${s.n}@${s.rotation}`;
}

function getSlot(slot: number): SlotSettings {
  const idx = ((slot % current.slots.length) + current.slots.length) % current.slots.length;
  return current.slots[idx];
}

export function loadComposerSettings(): ComposerSettings {
  if (typeof window === "undefined") return DEFAULT_COMPOSER;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMPOSER;
    const parsed = JSON.parse(raw) as Partial<ComposerSettings>;
    const merged: ComposerSettings = {
      enabled: parsed.enabled ?? DEFAULT_COMPOSER.enabled,
      root: (parsed.root as RootName) ?? DEFAULT_COMPOSER.root,
      scale: (parsed.scale as ScaleId) ?? DEFAULT_COMPOSER.scale,
      slots: Array.isArray(parsed.slots) && parsed.slots.length === 6
        ? (parsed.slots as SlotSettings[])
        : DEFAULT_SLOTS,
    };
    current = merged;
    return merged;
  } catch {
    return DEFAULT_COMPOSER;
  }
}

export function saveComposerSettings(s: ComposerSettings) {
  current = s;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {}
  }
  listeners.forEach((l) => l(s));
}

export function subscribeComposer(fn: (s: ComposerSettings) => void) {
  listeners.add(fn);
  fn(current);
  return () => { listeners.delete(fn); };
}

export function getComposer(): ComposerSettings {
  return current;
}

/** Drop all source step counters (e.g. on Stop). */
export function resetComposerSources() {
  sources.clear();
}

function ensureSource(sourceId: string, slot: SlotSettings): SourceState {
  let st = sources.get(sourceId);
  const key = patternKey(slot);
  if (!st) {
    st = { step: -1, cursor: 0, arpIdx: 0, patternKey: key, pattern: euclid(slot.k, slot.n, slot.rotation) };
    sources.set(sourceId, st);
  } else if (st.patternKey !== key) {
    st.patternKey = key;
    st.pattern = euclid(slot.k, slot.n, slot.rotation);
    st.step = -1;
  }
  return st;
}

function pickDegree(slot: SlotSettings, st: SourceState): { degree: number; octave: number } {
  const scaleLen = SCALES[current.scale].intervals.length;
  const octSpan = Math.max(0, slot.octaveHigh - slot.octaveLow);
  const range = scaleLen * (octSpan + 1); // total in-range degrees

  let deg: number;
  switch (slot.noteMode) {
    case "random":
      deg = Math.floor(Math.random() * range);
      st.cursor = deg;
      break;
    case "arpeggio": {
      // 1-3-5 of the scale, climbing one octave at a time
      const triad = [0, 2, 4];
      const t = triad[st.arpIdx % 3];
      const oct = Math.floor(st.arpIdx / 3) % (octSpan + 1);
      st.arpIdx = (st.arpIdx + 1) % (3 * (octSpan + 1));
      deg = t + oct * scaleLen;
      st.cursor = deg;
      break;
    }
    case "brownian": {
      const stepDelta = (Math.floor(Math.random() * 5) - 2); // -2..+2
      let next = st.cursor + stepDelta;
      if (next < 0) next = 0;
      if (next >= range) next = range - 1;
      st.cursor = next;
      deg = next;
      break;
    }
    case "sequential":
    default:
      deg = st.cursor % range;
      st.cursor = (st.cursor + 1) % range;
      break;
  }

  const octave = slot.octaveLow + Math.floor(deg / scaleLen);
  const degInScale = deg % scaleLen;
  return { degree: degInScale, octave };
}

/**
 * Advance a source by one step. Returns whether to play and at what freq.
 * If composer is disabled, always plays with `fallbackFreq`.
 */
export function composerAdvance(
  sourceId: string,
  slot: number,
  fallbackFreq: number,
): { play: boolean; freq: number } {
  if (!current.enabled) return { play: true, freq: fallbackFreq };

  const s = getSlot(slot);
  const st = ensureSource(sourceId, s);
  st.step = (st.step + 1) % s.n;
  const hit = st.pattern[st.step];
  if (!hit) return { play: false, freq: fallbackFreq };

  const { degree, octave } = pickDegree(s, st);
  const freq = degreeToFreq(current.root, current.scale, degree, octave);
  return { play: true, freq };
}

/** Public helper for UI previews. */
export function patternFor(slot: SlotSettings): boolean[] {
  return euclid(slot.k, slot.n, slot.rotation);
}