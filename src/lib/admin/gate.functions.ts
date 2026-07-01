import { createServerFn } from "@tanstack/react-start";

export const verifyAdminPasscode = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { matches } = await import("./gate.server");
    const expected = process.env.ADMIN_PASSCODE;
    if (!expected) throw new Error("ADMIN_PASSCODE not configured");
    if (typeof data.passcode !== "string" || data.passcode.length === 0) {
      return { ok: false as const };
    }
    return { ok: matches(data.passcode, expected) };
  });