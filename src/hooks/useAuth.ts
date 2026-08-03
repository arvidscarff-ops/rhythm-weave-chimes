import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(true);
  const userId = session?.user.id;

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
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
    setRoleLoading(true);
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (active) {
          setIsAdmin(!error && !!data);
          setRoleLoading(false);
        }
      } catch {
        if (active) {
          setIsAdmin(false);
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
  };
}
