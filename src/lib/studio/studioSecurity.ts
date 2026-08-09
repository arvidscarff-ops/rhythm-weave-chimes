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
