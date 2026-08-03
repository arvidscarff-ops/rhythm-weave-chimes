import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertStudioAdminRole } from "./studioSecurity";

/**
 * Private My Studio authorization boundary.
 *
 * The browser session proves identity. The database remains the source of
 * truth for the admin role, and its RLS policy only exposes a user's own role
 * rows. Admin server functions may use the service-role client only after this
 * middleware succeeds.
 */
export const requireStudioAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    assertStudioAdminRole(data?.role, error != null);

    return next({
      context: {
        studioAdminUserId: context.userId,
      },
    });
  });
