import { describe, expect, it } from "vitest";

import { shouldApplyCsrfProtection } from "./csrf";

describe("CSRF request scope", () => {
  it("protects server-function requests", () => {
    expect(shouldApplyCsrfProtection({ handlerType: "serverFn" })).toBe(true);
  });

  it("does not apply the server-function filter to document rendering", () => {
    expect(shouldApplyCsrfProtection({ handlerType: "ssr" })).toBe(false);
  });
});
