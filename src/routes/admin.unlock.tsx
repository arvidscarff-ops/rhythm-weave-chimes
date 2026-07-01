import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { unlockAdmin } from "@/lib/admin/gate.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/unlock")({
  ssr: false,
  component: UnlockPage,
});

function UnlockPage() {
  const router = useRouter();
  const unlock = useServerFn(unlockAdmin);
  const [passcode, setPasscode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await unlock({ data: { passcode } });
      if (res.ok) {
        await router.navigate({ to: "/admin/packs" });
      } else {
        setErr("Incorrect passcode.");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Unlock failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-950/60 p-6 shadow-xl backdrop-blur"
      >
        <h1 className="text-lg font-medium tracking-wide text-foreground">Admin unlock</h1>
        <p className="mt-1 text-xs text-foreground/60">
          Enter the admin passcode to manage sound packs.
        </p>
        <div className="mt-6 space-y-2">
          <Label htmlFor="pass">Passcode</Label>
          <Input
            id="pass"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoFocus
          />
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <Button type="submit" className="mt-6 w-full" disabled={busy || !passcode}>
          {busy ? "Checking…" : "Unlock"}
        </Button>
      </form>
    </div>
  );
}