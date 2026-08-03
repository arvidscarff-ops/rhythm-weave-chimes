/// <reference types="node" />

import assert from "node:assert/strict";
import test from "node:test";
import { assertStudioAdminRole, validateSceneAssetPath } from "./studioSecurity.ts";

test("Studio access accepts only a confirmed administrator role", () => {
  assert.doesNotThrow(() => assertStudioAdminRole("admin"));
  assert.throws(() => assertStudioAdminRole("user"), /administrator account/);
  assert.throws(() => assertStudioAdminRole(null), /administrator account/);
  assert.throws(() => assertStudioAdminRole("admin", true), /administrator account/);
});

test("scene asset paths remain relative and traversal-free", () => {
  assert.equal(
    validateSceneAssetPath(" 2f90e418-2f5b-4dc6-8879-b122f8c85661/1700000000.png "),
    "2f90e418-2f5b-4dc6-8879-b122f8c85661/1700000000.png",
  );
  for (const invalid of ["", "/private.png", "../private.png", "scene/../private.png", "a//b"]) {
    assert.throws(() => validateSceneAssetPath(invalid), /Invalid scene asset path/);
  }
});
