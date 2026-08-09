export type StudioRoleLookupResult = {
  role: string | null | undefined;
  lookupFailed?: boolean;
};

export type StudioRoleLookup = (userId: string) => Promise<StudioRoleLookupResult>;

export function assertStudioAdminRole(
  role: string | null | undefined,
  lookupFailed = false,
): asserts role is "admin" {
  if (lookupFailed || role !== "admin") {
    throw new Error("Forbidden: My Studio requires an administrator account");
  }
}

/**
 * Pure, fail-closed authorization policy used by the Studio middleware.
 * The supplied lookup must read the authenticated user's own database role.
 */
export async function authorizeStudioAdmin(
  userId: string | null | undefined,
  lookup: StudioRoleLookup,
): Promise<string> {
  if (!userId) {
    throw new Error("Unauthorized: My Studio requires an authenticated account");
  }

  const result = await lookup(userId);
  assertStudioAdminRole(result.role, result.lookupFailed === true);
  return userId;
}

export function validateStudioAssetPath(path: string): string {
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
    throw new Error("Invalid Studio asset path");
  }
  return normalized;
}

export function validateSceneAssetPath(path: string): string {
  return validateStudioAssetPath(path);
}

export function validateSceneMediaPath(path: string): string {
  return validateAssetExtension(
    validateStudioAssetPath(path),
    ["avif", "gif", "jpeg", "jpg", "mp4", "png", "webm", "webp"],
    "scene media",
  );
}

export function validatePackAssetPath(bucket: "pack-covers" | "samples", path: string): string {
  const safePath = validateStudioAssetPath(path);
  return bucket === "samples"
    ? validateAssetExtension(safePath, ["wav"], "sample")
    : validateAssetExtension(safePath, ["avif", "gif", "jpeg", "jpg", "png", "webp"], "pack cover");
}

function validateAssetExtension(
  path: string,
  allowedExtensions: string[],
  category: string,
): string {
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`Unsupported ${category} file type`);
  }
  return path;
}
