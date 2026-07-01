import { createServerFn } from "@tanstack/react-start";

export const isAdminUnlocked = createServerFn({ method: "GET" }).handler(async () => {
  const { getGateSession } = await import("./gate.server");
  const session = await getGateSession();
  return { unlocked: !!session.data.unlocked };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((data: { passcode: string }) => data)
  .handler(async ({ data }) => {
    const { getGateSession, matches } = await import("./gate.server");
    const expected = process.env.ADMIN_PASSCODE;
    if (!expected) throw new Error("ADMIN_PASSCODE not configured");
    if (typeof data.passcode !== "string" || data.passcode.length === 0) {
      return { ok: false as const };
    }
    if (!matches(data.passcode, expected)) return { ok: false as const };
    const session = await getGateSession();
    await session.update({ unlocked: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { getGateSession } = await import("./gate.server");
  const session = await getGateSession();
  await session.clear();
  return { ok: true as const };
});