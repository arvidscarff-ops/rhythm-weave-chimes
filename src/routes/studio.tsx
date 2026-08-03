import { createFileRoute, Link, Outlet, useLocation, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { ChevronLeft, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/studio")({
  ssr: false,
  component: StudioLayout,
  head: () => ({
    meta: [
      { title: "My Studio · Phase" },
      {
        name: "description",
        content: "Phase creator workspace — sound packs, scales, and progressions.",
      },
    ],
  }),
});

function StudioLayout() {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      void router.navigate({ to: "/auth" });
    }
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-foreground">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-foreground/45">
          Verifying Studio access…
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-foreground">
        <section className="max-w-md border border-white/10 bg-white/[0.03] p-8 text-center">
          <ShieldAlert className="mx-auto h-6 w-6 text-foreground/55" />
          <h1 className="mt-4 text-lg">My Studio is private</h1>
          <p className="mt-2 text-sm leading-relaxed text-foreground/55">
            This account is authenticated but does not have the administrator role required for the
            owner/developer workspace.
          </p>
          <Button asChild variant="secondary" className="mt-6">
            <Link to="/" search={{ shell: "reset" }}>
              Return to instrument
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  return <Shell accountLabel={user.email ?? "Administrator"} />;
}

function Shell({ accountLabel }: { accountLabel: string }) {
  const router = useRouter();
  const pathname = useLocation({ select: (l) => l.pathname });
  const tabs = [
    { to: "/studio/packs", label: "Packs" },
    { to: "/studio/scales", label: "Scales" },
    { to: "/studio/scenes", label: "Scenes" },
    { to: "/studio/builder", label: "Builder" },
  ] as const;
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs uppercase tracking-[0.18em] text-foreground/60 hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="text-base font-medium tracking-wide">My Studio</h1>
          <nav className="ml-4 flex gap-1 text-[11px] uppercase tracking-[0.18em]">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`rounded-md px-3 py-1.5 transition ${
                    active
                      ? "bg-white/10 text-foreground"
                      : "text-foreground/55 hover:text-foreground"
                  }`}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden max-w-52 truncate font-mono text-[9px] uppercase tracking-[0.16em] text-foreground/35 sm:block">
            {accountLabel}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              await supabase.auth.signOut();
              void router.navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-3 w-3" /> Sign out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}
