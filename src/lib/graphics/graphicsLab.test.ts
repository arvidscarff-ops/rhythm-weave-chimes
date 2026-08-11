import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceDecorativeVisualTime,
  deterministicUnit,
  resolveGraphicsLabBudget,
  validateGraphicsAssetRecord,
} from "./graphicsLab.ts";

test("graphics budgets reduce decorative work without changing semantic state", () => {
  const full = resolveGraphicsLabBudget({
    width: 1280,
    height: 720,
    devicePixelRatio: 1,
    quality: "auto",
    reducedMotion: false,
  });
  const reduced = resolveGraphicsLabBudget({
    width: 1280,
    height: 720,
    devicePixelRatio: 1,
    quality: "auto",
    reducedMotion: true,
  });

  assert.equal(full.renderScale, 1);
  assert.ok(reduced.renderScale < full.renderScale);
  assert.ok(reduced.cloudLayers < full.cloudLayers);
  assert.ok(reduced.particleCount < full.particleCount);
});

test("large high-density viewports select a constrained budget", () => {
  const budget = resolveGraphicsLabBudget({
    width: 2560,
    height: 1440,
    devicePixelRatio: 2,
    quality: "auto",
    reducedMotion: false,
  });

  assert.equal(budget.renderScale, 0.7);
  assert.equal(budget.particleCount, 36);
});

test("hidden-tab gaps cannot fast-forward decorative motion", () => {
  assert.equal(advanceDecorativeVisualTime(12, 90 * 60 * 1000, false), 12.05);
  assert.equal(advanceDecorativeVisualTime(12, 16.67, true), 12);
});

test("third-party asset records require provenance and distribution approval", () => {
  assert.deepEqual(
    validateGraphicsAssetRecord({
      id: "cloud-volume",
      sourceType: "open-source",
      author: "",
      licenseId: "",
      sourceUrl: null,
      attribution: "",
      approvedForDistribution: false,
    }),
    [
      "Asset author is required.",
      "A license identifier is required.",
      "Third-party assets require a source URL.",
      "Asset is not approved for distribution.",
    ],
  );

  assert.deepEqual(
    validateGraphicsAssetRecord({
      id: "procedural-sky",
      sourceType: "project-authored",
      author: "PHASE",
      licenseId: "PROJECT-AUTHORED",
      sourceUrl: null,
      attribution: "Generated in the R7 graphics laboratory.",
      approvedForDistribution: true,
    }),
    [],
  );
});

test("decorative seeds are deterministic and locally scoped", () => {
  const first = Array.from({ length: 8 }, (_, index) => deterministicUnit(0x50484153, index));
  const second = Array.from({ length: 8 }, (_, index) => deterministicUnit(0x50484153, index));

  assert.deepEqual(first, second);
  assert.equal(new Set(first).size, first.length);
  assert.ok(first.every((value) => value >= 0 && value < 1));
});
