import { useEffect, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminPasscode } from "@/lib/admin/gate.functions";
import { PasscodeKeypad } from "./PasscodeKeypad";

/**
 * Subtle admin entry point:
 *   - Tiny glowing dot in the bottom-right corner (nearly invisible until hover).
 *   - Global keyboard shortcut: Ctrl/Cmd + . opens the keypad from anywhere.
 * On correct passcode, stashes it in-memory and navigates to /admin/packs.
 */
export function AdminTrigger() {
  const router = useRouter();
  const verify = useServerFn(verifyAdminPasscode);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        setError(false);
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function onSubmit(code: string) {
    setError(false);
    try {
      const { ok } = await verify({ data: { passcode: code } });
      if (!ok) {
        setError(true);
        return false;
      }
      (window as unknown as { __phaseAdminPass?: string }).__phaseAdminPass = code;
      setOpen(false);
      await router.navigate({ to: "/admin/packs" });
      return true;
    } catch {
      setError(true);
      return false;
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Admin"
        title="Admin (⌘/Ctrl + .)"
        onClick={() => {
          setError(false);
          setOpen(true);
        }}
        className="fixed bottom-3 right-3 z-40 h-2.5 w-2.5 rounded-full bg-white/10 opacity-30 shadow-[0_0_10px_rgba(255,255,255,0.15)] transition-all duration-500 hover:h-3 hover:w-3 hover:bg-white/70 hover:opacity-100 hover:shadow-[0_0_18px_rgba(180,120,255,0.75)]"
      />
      <PasscodeKeypad
        open={open}
        error={error}
        onErrorClear={() => setError(false)}
        onSubmit={onSubmit}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}