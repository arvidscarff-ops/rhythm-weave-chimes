import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setStatus("Account created. You can sign in now.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6" style={{ background: "var(--pr-bg-grad)" }}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm p-8 rounded-2xl"
        style={{
          background: "rgba(10,14,18,0.42)",
          backdropFilter: "blur(22px)",
          WebkitBackdropFilter: "blur(22px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="pr-label text-white/55 mb-6">PHASE® / {mode === "signup" ? "CREATE OWNER" : "SIGN IN"}</div>

        <label className="pr-label text-white/45 block mb-1">EMAIL</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border-b border-white/15 py-2 mb-5 text-sm text-white/90 focus:outline-none focus:border-white/40"
        />

        <label className="pr-label text-white/45 block mb-1">PASSWORD</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b border-white/15 py-2 mb-6 text-sm text-white/90 focus:outline-none focus:border-white/40"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-md pr-label text-white/90 transition disabled:opacity-50"
          style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          {loading ? "…" : mode === "signup" ? "CREATE ACCOUNT" : "ENTER"}
        </button>

        {status && <div className="pr-label text-white/55 mt-4">{status}</div>}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
            className="pr-label text-white/40 hover:text-white/70"
          >
            {mode === "signup" ? "HAVE AN ACCOUNT? SIGN IN" : "FIRST TIME? CREATE OWNER"}
          </button>
          <Link to="/" className="pr-label text-white/40 hover:text-white/70">← BACK</Link>
        </div>
      </form>
    </main>
  );
}