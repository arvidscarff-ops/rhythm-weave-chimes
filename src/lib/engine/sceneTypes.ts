/**
 * Phase engine — Scene contract.
 *
 * Each Scene owns its own physics + draw; the render loop only knows how to
 * tick `update(dt)` and `draw(ctx)`, then pipe returned `TriggerEvent`s
 * through the shared `triggerBus` (audio + ink-bleed in one place).
 *
 * Scenes never call `triggerPackVoice`, `performance.now()`, or `audioCtx`
 * directly. That keeps audio↔visual sync owned by one file.
 */

import type { PackId } from "@/lib/sound/packs";

export type SceneId =
  | "stringNet"
  | "pendulumFan"
  | "spiralArp"
  | "radialSweep"
  | "mandalaMatrix"
  | "metatronLattice"
  | "fractalNebula"
  | "radialResonator"
  | "phaseAlignRings"
  | "custom";

export type VoiceSlotIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** A collision/intersection produced by a scene's `update(dt)` pass. */
export type TriggerEvent = {
  /** Pack slot to play (0..5). */
  slot: VoiceSlotIndex;
  /** Frequency in Hz at moment of trigger. */
  freq: number;
  /** Where on the canvas the event happened, in pixel space. */
  x: number;
  y: number;
  /** 0..1 hue rotation for the ink-bleed tint (color follows voice slot). */
  hue: number;
  /** 0..1 perceived energy — drives ink-bleed radius + alpha. */
  velocity: number;
  /**
   * Optional pack override. When set, the scheduler dispatches this
   * event through the named builtin pack instead of the dock's active
   * pack. Used by multi-layer scenes (e.g. Metatron Lattice) that
   * sonify each geometric layer with its own pack. Omit for the
   * default behavior (follow the active pack).
   */
  pack?: PackId;
};

/** What every Scene receives on `update` / `draw`. */
export type SceneGlobals = {
  /** Canvas width / height in CSS pixels. */
  W: number;
  H: number;
  /** Project tempo in BPM. */
  bpm: number;
  /** Global speed multiplier from the dock (0.25 .. 2). */
  speed: number;
  /** Density / line multiplier from the dock (2 .. 12). */
  density: number;
  /** Pitch transpose in semitones from the dock. */
  pitchSemis: number;
  /** Audio context time, for refractory windows. */
  audioNow: number;
  /**
   * Phase-Zero global scene time in seconds, monotonic, modulated by
   * `speed`. The single source of truth for all motion: every scene's
   * geometry must be a deterministic function of `globalTime`. At
   * `globalTime === 0` every node/particle sits on its origin/trigger
   * position — the universal "Big Bang" chord.
   *
   * During the in-flight refactor this is provided to scenes that have
   * been migrated; legacy scenes still using their own local `clock`
   * field may ignore it until they're converted.
   */
  globalTime: number;
  /**
   * Phase-Alignment macro-cycle inputs. Every trigger engine derives
   * cadence from these via `@/lib/engine/phaseAlign`. Resolution order:
   *   dock override (session state) ?? active scene default ?? built-in.
   * See `phaseAlign.resolveCycle` for the canonical clamp/round.
   */
  baseLaps: number;
  macroCycleSeconds: number;
  noteCount: number;
};

export interface Scene<TState = unknown> {
  readonly id: SceneId;
  /** Build a fresh state (called when the scene is first selected). */
  init(globals: SceneGlobals): TState;
  /**
   * @deprecated Legacy per-frame physics. All in-tree scenes are now
   * Phase-Zero (`sample` + `eventsIn`); the render loop no longer calls
   * this. Kept as an optional escape hatch for experimental scenes.
   */
  update?(state: TState, dt: number, globals: SceneGlobals): TriggerEvent[];
  /** Paint the scene. Additive blending owned per-scene (set + reset). */
  draw(state: TState, ctx: CanvasRenderingContext2D, globals: SceneGlobals): void;

  /**
   * Phase-Zero render contract (preferred). Pure function of scene time
   * — no internal `clock` mutation, no `dt`. When a scene implements
   * `sample`, the render loop calls it instead of `update` for draw
   * positions; the global scheduler (see {@link Scene.eventsIn}) owns
   * audio triggers.
   *
   * Returning `void` (or omitting `sample` entirely) means the scene is
   * still on the legacy `update` + `draw` path.
   */
  sample?(state: TState, t: number, globals: SceneGlobals): void;

  /**
   * Phase-Zero scheduler contract (preferred). Return every trigger
   * whose scene-time falls in `[t0, t1)`, in order. Called by the audio
   * scheduler from a look-ahead window — NOT from the render loop.
   *
   * Must be deterministic: `eventsIn(state, a, b)` called twice with the
   * same arguments must return identical results.
   */
  eventsIn?(state: TState, t0: number, t1: number, globals: SceneGlobals): TriggerEvent[];
}