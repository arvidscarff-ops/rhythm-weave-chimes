import { describe, expect, it, vi } from "vitest";

import { authorizeStudioAdmin } from "./studioSecurity";

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
});
