# FX Panel — expandable glass drawer (Wheel art mode)

A bottom drawer that lives just above the existing floating dock. Closed by default as a thin tab; tapping expands it upward into a semi-full glass panel with four FX channels. The wheel stays fully visible above it.

## Trigger affordance

- Inside the existing `ArtDock`, add a small new icon button: a 3-band "fx" sigil (three short horizontal lines, lucide `sliders-horizontal`-style). Tapping toggles the drawer.
- The button gets an active state (filled dot under the icon) when the drawer is open.

## Drawer behavior & geometry

- New component `FxDrawer` rendered absolutely in `<main>`, just like `ArtDock`.
- Closed state: hidden / `pointer-events:none`, no DOM cost beyond the wrapper.
- Open state: `position:absolute; left:50%; transform:translateX(-50%); bottom:80px;` (sits above the dock, never overlaps).
- Width: `min(720px, calc(100vw - 48px))`. Height: `260px` (fits 4 channel columns side-by-side, leaves >60% of the canvas visible above).
- Glass: `backdrop-blur-md`, `bg-white/4`, `border border-white/10`, `rounded-2xl`, soft drop shadow — same family as the dock.

## Animation (tactile, not bouncy)

- CSS-only — no animation libraries. Two keyframed transitions:
  - `transform: translate(-50%, 12px) scale(0.96)` → `translate(-50%, 0) scale(1)`
  - `opacity: 0 → 1`
  - 280ms `cubic-bezier(0.22, 1, 0.36, 1)` (expo-out — feels like a physical drawer settling).
- On close: reverse, 200ms.
- The trigger icon mirrors the motion with a subtle 1px lift on press for tactility.

## Panel contents

Four equal columns (32px gutters), labeled in tiny `0.18em` tracked uppercase. Each column has:

1. A vertical channel name + a power dot (click to bypass that effect — bypass keeps node graph intact, just sets its mix gain to 0).
2. A small **type selector** (text-only chips, 1 active).
3. One or two hairline sliders (matching the dock's tempo slider style) for the channel's parameters.
4. A tiny live value readout in tabular nums.

### Channel 1 — Reverb (rebinds existing `delay`/`feedback`/`wet`)

- **Type chips:** `room` · `hall` · `plate` · `cosmic`. Each preset writes new values to the existing nodes (no new audio nodes needed):
  - room → `delayTime 0.18`, `feedback 0.35`
  - hall → `delayTime 0.55`, `feedback 0.62`
  - plate → `delayTime 0.32`, `feedback 0.7`
  - cosmic → `delayTime 1.1`, `feedback 0.78`
- **Sliders:** `mix` (0..1 → `wet.gain`, replaces `knobs.revMix`) and `size` (0.05..1.2 → `delayTime`, replaces `knobs.revSize` while keeping that knob alive for non-wheel scenes).

### Channel 2 — Chorus (rebinds existing chorus nodes)

- **Type chips:** `subtle` · `wide` · `swirl`. Maps to `chorusLFO.frequency` + `chorusLFOGain.gain`:
  - subtle → 0.35 Hz, depth 0.003
  - wide → 0.7 Hz, depth 0.006
  - swirl → 1.6 Hz, depth 0.009
- **Sliders:** `mix` (0..1 → `chorusMix.gain`, replaces `fx2`-derived mapping in wheel mode) and `rate` (0.1..2 Hz → LFO frequency).

### Channel 3 — Grain (NEW: low-rate stutter via a second delay node)

- New nodes built once inside `ensureAudio`:
  - `grainDelay = ctx.createDelay(0.4)`, `delayTime 0.06`
  - `grainFeedback = ctx.createGain(); gain 0.0` (off by default)
  - `grainMix = ctx.createGain(); gain 0` (controls output level)
  - Routing tap: `filter → grainDelay → grainMix → master`, and `grainDelay → grainFeedback → grainDelay`.
- **Type chips:** `dust` · `stutter` · `shimmer` — preset triples for `delayTime` + `feedback` (dust: 0.04/0.2, stutter: 0.12/0.55, shimmer: 0.22/0.7).
- **Sliders:** `mix` (0..1) and `density` (a single knob that scales `delayTime` ±50% and feedback proportionally around the active preset).

### Channel 4 — Tone (NEW: control the existing `filter` + add a high-shelf)

- Add one new node: `shelf = ctx.createBiquadFilter(); type 'highshelf'; freq 4000; gain 0`. Insert it right after `filter` (between `filter` and the existing splits).
- **Type chips:** `dark` · `warm` · `air` — presets for `filter.frequency` + `shelf.gain`:
  - dark → 900 Hz, shelf -6 dB
  - warm → 2400 Hz, shelf 0 dB
  - air → 7000 Hz, shelf +5 dB
- **Sliders:** `cutoff` (200..8000 → `filter.frequency`, replaces `knobs.fx1` in wheel mode) and `tilt` (-8..+8 dB → `shelf.gain`).

## State, persistence, audio plumbing

- New React state object `fxState` with `{ reverb: { type, mix, size }, chorus: { type, mix, rate }, grain: { type, mix, density, bypass }, tone: { type, cutoff, tilt } }`.
- A `fxStateRef` mirrors it for the audio callbacks (same pattern as `knobsRef`).
- Add a `useEffect` that, whenever `fxState` changes AND an `AudioGraph` exists, calls `applyFxState(audio, fxState)` which `setTargetAtTime`s the right params (10–50ms ramps — no zipper noise).
- `applyFxState` lives next to `ensureAudio`. It does NOT touch knobs[fx1/fx2/revMix/revSize] — those still drive non-wheel scenes. When the user is in Wheel mode, fxState wins because it's applied after knob updates.
- Bypass dot: sets that channel's `mix` ramp target to 0 without losing the slider value (slider remembers, UI greys out).

## Visual style (matches the art surface)

- Background: `rgba(255,255,255,0.04)` over the dark canvas.
- Channel divider: 1px `bg-white/8` between columns.
- Typography: Inter 300/400, tracked, `text-white/55` default → `text-white/90` on hover.
- Chips: tiny pill, `bg-white/5` default, `bg-white/15 text-white` when active. No icons inside chips — text only.
- Sliders: reuse `.pr-hairline-slider`.
- Readouts: 10px tabular-nums.

## Modularity

- New file `src/lib/fx/fxState.ts` exporting the `FxState` type, defaults, and `applyFxState(graph, state)`. Keeps `index.tsx` from growing further and lets future scenes share the same FX rack.
- `FxDrawer` component lives at the bottom of `index.tsx` next to `ArtDock` (keeps the React/DOM bits in one file with their state).
- The drawer is rendered only when `isWheel` is true — same gating as the dock.

## Technical notes

- The grain + shelf nodes are added inside `ensureAudio` only on first creation. Existing routing is preserved; nothing breaks for non-wheel scenes.
- Animation uses a single `data-state="open|closed"` attribute on the drawer + a small CSS block in `src/styles.css`. No portals, no `Dialog` — we need it inline so it composes with the canvas.
- The trigger button toggles a single React state `fxOpen`. The drawer's animation runs on the CSS attribute, so React doesn't unmount it on close — needed for the reverse transition.
- Clicking outside the drawer does NOT close it (per "user should be able to have it open and still see everything else"); only the trigger toggles it.

## Out of scope

- Convolution-based reverb (would need IR files; the synth-delay approach matches the existing engine).
- Per-voice FX sends.
- MIDI / keyboard shortcuts.
- Saving FX presets.
