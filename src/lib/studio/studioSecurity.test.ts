import { describe, expect, it, vi } from "vitest";

import {
  authorizeStudioAdmin,
  validatePackAssetPath,
  validateSceneAssetPath,
  validateSceneMediaPath,
} from "./studioSecurity";

describe("Studio administrator authorization", () => {
  it("rejects an anonymous request without consulting roles", async () => {
    const lookup = vi.fn();

    await expect(authorizeStudioAdmin(null, lookup)).rejects.toThrow(/authenticated account/);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects an authenticated non-administrator", async () => {
    await expect(authorizeStudioAdmin("user-1", async () => ({ role: "user" }))).rejects.toThrow(
      /administrator account/,
    );
  });

  it("accepts only a verified administrator role", async () => {
    await expect(authorizeStudioAdmin("admin-1", async () => ({ role: "admin" }))).resolves.toBe(
      "admin-1",
    );
  });

  it("fails closed when the role lookup fails", async () => {
    await expect(
      authorizeStudioAdmin("admin-1", async () => ({
        role: "admin",
        lookupFailed: true,
      })),
    ).rejects.toThrow(/administrator account/);
  });

  it("keeps Studio paths relative and traversal-free", () => {
    expect(validateSceneAssetPath(" scene-a/background.webp ")).toBe("scene-a/background.webp");
    for (const invalid of ["", "/private.png", "../private.png", "scene/../private.png", "a//b"]) {
      expect(() => validateSceneAssetPath(invalid)).toThrow(/Invalid Studio asset path/);
    }
  });

  it("allows only the supported media category for each upload boundary", () => {
    expect(validatePackAssetPath("samples", "pack-a/low-bowl.wav")).toBe("pack-a/low-bowl.wav");
    expect(validatePackAssetPath("pack-covers", "pack-a/cover.webp")).toBe("pack-a/cover.webp");
    expect(validateSceneMediaPath("scene-a/background.webm")).toBe("scene-a/background.webm");
    expect(() => validatePackAssetPath("samples", "pack-a/not-a-sample.png")).toThrow(
      /Unsupported sample file type/,
    );
    expect(() => validatePackAssetPath("pack-covers", "pack-a/cover.svg")).toThrow(
      /Unsupported pack cover file type/,
    );
    expect(() => validateSceneMediaPath("scene-a/background.html")).toThrow(
      /Unsupported scene media file type/,
    );
  });
});
