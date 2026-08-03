import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublicationReady,
  validatePackForPublication,
  validateScaleForPublication,
  validateSceneForPublication,
} from "./studioValidation.ts";

const now = "2026-08-03T12:00:00.000Z";

test("publication validators accept a complete pack, scale, and scene", () => {
  assert.deepEqual(
    validatePackForPublication({
      id: "pack",
      name: "Resonant Metals",
      slug: "resonant-metals",
      description: null,
      is_published: false,
      cover_image_url: null,
      humanization: null,
      updated_at: now,
      slots: [
        {
          id: "slot",
          slot_index: 0,
          label: "Low",
          gain_db: 0,
          pan: 0,
          pitch_offset_semitones: 0,
          humanization: null,
          samples: [
            {
              id: "sample",
              name: "Low bowl",
              storage_path: "pack/sample.wav",
              position: 0,
            },
          ],
        },
      ],
    }),
    [],
  );

  assert.deepEqual(
    validateScaleForPublication({
      id: "scale",
      name: "Five-tone fixture",
      pool_size: 5,
      intervals: [0, 3, 5, 7, 10],
      pitches: ["C3", "D#3", "F3", "G3", "A#3"],
      is_published: false,
      updated_at: now,
      steps: [
        {
          id: "step",
          step_order: 0,
          chord_tones: [0, 2, 4],
          accent_tones: [1, 3],
          duration_bars: 4,
        },
      ],
    }),
    [],
  );

  assert.deepEqual(
    validateSceneForPublication({
      id: "scene",
      name: "Quiet Transit",
      background_type: "image",
      background_path: "scene/background.webp",
      trigger_engine_id: "stringNet",
      ui_theme_colors: {
        nodeGlow: "#7dd3fc",
        wireframe: "#ffffff",
        dockAccent: "#ffffff",
        textAccent: "#ffffff",
      },
      visual_fx: {
        backgroundBlur: 0,
        backgroundGlow: 0.5,
        trailPersistence: 0.12,
      },
      audio_reactive: {
        amplitude: 1,
        scalePulse: true,
        opacityPulse: false,
        blurPulse: false,
        threshold: 0,
      },
      is_published: false,
      updated_at: now,
      base_laps: 10,
      macro_cycle_seconds: 30,
      note_count: 8,
    }),
    [],
  );
});

test("publication validators reject incomplete or unsafe drafts", () => {
  const packIssues = validatePackForPublication({
    id: "pack",
    name: "",
    slug: "empty",
    description: null,
    is_published: false,
    cover_image_url: null,
    humanization: null,
    updated_at: now,
    slots: [],
  });
  assert.deepEqual(
    packIssues.map((entry) => entry.path),
    ["name", "slots"],
  );

  const scaleIssues = validateScaleForPublication({
    id: "scale",
    name: "Broken",
    pool_size: 2,
    intervals: [],
    pitches: ["C3"],
    is_published: false,
    updated_at: now,
    steps: [
      {
        id: "step",
        step_order: 0,
        chord_tones: [2],
        accent_tones: [],
        duration_bars: 0,
      },
    ],
  });
  assert.ok(scaleIssues.some((entry) => entry.path === "pool_size"));
  assert.ok(scaleIssues.some((entry) => entry.path === "steps[0].duration_bars"));
  assert.ok(scaleIssues.some((entry) => entry.path === "steps[0]"));

  const sceneIssues = validateSceneForPublication({
    id: "scene",
    name: "Broken",
    background_type: "image",
    background_path: "../private.webp",
    trigger_engine_id: "stringNet",
    ui_theme_colors: {
      nodeGlow: "blue",
      wireframe: "#ffffff",
      dockAccent: "#ffffff",
      textAccent: "#ffffff",
    },
    visual_fx: {
      backgroundBlur: 80,
      backgroundGlow: 0.5,
      trailPersistence: 0.12,
    },
    audio_reactive: {
      amplitude: 1,
      scalePulse: true,
      opacityPulse: false,
      blurPulse: false,
      threshold: 0,
    },
    is_published: false,
    updated_at: now,
    base_laps: 0,
    macro_cycle_seconds: 1,
    note_count: 30,
  });
  assert.ok(sceneIssues.some((entry) => entry.path === "background_path"));
  assert.ok(sceneIssues.some((entry) => entry.path === "ui_theme_colors.nodeGlow"));
  assert.ok(sceneIssues.some((entry) => entry.path === "visual_fx.backgroundBlur"));
});

test("publication assertion returns actionable validation details", () => {
  assert.throws(
    () =>
      assertPublicationReady("pack", [
        { path: "slots[0].samples", message: "assign at least one audio sample" },
      ]),
    /Cannot publish pack: slots\[0\]\.samples: assign at least one audio sample/,
  );
});
