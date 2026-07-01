import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PIN_LENGTH = 6;

type Props = {
  open: boolean;
  error: boolean;
  onErrorClear: () => void;
  /** Return true if code accepted, false if rejected. */
  onSubmit: (code: string) => Promise<boolean>;
  onCancel: () => void;
  /** If false, keypad renders inline (no fixed overlay) — used by /admin/unlock. */
  overlay?: boolean;
};

export function PasscodeKeypad({
  open,
  error,
  onErrorClear,
  onSubmit,
  onCancel,
  overlay = true,
}: Props) {
  const [digits, setDigits] = useState("");
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [flash, setFlash] = useState<"ok" | "err" | null>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setDigits("");
      setFlash(null);
      submittingRef.current = false;
    }
  }, [open]);

  const trySubmit = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setBusy(true);
      const ok = await onSubmit(code);
      setBusy(false);
      if (ok) {
        setFlash("ok");
      } else {
        setFlash("err");
        setShake(true);
        setTimeout(() => setShake(false), 450);
        setTimeout(() => {
          setDigits("");
          setFlash(null);
          submittingRef.current = false;
        }, 350);
      }
    },
    [onSubmit],
  );

  const push = useCallback(
    (d: string) => {
      if (busy) return;
      onErrorClear();
      setDigits((prev) => {
        if (prev.length >= PIN_LENGTH) return prev;
        const next = prev + d;
        if (next.length === PIN_LENGTH) {
          void trySubmit(next);
        }
        return next;
      });
    },
    [busy, onErrorClear, trySubmit],
  );

  const back = useCallback(() => {
    if (busy) return;
    onErrorClear();
    setDigits((p) => p.slice(0, -1));
  }, [busy, onErrorClear]);

  const enter = useCallback(() => {
    if (busy || digits.length === 0) return;
    void trySubmit(digits);
  }, [busy, digits, trySubmit]);

  // Direct keyboard input, no focus required
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        push(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        back();
      } else if (e.key === "Enter") {
        e.preventDefault();
        enter();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, push, back, enter, onCancel]);

  if (!open) return null;

  const panel = (
    <div
      className={cn(
        "relative w-[340px] select-none rounded-[28px] p-6",
        "border border-white/15",
        "bg-gradient-to-b from-white/[0.08] to-white/[0.02]",
        "backdrop-blur-2xl backdrop-saturate-150",
        "shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.15)]",
        "before:pointer-events-none before:absolute before:inset-0 before:rounded-[28px]",
        "before:bg-[radial-gradient(120%_60%_at_50%_-10%,rgba(255,255,255,0.18),transparent_60%)]",
        "after:pointer-events-none after:absolute after:inset-[-2px] after:rounded-[30px]",
        "after:bg-[conic-gradient(from_180deg,rgba(139,92,246,0.35),rgba(56,189,248,0.25),rgba(236,72,153,0.3),rgba(139,92,246,0.35))]",
        "after:opacity-40 after:blur-2xl after:-z-10 after:animate-[glow-breathe_8s_ease-in-out_infinite]",
        shake && "animate-[keypad-shake_0.45s_cubic-bezier(.36,.07,.19,.97)_both]",
      )}
    >
      {overlay && (
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-full p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white/80"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.32em] text-white/50">
          Passcode
        </div>
        <div className="mt-1 text-xs text-white/40">
          {error ? "Incorrect — try again" : "Type or tap to enter"}
        </div>
      </div>

      {/* Dots */}
      <div className="mt-5 flex justify-center gap-3">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < digits.length;
          return (
            <span
              key={i}
              className={cn(
                "h-3 w-3 rounded-full border transition-all duration-200",
                filled
                  ? "scale-110 border-white/70 bg-white shadow-[0_0_14px_rgba(255,255,255,0.75)]"
                  : "scale-100 border-white/25 bg-white/[0.04]",
                flash === "err" && "border-red-400/80 bg-red-400 shadow-[0_0_14px_rgba(248,113,113,0.8)]",
                flash === "ok" && filled && "border-emerald-300/80 bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,0.9)]",
              )}
            />
          );
        })}
      </div>

      {/* Keypad */}
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <KeyBtn key={d} onPress={() => push(d)} disabled={busy}>
            {d}
          </KeyBtn>
        ))}
        <KeyBtn onPress={back} disabled={busy} variant="ghost" ariaLabel="Backspace">
          <Delete className="h-4 w-4" />
        </KeyBtn>
        <KeyBtn onPress={() => push("0")} disabled={busy}>
          0
        </KeyBtn>
        <KeyBtn onPress={enter} disabled={busy || digits.length === 0} variant="primary" ariaLabel="Enter">
          <ArrowRight className="h-4 w-4" />
        </KeyBtn>
      </div>
    </div>
  );

  if (!overlay) return panel;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative">{panel}</div>
    </div>
  );
}

function KeyBtn({
  children,
  onPress,
  disabled,
  variant = "default",
  ariaLabel,
}: {
  children: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  variant?: "default" | "ghost" | "primary";
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onPress}
      className={cn(
        "group relative h-14 rounded-2xl border text-lg font-light text-white",
        "border-white/15 backdrop-blur-xl transition-all duration-150",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-1px_0_rgba(0,0,0,0.25),0_6px_16px_-8px_rgba(0,0,0,0.6)]",
        variant === "default" && "bg-white/[0.06] hover:bg-white/[0.12]",
        variant === "ghost" && "bg-white/[0.02] text-white/70 hover:bg-white/[0.08] hover:text-white",
        variant === "primary" &&
          "bg-gradient-to-b from-violet-400/30 to-fuchsia-500/20 text-white hover:from-violet-400/45 hover:to-fuchsia-500/30",
        "active:scale-[0.94] active:shadow-[inset_0_2px_6px_rgba(0,0,0,0.5)]",
        "disabled:opacity-40 disabled:pointer-events-none",
        "flex items-center justify-center",
      )}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1/2 rounded-t-xl bg-gradient-to-b from-white/15 to-transparent opacity-70" />
      <span className="relative z-10">{children}</span>
    </button>
  );
}