/**
 * SYS-006 — keyboard input adapter (PROTOTYPE, NON-CANON bindings).
 *
 * Deliberately DUMB: it normalizes device state and nothing else. Pressed keys
 * map to +/-1, released keys map straight back to 0. All feel — acceleration,
 * inertia, damping, coast, recentring — lives in the movement model, so a
 * controller, mouse or touch adapter can later feed equivalent normalized
 * input into identical movement behaviour.
 */
import type { MovementInput } from "./movementModel";

const NEUTRAL: MovementInput = { steerX: 0, steerY: 0 };

const AXIS: Record<string, ["x" | "y", 1 | -1]> = {
  KeyA: ["x", -1],
  ArrowLeft: ["x", -1],
  KeyD: ["x", 1],
  ArrowRight: ["x", 1],
  KeyW: ["y", 1],
  ArrowUp: ["y", 1],
  KeyS: ["y", -1],
  ArrowDown: ["y", -1],
};

export interface KeyboardInputAdapter {
  /** Current normalized input. Safe to call every frame. */
  read(): MovementInput;
  dispose(): void;
}

export function createKeyboardInputAdapter(
  target: Window | HTMLElement = window,
): KeyboardInputAdapter {
  const pressed = new Set<string>();

  const onDown = (e: Event) => {
    const ev = e as KeyboardEvent;
    if (!AXIS[ev.code]) return;
    pressed.add(ev.code);
    if (ev.cancelable) ev.preventDefault();
  };
  const onUp = (e: Event) => pressed.delete((e as KeyboardEvent).code);
  // Losing focus must release everything, otherwise a key can stick down.
  const onBlur = () => pressed.clear();

  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  window.addEventListener("blur", onBlur);

  return {
    read() {
      if (pressed.size === 0) return NEUTRAL;
      let x = 0;
      let y = 0;
      for (const code of pressed) {
        const entry = AXIS[code];
        if (!entry) continue;
        if (entry[0] === "x") x += entry[1];
        else y += entry[1];
      }
      // Opposing keys cancel to exactly zero — a released/neutral stick.
      return {
        steerX: Math.max(-1, Math.min(1, x)),
        steerY: Math.max(-1, Math.min(1, y)),
      };
    },
    dispose() {
      pressed.clear();
      target.removeEventListener("keydown", onDown);
      target.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    },
  };
}
