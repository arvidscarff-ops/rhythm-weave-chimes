
# Plan — "Phase" → Lucid Rhythms-style clone

Goal: match the look, motion, and control surface of the reference while keeping pure Web Audio (no samples). Built in passes so each phase ships something usable.

## 1. Rhythm engine rewrite (polygon model)

Replace the 3 fixed lanes with a generalized engine:

- One master tempo (BPM) drives everything. `speed` knob scales it.
- A **polygon** of N vertices (N controlled by the `multiply` knob, 2–12). Each vertex = one trigger node.
- Each vertex has its own loop subdivision (vertex i fires every `period / (i+ratio)` — produces phasing). This is the polyrhythm.
- Pitch per vertex is mapped from a pentatonic/lydian scale so re-alignments sound consonant.
- Engine exposes a `triggers$` stream: `{ vertexIndex, time, velocity }` consumed by both audio and visuals so they stay sample-accurate in sync.

State lives in a single `useRef` store (no React re-renders per frame).

## 2. Scene system

A `scene` dropdown swaps the visual renderer; audio engine is untouched.

Three scenes for v1, all rendered on one full-bleed `<canvas>` with additive blending for the glow:

- **Polygon** (ref image 3): vertices as bright neon rings on a faint circle; on trigger the vertex flashes + emits a short particle burst; thin lines connect vertex to every other vertex it has co-fired with in this cycle, building a Spirograph-like web that fades.
- **Sine Circle** (ref image 2): vertices ride a vertical line; on trigger they punch a glowing ring outward + spawn drifting particles. Background gets faint orbiting rings.
- **Lissajous** (ref image 1): two perpendicular sine lanes draw an X-shaped trail of dots; trigger nodes pulse along the curve, particle sparkles at the crossing.

Architecture: `Scene` interface `{ draw(ctx, state, dt), onTrigger(vertex) }`. Adding more scenes later is one file each.

## 3. Visual rendering

- Canvas 2D, `requestAnimationFrame`, fixed timestep accumulator for the rhythm clock so audio/visual triggers share one `audioCtx.currentTime` source.
- Particle pool (preallocated ~2000) — position, velocity, life, hue. No per-frame allocs.
- Glow via offscreen blur layer + additive composite (cheap, no WebGL needed for v1).
- Subtle ambient layer: slow-drifting "dust" particles, faint concentric rings — matches the reference's atmosphere.
- "LUCID RHYTHMS"-style wordmark behind everything, very low opacity (we'll use the project name — ask user for it; default **PHASE**).

## 4. Top control strip (reference-style)

Header row, dense, hardware-synth feel:

- Left: **scene** dropdown, **background** dropdown (3 presets: void / grid / drift).
- Middle: three voice dropdowns (**melo-sound**, **bass-sound**, **atmo-sound**) — for v1 these select the synth's timbre preset (chime, pluck, bell, soft pad, none). All still pure oscillator synthesis.
- Right: rotary **knobs** with arc indicator + numeric readout — `main-vol`, `pitch`, `rev-mix`, `rev-size`, `speed`, `multiply`, `fx-1` (filter cutoff), `fx-2` (detune/chorus depth).
- A custom `<Knob>` component: SVG arc + drag-to-rotate (vertical drag = value), shift-drag for fine, double-click to reset.
- Play/pause + time readout on the far right (matches the reference's transport).

The existing 3 speed sliders are removed — `speed` + `multiply` knobs replace them.

## 5. Audio expansion

Keep the current chime as the default melo voice. Add:

- A second oscillator chain tuned an octave down with a slower attack → **bass** voice.
- A noise-through-bandpass shimmer with very long release → **atmo** voice (triggered sparsely, every Nth cycle).
- Shared FX bus: lowpass (fx-1) → chorus/detune (fx-2) → feedback delay (rev-size = delay time, rev-mix = wet).
- `main-vol` and `pitch` knobs act on the master.

Routing per vertex: assign vertices round-robin to melo/bass/atmo based on dropdown selections (a `---` selection skips that voice).

## 6. Phased build order

1. Knob component + new header layout (still driving old engine) — proves the control surface.
2. Rewrite engine to polygon model; wire `multiply` + `speed`; remove old sliders.
3. Polygon scene with particles + connecting web.
4. FX bus + extra knob wiring.
5. Multi-voice synth + voice dropdowns.
6. Sine Circle and Lissajous scenes + scene dropdown.
7. Background presets, ambient dust, wordmark, polish pass (easing, glow tuning, mobile layout fallback).

Each step leaves a working app.

## Technical notes

- All visuals on one canvas sized via `ResizeObserver` and `devicePixelRatio`.
- Rhythm clock uses Web Audio `currentTime` as source of truth; visuals interpolate via `performance.now()` between scheduling ticks.
- Look-ahead scheduler (25 ms tick, 100 ms horizon) schedules audio events precisely and pushes matching visual triggers into a queue the RAF loop drains.
- Knob values stored in a single zustand-free `useRef` map; UI components subscribe via a tiny pub/sub so dragging a knob doesn't re-render the canvas tree.
- Color palette: deep near-black bg, neon cyan / magenta / amber accents per voice, all via CSS tokens in `src/styles.css`.
- No external audio assets, no WebGL dependency, no new heavy libs (only what's already in the project).

## Open question to resolve at build start

- Wordmark text? Default **PHASE** unless you want something else (e.g. your own name for the app).
