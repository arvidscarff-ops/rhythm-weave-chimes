import type { SceneRow } from "@/lib/admin/scenes.functions";

/**
 * Client-side registry for the currently-selected published scene.
 *
 * The <SceneBackground /> layer subscribes here; the dock's Backdrop menu
 * writes here. Selection persists across reloads via localStorage.
 */

const STORAGE_KEY = "phase:activeSceneId";

let current: SceneRow | null = null;
const subs = new Set<(s: SceneRow | null) => void>();

export function getActiveScene(): SceneRow | null {
  return current;
}

export function setActiveScene(s: SceneRow | null): void {
  current = s;
  try {
    if (s) localStorage.setItem(STORAGE_KEY, s.id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private-browsing fallback */
  }
  for (const fn of subs) fn(s);
}

export function subscribeActiveScene(fn: (s: SceneRow | null) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function loadPersistedSceneId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}