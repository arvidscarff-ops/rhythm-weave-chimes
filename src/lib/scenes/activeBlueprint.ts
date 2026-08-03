/**
 * Runtime slot for the "custom" scene's active blueprint.
 * The Scene Builder writes here (via a Load / Publish action); the
 * customScene runtime reads it on every frame. Kept out of React state
 * so hot changes don't force a full render loop rebuild.
 */

import type { CustomSceneBlueprint } from "@/lib/engine/pathTransformer";
import { DEFAULT_BLUEPRINT, validateBlueprint } from "@/lib/engine/pathTransformer";

const STORAGE_KEY = "phase:activeBlueprint.v1";

let current: CustomSceneBlueprint = DEFAULT_BLUEPRINT;
const subs = new Set<(bp: CustomSceneBlueprint) => void>();

let hydrated = false;
function hydrate() {
  if (hydrated) return;
  hydrated = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const bp = validateBlueprint(JSON.parse(raw));
    if (bp) current = bp;
  } catch {
    /* ignore */
  }
}

export function getActiveBlueprint(): CustomSceneBlueprint {
  hydrate();
  return current;
}

export function setActiveBlueprint(bp: CustomSceneBlueprint): void {
  applyBlueprint(bp, true);
}

/**
 * Temporary, non-persistent override for the quarantined legacy Builder preview.
 * This must never be used as a publication path.
 */
export function setPreviewBlueprint(bp: CustomSceneBlueprint): void {
  applyBlueprint(bp, false);
}

function applyBlueprint(bp: CustomSceneBlueprint, persist: boolean): void {
  current = bp;
  if (persist && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(bp));
    } catch {
      /* ignore */
    }
  }
  for (const fn of subs) fn(bp);
}

export function subscribeActiveBlueprint(
  fn: (bp: CustomSceneBlueprint) => void,
): () => void {
  hydrate();
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
