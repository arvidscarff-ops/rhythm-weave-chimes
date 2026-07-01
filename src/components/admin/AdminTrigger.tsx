import { useEffect } from "react";
import { useRouter } from "@tanstack/react-router";

/**
 * Subtle studio entry point:
 *   - Tiny glowing dot in the bottom-right corner (nearly invisible until hover).
 *   - Global keyboard shortcut: Ctrl/Cmd + . opens My Studio from anywhere.
 * Navigating to /studio triggers its passcode gate.
 */
export function AdminTrigger() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        void router.navigate({ to: "/studio" });
      }
    };
    const onOpen = () => {
      void router.navigate({ to: "/studio" });
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("phase:admin-open", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("phase:admin-open", onOpen);
    };
  }, [router]);

  return (
    <button
      type="button"
      aria-label="My Studio"
      title="My Studio (⌘/Ctrl + .)"
      onClick={() => void router.navigate({ to: "/studio" })}
      className="fixed bottom-3 right-3 z-40 h-2.5 w-2.5 rounded-full bg-white/10 opacity-30 shadow-[0_0_10px_rgba(255,255,255,0.15)] transition-all duration-500 hover:h-3 hover:w-3 hover:bg-white/70 hover:opacity-100 hover:shadow-[0_0_18px_rgba(180,120,255,0.75)]"
    />
  );
}