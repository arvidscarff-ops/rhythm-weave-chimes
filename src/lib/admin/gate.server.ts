import { createHash, timingSafeEqual } from "node:crypto";

export function matches(input: string, expected: string) {
  const a = createHash("sha256").update(input ?? "", "utf8").digest();
  const b = createHash("sha256").update(expected ?? "", "utf8").digest();
  return timingSafeEqual(a, b);
}

export function assertPasscode(passcode: string | undefined | null) {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) throw new Error("ADMIN_PASSCODE not configured");
  if (typeof passcode !== "string" || passcode.length === 0 || !matches(passcode, expected)) {
    throw new Error("Unauthorized");
  }
}