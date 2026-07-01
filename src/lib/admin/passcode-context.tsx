import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { verifyAdminPasscode } from "./gate.functions";
import { PasscodeKeypad } from "@/components/admin/PasscodeKeypad";

type Ctx = {
  /** Ensure a valid passcode is available; opens the keypad if missing. */
  ensure: () => Promise<string>;
  /** Current passcode (may be empty). */
  get: () => string;
  /** Clear the cached passcode (forces re-prompt next time). */
  clear: () => void;
};

const PasscodeContext = createContext<Ctx | null>(null);

export function PasscodeProvider({ children }: { children: React.ReactNode }) {
  const verify = useServerFn(verifyAdminPasscode);
  const passRef = useRef<string>("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const pendingRef = useRef<{
    resolve: (v: string) => void;
    reject: (e: unknown) => void;
  } | null>(null);

  const ensure = useCallback(async () => {
    if (passRef.current) return passRef.current;
    setError(false);
    setOpen(true);
    return new Promise<string>((resolve, reject) => {
      pendingRef.current = { resolve, reject };
    });
  }, []);

  const onSubmit = useCallback(
    async (code: string) => {
      try {
        const { ok } = await verify({ data: { passcode: code } });
        if (!ok) {
          setError(true);
          return false;
        }
        passRef.current = code;
        setOpen(false);
        setError(false);
        pendingRef.current?.resolve(code);
        pendingRef.current = null;
        return true;
      } catch {
        setError(true);
        return false;
      }
    },
    [verify],
  );

  const onCancel = useCallback(() => {
    setOpen(false);
    pendingRef.current?.reject(new Error("Cancelled"));
    pendingRef.current = null;
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      ensure,
      get: () => passRef.current,
      clear: () => {
        passRef.current = "";
      },
    }),
    [ensure],
  );

  return (
    <PasscodeContext.Provider value={value}>
      {children}
      <PasscodeKeypad
        open={open}
        error={error}
        onErrorClear={() => setError(false)}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    </PasscodeContext.Provider>
  );
}

export function usePasscode() {
  const ctx = useContext(PasscodeContext);
  if (!ctx) throw new Error("usePasscode must be used within PasscodeProvider");
  return ctx;
}