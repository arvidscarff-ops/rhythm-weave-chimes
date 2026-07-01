import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { verifyAdminPasscode } from "@/lib/admin/gate.functions";
import { PasscodeKeypad } from "@/components/admin/PasscodeKeypad";

export const Route = createFileRoute("/admin/unlock")({
  ssr: false,
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const verify = useServerFn(verifyAdminPasscode);
  const [error, setError] = useState(false);

  async function onSubmit(code: string) {
    setError(false);
    try {
      const { ok } = await verify({ data: { passcode: code } });
      if (!ok) {
        setError(true);
        return false;
      }
      // Stash the verified passcode for the /admin/packs session (in-memory, tab-scoped).
      (window as unknown as { __phaseAdminPass?: string }).__phaseAdminPass = code;
      await router.navigate({ to: "/admin/packs" });
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07070c] text-foreground">
      {/* Ambient hazy backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-1/4 top-1/4 h-[60vmax] w-[60vmax] rounded-full bg-violet-600/25 blur-3xl [animation:haze-drift_38s_ease-in-out_infinite]" />
        <div className="absolute -right-1/4 bottom-0 h-[55vmax] w-[55vmax] rounded-full bg-fuchsia-500/20 blur-3xl [animation:haze-drift_46s_ease-in-out_infinite_reverse]" />
        <div className="absolute left-1/3 top-2/3 h-[40vmax] w-[40vmax] rounded-full bg-sky-500/15 blur-3xl [animation:haze-drift_52s_ease-in-out_infinite]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <PasscodeKeypad
          open
          overlay={false}
          error={error}
          onErrorClear={() => setError(false)}
          onSubmit={onSubmit}
          onCancel={() => router.navigate({ to: "/" })}
        />
        <p className="text-[10px] uppercase tracking-[0.28em] text-white/40">
          Phase · admin gate
        </p>
      </div>
    </div>
  );
}