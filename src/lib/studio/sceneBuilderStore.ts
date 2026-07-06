/**
 * LocalStorage CRUD for Scene Builder presets.
 * Presets are user-owned JSON blueprints; the active one drives
 * the "custom" scene runtime via `activeBlueprint`.
 */

import type { CustomSceneBlueprint } from "@/lib/engine/pathTransformer";
import { DEFAULT_BLUEPRINT, validateBlueprint } from "@/lib/engine/pathTransformer";

const STORAGE_KEY = "sceneBuilder.presets.v1";

export type StoredPreset = {
  id: string;
  updatedAt: number;
  blueprint: CustomSceneBlueprint;
};

export type PresetMap = Record<string, StoredPreset>;

function safeParse(raw: string | null): PresetMap {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw);
    if (!obj || typeof obj !== "object") return {};
    const out: PresetMap = {};
    for (const [id, val] of Object.entries(obj)) {
      const v = val as { updatedAt?: number; blueprint?: unknown };
      const bp = validateBlueprint(v?.blueprint);
      if (bp) {
        out[id] = {
          id,
          updatedAt: typeof v.updatedAt === "number" ? v.updatedAt : Date.now(),
          blueprint: bp,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function loadPresets(): PresetMap {
  if (typeof window === "undefined") return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeAll(map: PresetMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota — silently ignore */
  }
}

export function savePreset(id: string, blueprint: CustomSceneBlueprint): StoredPreset {
  const all = loadPresets();
  const entry: StoredPreset = { id, updatedAt: Date.now(), blueprint };
  all[id] = entry;
  writeAll(all);
  return entry;
}

export function deletePreset(id: string): void {
  const all = loadPresets();
  delete all[id];
  writeAll(all);
}

export function newPresetId(): string {
  return `bp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function newBlueprint(name = "Untitled"): CustomSceneBlueprint {
  return { ...DEFAULT_BLUEPRINT, name };
}

export function importJson(text: string): CustomSceneBlueprint | null {
  try {
    return validateBlueprint(JSON.parse(text));
  } catch {
    return null;
  }
}

export function exportJson(bp: CustomSceneBlueprint): string {
  return JSON.stringify(bp, null, 2);
}

/** Download a blueprint as a .json file (browser only). */
export function downloadBlueprintFile(bp: CustomSceneBlueprint): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([exportJson(bp)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(bp.name || "preset").replace(/[^a-z0-9-_]+/gi, "_")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Read a File selected via <input type="file"> and validate it. */
export function readBlueprintFile(file: File): Promise<CustomSceneBlueprint | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => {
      const text = typeof r.result === "string" ? r.result : "";
      resolve(importJson(text));
    };
    r.onerror = () => resolve(null);
    r.readAsText(file);
  });
}