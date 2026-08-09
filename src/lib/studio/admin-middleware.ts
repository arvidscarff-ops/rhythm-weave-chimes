import { createMiddleware } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { authorizeStudioAdmin } from "./studioSecurity";

/**
 * Private My Studio authorization boundary.
 *
 * The bearer-token session proves identity. The database remains the source
 * of truth for the admin role, and its RLS policy only exposes a user's own
 * role rows. Server functions may reach the service-role client only after
 * both checks succeed.
 */
export const requireStudioAdmin = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const studioAdminUserId = await authorizeStudioAdmin(context.userId, async (userId) => {
      const { data, error } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();

      return { role: data?.role, lookupFailed: error != null };
    });

    return next({ context: { studioAdminUserId } });
  });
