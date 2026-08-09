import { describe, expect, it } from "vitest";
import {
  DEFAULT_LEGACY_RHYTHM_SCENE,
  DEFAULT_PRODUCTION_RHYTHM_SCENE,
  LEGACY_RHYTHM_SCENE_IDS,
  PRODUCTION_RHYTHM_SCENE_IDS,
  isRhythmSceneAllowed,
  resolveRhythmSceneAccess,
} from "./rhythmSceneAccess";

describe("rhythm scene quarantine", () => {
  it("rejects every legacy engine from production access", () => {
    for (const scene of LEGACY_RHYTHM_SCENE_IDS) {
      expect(isRhythmSceneAllowed(scene, "production")).toBe(false);
      expect(resolveRhythmSceneAccess(scene, "production")).toBe(DEFAULT_PRODUCTION_RHYTHM_SCENE);
    }
  });

  it("allows every legacy engine inside legacy access", () => {
    for (const scene of LEGACY_RHYTHM_SCENE_IDS) {
      expect(isRhythmSceneAllowed(scene, "legacy")).toBe(true);
      expect(resolveRhythmSceneAccess(scene, "legacy")).toBe(scene);
    }
  });

  it("allows production scenes only in production access", () => {
    for (const scene of PRODUCTION_RHYTHM_SCENE_IDS) {
      expect(isRhythmSceneAllowed(scene, "production")).toBe(true);
      expect(resolveRhythmSceneAccess(scene, "production")).toBe(scene);
      expect(resolveRhythmSceneAccess(scene, "legacy")).toBe(DEFAULT_LEGACY_RHYTHM_SCENE);
    }
  });

  it("falls back safely for unknown restored scene identifiers", () => {
    expect(resolveRhythmSceneAccess("unknown", "production")).toBe(DEFAULT_PRODUCTION_RHYTHM_SCENE);
    expect(resolveRhythmSceneAccess("unknown", "legacy")).toBe(DEFAULT_LEGACY_RHYTHM_SCENE);
  });
});
