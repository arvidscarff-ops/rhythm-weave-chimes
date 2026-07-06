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
import { applyOverlay } from "./sceneOverlay";

export type DispatchCtx = {
  audioCtx: AudioContext;
  audioDest: AudioNode;
  pack: RuntimePack;
  audioNow: number;
};

/**
 * Lightweight observer for downstream reactive layers (e.g. the audio-
 * reactive scene background). Subscribers receive normalized events after
 * overlay is applied. Errors in a subscriber are swallowed to keep the
 * dispatch loop safe.
 */
type Sub = (ev: TriggerEvent) => void;
const subs = new Set<Sub>();
export function onDispatch(fn: Sub): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function dispatchTriggers(events: TriggerEvent[], ctx: DispatchCtx) {
  if (events.length === 0) return;
  for (const raw of events) {
    const ev = applyOverlay(raw);
    // Audio first — zero scheduling delay relative to the collision frame.
    triggerPackVoice(ctx.audioCtx, ctx.audioDest, ctx.pack, ev.slot, ev.freq, ctx.audioNow);
    // Visual ink-bleed in the same tick. No hard flashes.
    spawnInkBleed(ev.x, ev.y, { hue: ev.hue, energy: ev.velocity });
    for (const s of subs) {
      try {
        s(ev);
      } catch {
        /* subscriber failures must not break the audio loop */
      }
    }
  }
}