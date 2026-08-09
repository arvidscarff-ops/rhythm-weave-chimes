import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_BLUEPRINT } from "@/lib/engine/pathTransformer";
import { getActiveBlueprint, setActiveBlueprint, setPreviewBlueprint } from "./activeBlueprint";

describe("legacy Builder preview quarantine", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("never persists a temporary preview as production runtime state", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });

    const production = { ...DEFAULT_BLUEPRINT, name: "Persisted production value" };
    const preview = { ...DEFAULT_BLUEPRINT, name: "Temporary Studio preview" };

    setActiveBlueprint(production);
    expect(getActiveBlueprint().name).toBe("Persisted production value");
    const persistedBeforePreview = [...values.values()];
    setPreviewBlueprint(preview);

    expect(getActiveBlueprint().name).toBe("Temporary Studio preview");
    expect([...values.values()]).toEqual(persistedBeforePreview);

    setPreviewBlueprint(production);
    expect(getActiveBlueprint().name).toBe("Persisted production value");
    expect([...values.values()]).toEqual(persistedBeforePreview);
  });
});
