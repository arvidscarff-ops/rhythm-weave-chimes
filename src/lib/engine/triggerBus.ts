/**
 * Single dispatch point for scene → audio + visual triggers.
 *
 * Scenes return `TriggerEvent[]` from `update(dt)`. The render loop pipes
 * those events here, and ONLY here do we touch `triggerPackVoice` and the
 * ink-bleed pool. This guarantees audio + visual fire in the same tick.
 */

import { triggerPackVoice, type RuntimePack } from "@/lib/sound/runtimePacks";
import { spawnInkBleed } from "@/lib/visuals/inkBleed";
import type { TriggerEvent } from "./sceneTypes";

export type DispatchCtx = {
  audioCtx: AudioContext;
  audioDest: AudioNode;
  pack: RuntimePack;
  audioNow: number;
};

export function dispatchTriggers(events: TriggerEvent[], ctx: DispatchCtx) {
  if (events.length === 0) return;
  for (const ev of events) {
    // Audio first — zero scheduling delay relative to the collision frame.
    triggerPackVoice(ctx.audioCtx, ctx.audioDest, ctx.pack, ev.slot, ev.freq, ctx.audioNow);
    // Visual ink-bleed in the same tick. No hard flashes.
    spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity });
  }
}