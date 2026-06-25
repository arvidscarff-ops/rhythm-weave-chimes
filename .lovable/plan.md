
## Goal

Add the NeuralNoise WebGL shader as a global, subtle "breathing" background that sits behind everything in the app, reacts to cursor movement (already built into the shader), and lights up locally when notes trigger. Expose a small UI to pick the color or a gradient preset.

## Files

**New: `src/components/ui/neural-noise.tsx`**
- Port the provided component to TypeScript with proper refs/types (no module-scope `let gl`).
- Props:
  - `color: [number, number, number]` — base RGB (0-1).
  - `colorB?: [number, number, number]` — optional second color for gradient blending.
  - `opacity?: number` (default `0.35` — subtle).
  - `speed?: number` (default `0.0003` — slow "breathing").
  - `scale?: number` — overall noise scale.
  - `flashRef?: React.MutableRefObject<{ x: number; y: number; intensity: number; until: number } | null>` — external trigger source for note flashes.
- Extend the fragment shader:
  - Add `u_color_b`, `u_mix` (animated slow sine for breathing blend).
  - Add `u_flash_position`, `u_flash_intensity` — adds a localized bright contribution near the flash point that decays each frame.
- Use `requestAnimationFrame` id stored in a ref; cancel on unmount. Add a `<canvas>` with `position: fixed; inset: 0; width: 100vw; height: 100vh; pointer-events: none; z-index: 0; opacity: var(--neural-opacity)`.

**New: `src/lib/neural/palette.ts`**
- Export gradient/color presets compatible with the current Phase aesthetic:
  - `Aurora` (teal → cyan), `Lagoon` (deep teal mono), `Ember` (warm amber → magenta), `Violet Mist` (indigo → violet), `Phase Pink` (the demo default), `Mono` (white).
- Each preset: `{ id, label, color: [r,g,b], colorB?: [r,g,b] }`.

**New: `src/lib/neural/flashBus.ts`**
- A tiny singleton with `subscribe(cb)` and `flash(x, y, intensity?)`. Uses normalized viewport coords (0-1).
- The neural-noise component subscribes and writes into its internal flash ref.

**Edit: `src/routes/__root.tsx`**
- Mount `<NeuralNoise />` once inside the body shell (above route Outlet in DOM order but `z-index: 0` with the rest of the app at `z-index: 1+`), so it appears as a global background on every route.
- Read selected preset from `localStorage` ("phase.neural.preset", default `Aurora`) inside a `useEffect` to avoid SSR hydration mismatch; render `null` for the canvas until mounted client-side (prevents the existing hydration warning pattern).

**Edit: `src/styles.css`**
- Lower the existing `.pr-stage` gradient opacity slightly so the shader reads through; ensure body background remains charcoal/teal base.
- Make the app chrome (rails, dock, readout) sit on `z-index: 10+` and add `isolation: isolate` where needed so backdrop-blur still works over the shader.

**Edit: `src/routes/index.tsx`**
- Import `flashBus` from `@/lib/neural/flashBus`.
- In each scene's trigger handler (Wheel intersection, Pendulum zero-crossing, Bars playhead trigger), after firing audio, call `flashBus.flash(nx, ny, velocity)` where `nx, ny` are normalized to viewport coordinates (use the canvas's bounding rect + the trigger's local coords).
- Add a "Visuals" section to the FX drawer (or About → Visuals) with:
  - Preset picker (chips for the 6 presets).
  - Opacity slider (0–60%, default 35%).
  - Speed slider (very slow → slow).
  - Persist to `localStorage` and broadcast via a small `useNeuralSettings` hook so `<NeuralNoise>` picks up changes live.

## Behavior

- Default state: barely-there teal/cyan flow at ~35% opacity, breathing on a ~20s sine.
- Cursor: subtle local brightening (already in shader's `u_pointer_position`).
- Note trigger: short radial bloom at the note's screen position; intensity scales with note velocity; decays over ~600ms with exponential easing — never overwhelms the composition.
- Respects `prefers-reduced-motion`: drops speed to 0 and disables flashes.

## Technical Notes

- TypeScript: type the WebGL handles (`WebGLRenderingContext`, `WebGLUniformLocation`), avoid module-scope mutable `gl`/`uniforms`.
- SSR: guard all `window`/`document`/WebGL access inside `useEffect`; render the `<canvas>` only after mount to prevent hydration mismatch.
- Performance: cap DPR at 1.5 (shader is fragment-heavy at full DPR on retina), use a single global instance, not per-route.
- No new dependencies required.
