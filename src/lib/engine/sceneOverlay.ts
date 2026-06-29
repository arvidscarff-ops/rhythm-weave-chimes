/**
 * Scene overlay — applied to every TriggerEvent before audio + visual dispatch.
 *
 * The Studio's user-scene editor lets a user remap voice slots, shift pitch,
 * and dial the ink-bleed amount on top of any built-in template. Those
 * tweaks live here so both dispatch paths (`scheduler.ts` for Phase-Zero
 * scenes, `triggerBus.ts` for legacy `update(dt)` scenes) read from a
 * single source of truth.
 *
 * Default overlay is a no-op: slotMap = identity, pitchSemis = 0, ink = 1.
 * Set via `setSceneOverlay(...)` from the audition handshake in index.tsx.
 */

import type { TriggerEvent, VoiceSlotIndex } from "./sceneTypes";

export type SceneOverlay = {
  /** Map original slot index (0..5) → new slot index (0..5). */
  slotMap: readonly [number, number, number, number, number, number];
  /** Semitones added to every event's frequency. */
  pitchSemis: number;
  /** Multiplier on ev.velocity, drives ink-bleed radius + alpha. 0..1. */
  ink: number;
};

const IDENTITY: SceneOverlay = {
  slotMap: [0, 1, 2, 3, 4, 5] as const,
  pitchSemis: 0,
  ink: 1,
};

let current: SceneOverlay = IDENTITY;

export function setSceneOverlay(next: Partial<SceneOverlay> | null): void {
  if (!next) {
    current = IDENTITY;
    return;
  }
  current = {
    slotMap: next.slotMap ?? IDENTITY.slotMap,
    pitchSemis: next.pitchSemis ?? IDENTITY.pitchSemis,
    ink: next.ink ?? IDENTITY.ink,
  };
}

export function getSceneOverlay(): SceneOverlay {
  return current;
}

/** Apply the active overlay to an event. Pure — returns a new event. */
export function applyOverlay(ev: TriggerEvent): TriggerEvent {
  if (current === IDENTITY) return ev;
  const mapped = current.slotMap[ev.slot] ?? ev.slot;
  const freq =
    current.pitchSemis === 0 ? ev.freq : ev.freq * Math.pow(2, current.pitchSemis / 12);
  const velocity = Math.max(0, Math.min(1, ev.velocity * current.ink * 2));
  return { ...ev, slot: mapped as VoiceSlotIndex, freq, velocity };
}