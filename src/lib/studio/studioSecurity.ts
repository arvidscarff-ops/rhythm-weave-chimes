export function assertStudioAdminRole(
  role: string | null | undefined,
  lookupFailed = false,
): asserts role is "admin" {
  if (lookupFailed || role !== "admin") {
    throw new Error("Forbidden: My Studio requires an administrator account");
  }
}

export function validateSceneAssetPath(path: string): string {
  const normalized = path.trim();
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.length > 512 ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    normalized.includes("\0") ||
    segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")
  ) {
    throw new Error("Invalid scene asset path");
  }
  return normalized;
}
