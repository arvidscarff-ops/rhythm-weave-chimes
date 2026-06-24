# Multi-scene engine: Wheel + Pendulum + Bars

Today the canvas only treats **Wheel** as a first-class "art mode" (open canvas, ArtDock, FX/Packs/About drawers, pack engine via `triggerPackVoice`). The legacy `polygon` / `sine` / `lissajous` scenes use an older scheduler and a different chrome. We'll retire the legacy scenes from the UI and promote three first-class scenes sharing the same engine: **Wheel**, **Pendulum**, **Bars**.

## What the user gets

- A **Scene selector** in the left rail (under the PHASE wordmark): `wheel · pendulum · bars`. Switching scenes never tears down audio — packs, FX, BPM, master volume, and play state persist.
- **Pendulum scene** — pendulums hang from a top anchor; each swings at its own natural period. A note fires every time a bob crosses bottom-dead-centre (both directions). Different string lengths produce phasing polyrhythms (Galileo-pendulum classic).
- **Bars scene** — vertical lanes across the canvas. Each lane has a falling playhead at its own rate; it fires a note when it hits the bottom, then loops to the top. A faint zigzag line connects the last trigger points across lanes.
- Each scene has its own minimal editing surface (add/remove element, per-element slot pick) and its own `PhaseReadout` rows.
- All three scenes route through `triggerPackVoice(activePack, slotIndex, freq, when)` so the active sound pack, FX chain, and per-slot panning apply uniformly.

## Architecture changes (technical section)

### 1. Scene model
- Narrow `SceneKind` to `"wheel" | "pendulum" | "bars"`. Delete `polygon` / `sine` / `lissajous` from the active set and remove their headers/dropdowns/scheduler.
- Add `pendulum: PendulumState` and `bars: BarsState` to `EngineState` alongside `wheel`.
- Treat the whole canvas as "art mode" regardless of scene — always render with `paintArtBackground`, always show `ArtDock` + drawers + `PhaseReadout`. Drop the legacy `!isWheel` header / footer entirely.

### 2. Pendulum scene
```
type Pendulum = {
  id: string;
  lengthFactor: number;   // 0.35..0.95 of available height
  angle: number;          // rad, current
  angVel: number;
  damping: number;        // ~0.0 (visual only; we drive period analytically)
  slotIndex: number;      // 0..5 → pack slot
  pitchIndex: number;     // 0..11 → semitone offset for sample/synth
  prevSign: -1 | 0 | 1;   // for zero-cross detection
  flash: number;
};
type PendulumState = { pivot: { x: number; y: number }; bobs: Pendulum[] };
```
- Update: integrate small-angle SHM `θ̈ = -(g/L)·θ` with `g` chosen so the slowest pendulum's period at BPM=90 is musically slow (~6s). Bind period to BPM so `pendulum.period(i) = baseSec(bpm) * ratio(i)` where ratios are e.g. `1, 8/9, 8/10, 8/11, 8/12, 8/13` → constant phasing across bobs.
- Trigger: when `sign(angle)` changes, fire `triggerPackVoice` at `audioNow + 0.005`, bump `flash`, and append a ripple particle at the bob position.
- Draw: thin (0.5px) string from pivot to bob; bob ring with bloom proportional to `flash`; pivot dot at top. Soft star-dust unchanged.
- Edit overlay: small chips along the top edge (one per bob) showing `slot · length`; `+` button to add; click chip to cycle slot; drag chip horizontally to retune length. `−` removes.

### 3. Bars scene
```
type BarLane = {
  id: string;
  x: number;          // normalized 0..1
  period: number;     // seconds for playhead to fall canvas-height
  phase: number;      // 0..1 current position
  slotIndex: number;  // 0..5
  pitchIndex: number; // 0..11
  flash: number;
  lastTriggerY: number; // for zigzag connector
};
type BarsState = { lanes: BarLane[] };
```
- Update: advance `phase += dt / period`. When `phase >= 1`, fire `triggerPackVoice`, reset `phase -= 1`, bump `flash`. Periods derive from BPM with per-lane ratios (`4/3, 5/4, 6/5, 7/6, ...`) so lanes phase against each other.
- Draw: faint vertical lane rectangle for each (slightly brighter at the active column), small ring at the playhead position with bloom on trigger, plus a 0.5px polyline connecting the bottom-trigger points across lanes for the "zigzag" reference look. When a lane just fired, draw a bright glowing ring at the bottom of that lane decaying over ~600ms.
- Edit overlay: chips above each lane (`slot · ratio`), `+` button to add a lane (auto-distributes x), `−` to remove. Click chip cycles slot; right-click cycles ratio.

### 4. Shared scene contract (refactor)
Introduce a tiny per-scene module pattern inside `src/routes/index.tsx` (kept in-file to minimize churn; can extract later):
```
type SceneAdapter = {
  update(dt: number, audio: AudioGraph, ctx: TickCtx): void;
  draw(c: CanvasRenderingContext2D, W: number, H: number, audioNow: number, hoverId: string | null): void;
  readout(): { id: string; label: string; period: number }[];
};
```
Wire `wheel`, `pendulum`, `bars` adapters; the RAF loop calls `adapter.update` + `adapter.draw`. The legacy `setInterval` scheduler is removed.

### 5. Scene switcher UI
- Add a `SceneRail` to `PhaseChrome` (left side, under the wordmark) with three buttons. Active scene highlighted with the existing rail-link style. Switching scene closes drawers cleanly.
- `PhaseReadout` becomes scene-aware: pulls `adapter.readout()` so each scene shows its own per-element rows (e.g. Pendulum: `L0.62 · 5.30s`, Bars: `4/5 · 3.20s`).
- `ArtDock` action buttons become scene-contextual: Wheel keeps `+ring / +line`, Pendulum gets `+pendulum`, Bars gets `+lane`. Other dock buttons (play/pause, BPM, FX, Packs) are unchanged.

### 6. Audio engine (no changes to graph)
- `triggerPackVoice` already accepts `(slotIndex, freq, when)` — both new scenes call it directly. Frequency derived from `pitchIndex` via a small `pitchToFreq` helper (e.g. `220 * 2^(p/12)`).
- Active-voice cap, limiter, FX chain, convolver — all reused as-is.

### 7. Files touched
- `src/routes/index.tsx` — main work: new state types, two new scene adapters, scene switcher, readout/dock wiring, remove legacy scenes/scheduler/header/footer.
- No new files, no schema changes, no new dependencies.

## Out of scope (next phase candidates)
- 3-layer melo/bass/atmo split (the Lucid Rhythms top-bar model) — call it out separately when you're ready.
- `multiply` knob and split `rev-size` / `rev-mix` semantics tweak.
- Preset save/recall with prev/next stepping.
- Background visual layer ("Circles" drifting rings).
