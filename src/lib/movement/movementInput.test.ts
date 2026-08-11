import { describe, expect, it } from "vitest";
import { createKeyboardInputAdapter } from "./movementInput";

class FakeVisibilityTarget extends EventTarget {
  hidden = false;

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.dispatchEvent(new Event("visibilitychange"));
  }
}

function keyEvent(type: "keydown" | "keyup", code: string): Event {
  return Object.assign(new Event(type, { cancelable: true }), { code });
}

describe("SYS-006 keyboard lifecycle", () => {
  it("clears held controls when the document becomes hidden", () => {
    const keys = new EventTarget();
    const blur = new EventTarget();
    const visibility = new FakeVisibilityTarget();
    const input = createKeyboardInputAdapter(keys as unknown as HTMLElement, {
      blurTarget: blur as unknown as Window,
      visibilityTarget: visibility as unknown as Document,
    });

    keys.dispatchEvent(keyEvent("keydown", "KeyD"));
    keys.dispatchEvent(keyEvent("keydown", "KeyW"));
    expect(input.read()).toEqual({ steerX: 1, steerY: 1 });

    visibility.setHidden(true);
    expect(input.read()).toEqual({ steerX: 0, steerY: 0 });
    input.dispose();
  });
});
