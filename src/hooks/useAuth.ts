import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id;

  useEffect(() => {
    let active = true;
    void supabase.auth
      .getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        setSession(sessionError ? null : data.session);
        setIsAdmin(false);
        setRoleLoading(sessionError ? false : Boolean(data.session?.user));
        setError(sessionError ? "Unable to verify the current account session." : null);
        setSessionLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setIsAdmin(false);
        setRoleLoading(false);
        setError("Unable to verify the current account session.");
        setSessionLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setIsAdmin(false);
      setRoleLoading(Boolean(s?.user));
      setError(null);
      setSessionLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setRoleLoading(false);
      return;
    }
    let active = true;
    setIsAdmin(false);
    setRoleLoading(true);
    void (async () => {
      try {
        const { data, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (active) {
          setIsAdmin(!roleError && data?.role === "admin");
          setError(roleError ? "Unable to verify My Studio authorization." : null);
          setRoleLoading(false);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
          setError("Unable to verify My Studio authorization.");
          setRoleLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return {
    session,
    user: session?.user ?? null,
    isAdmin,
    loading: sessionLoading || roleLoading,
    error,
  };
}
