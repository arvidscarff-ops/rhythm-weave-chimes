import { createFileRoute, Link, Outlet, useRouter, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ChevronLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PasscodeProvider, usePasscode } from "@/lib/admin/passcode-context";

export const Route = createFileRoute("/studio")({
  ssr: false,
  component: StudioLayout,
  head: () => ({
    meta: [
      { title: "My Studio · Phase" },
      { name: "description", content: "Phase creator workspace — sound packs, scales, and progressions." },
    ],
  }),
});

function StudioLayout() {
  return (
    <PasscodeProvider>
      <Gate />
    </PasscodeProvider>
  );
}

function Gate() {
  const { ensure, get, set } = usePasscode();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const w = window as unknown as { __phaseAdminPass?: string };
    if (w.__phaseAdminPass) {
      set(w.__phaseAdminPass);
      w.__phaseAdminPass = undefined;
    }
    if (get()) {
      setReady(true);
      return;
    }
    ensure()
      .then(() => setReady(true))
      .catch(() => {
        void router.navigate({ to: "/" });
      });
  }, [ensure, get, router, set]);

  if (!ready) return null;
  return <Shell />;
}

function Shell() {
  const { clear } = usePasscode();
  const router = useRouter();
  const pathname = useLocation({ select: (l) => l.pathname });
  const tabs = [
    { to: "/studio/packs", label: "Packs" },
    { to: "/studio/scales", label: "Scales" },
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            clear();
            void router.navigate({ to: "/" });
          }}
        >
          <Lock className="h-3 w-3 mr-2" /> Lock
        </Button>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  );
}