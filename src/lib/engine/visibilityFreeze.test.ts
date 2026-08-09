import { describe, expect, it } from "vitest";
import { createLiveTimelineAdapter } from "@/lib/rhythm/liveTimelineAdapter";
import { installVisibilityFreeze } from "./visibilityFreeze";

describe("visibility transport freeze", () => {
  it("freezes hidden musical position and resumes without catch-up", () => {
    let hidden = false;
    let listener: () => void = () => undefined;
    let position = 3;
    let playing = true;
    let suspended = false;
    let resumeAfterBackground = false;
    const source = {
      get hidden() {
        return hidden;
      },
      addEventListener(_type: "visibilitychange", next: () => void) {
        listener = next;
      },
      removeEventListener(_type: "visibilitychange", next: () => void) {
        if (listener === next) listener = () => undefined;
      },
    };
    const transport = {
      suspendForBackground() {
        if (suspended) return;
        resumeAfterBackground = playing;
        playing = false;
        suspended = true;
      },
      resumeFromBackground() {
        if (!suspended) return;
        playing = resumeAfterBackground;
        resumeAfterBackground = false;
        suspended = false;
      },
    };
    const adapter = createLiveTimelineAdapter({
      composition: {
        id: "visibility-proof",
        version: 1,
        voices: [{ id: "voice", eventsPerMacroCycle: 4 }],
      },
      macroCycleDuration: 10,
    });
    const cleanup = installVisibilityFreeze(source, transport);
    const before = adapter.snapshotAt(position);

    hidden = true;
    listener();
    if (playing) position += 100;
    const during = adapter.snapshotAt(position);
    hidden = false;
    listener();
    if (playing) position += 1;
    const after = adapter.snapshotAt(position);

    expect(during).toEqual(before);
    expect(after.macroPosition).toEqual({ numerator: 2n, denominator: 5n });
    cleanup();
  });
});
