/**
 * Phase-Alignment macro-cycle dock override.
 *
 * Persists the user's live overrides for base laps, macro-cycle
 * duration, and note count in `localStorage` and pushes updates to
 * subscribers so the render loop / dock UI stay in sync. `null` slots
 * mean "use the active scene's default" (which itself falls back to
 * the built-in defaults if no scene is published/active).
 */

const STORAGE_KEY = "phase:cycleOverride";

export type CycleOverride = {
  baseLaps: number | null;
  macroCycleSeconds: number | null;
  noteCount: number | null;
};

const EMPTY: CycleOverride = { baseLaps: null, macroCycleSeconds: null, noteCount: null };

let current: CycleOverride = { ...EMPTY };
const subs = new Set<(o: CycleOverride) => void>();

export function loadCycleOverride(): CycleOverride {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<CycleOverride>;
    current = {
      baseLaps: typeof parsed.baseLaps === "number" ? parsed.baseLaps : null,
      macroCycleSeconds:
        typeof parsed.macroCycleSeconds === "number" ? parsed.macroCycleSeconds : null,
      noteCount: typeof parsed.noteCount === "number" ? parsed.noteCount : null,
    };
    return current;
  } catch {
    return { ...EMPTY };
  }
}

export function saveCycleOverride(next: CycleOverride): void {
  current = { ...next };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  for (const fn of subs) fn(current);
}

export function getCycleOverride(): CycleOverride {
  return current;
}

export function subscribeCycleOverride(fn: (o: CycleOverride) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function clearCycleOverride(): void {
  saveCycleOverride({ ...EMPTY });
}