# Minimalist Art Piece — Visual Overhaul (Wheel Canvas)

Reframe the app's surface as a single quiet art object. The audio engine, wheel physics, trigger detection, and scene/voice models stay byte-for-byte the same. Only the **rendering layer**, **chrome/dock**, and **interaction visuals** change.

## 1. Canvas surface

- Replace the flat oklch canvas background with a layered paint:
  - Base: deep charcoal `#0b0b0d` (≈ `oklch(0.12 0.005 0)`).
  - Subtle vignette (radial gradient, ~6% darker at edges) so the eye centers.
  - Static **noise-grain** overlay: generated once into an offscreen canvas at mount (≈ 256×256 monochrome pixel noise at ~4% alpha), tiled via `ctx.fillStyle = pattern` each frame. Cached, regenerated only on DPR change.
- Remove the inline `style.background` on `<canvas>`; paint the bg inside `render()` so the noise composes correctly.

## 2. Wheel rendering refinement (drawWheelScene)

Keep geometry identical; restyle strokes:
- Rings: 1px hairline, `rgba(255,255,255,0.08)`; the actively-hovered ring brightens to `0.18`.
- Notes: small soft discs (radial gradient, no hard edge), tinted by voice.
- Trigger lines: 1px, `rgba(255,255,255,0.12)`, with a faint perpendicular tick at the rim.
- No drop-shadows, no neon — restraint over glow.

## 3. Fluid Inversion — trigger visual

Replace the current "flash circle" trigger effect with an **ink-bleed ripple**:

- New particle type `ripple` with `{x, y, t0, life=0.5s, hue}`.
- Each frame compute `k = (now - t0) / life`, clamp 0..1.
- `radius = 40 * (1 - Math.pow(1 - k, 3))` (exponential ease-out 0→40px).
- `alpha = Math.pow(1 - k, 2.2) * 0.55`.
- Render as a radial gradient disc (transparent center → soft tinted edge → transparent), `globalCompositeOperation = 'lighter'` so overlapping ripples bloom subtly.
- Spawned from existing trigger callsite in `updateWheel` — same place that already dispatches audio.

## 4. Kinetic trail on rotating notes

- Per note, keep a small ring buffer (length 6) of recent `{x, y}` sampled every frame inside `drawWheelScene`.
- Draw oldest→newest as tiny discs whose radius and alpha scale linearly: `r = noteR * (i+1)/7 * 0.6`, `alpha = 0.05 + 0.04*i`.
- Buffer lives on a `WeakMap<WheelNote, Trail>` inside the render module, so the data model stays untouched and trails reset cleanly when notes are removed.

## 5. Ambient speed readout (hover ghost text)

- Track `hoverRingId` in `WheelOverlays` (already has per-ring chips — wire `onPointerEnter/Leave` on each ring chip and on canvas hover hit-test against ring radius).
- When set, render in the canvas dead center:
  - Period in seconds, formatted `"04.50s"` (zero-padded, 2 decimals).
  - Font: `clamp(120px, 22vmin, 280px)`, weight 300, family `'Inter', system-ui` (Inter loaded via `<link>` in `__root.tsx`).
  - Color: `rgba(255,255,255,0.05)`.
  - 180ms fade in/out (opacity tween in a ref, no React rerender).
- Drawn on the canvas (not DOM) so it sits behind rings and obeys the noise layer.

## 6. Chrome removal & glass dock

- **Top header** (knob row, scene picker, voice dropdowns, play button): hidden entirely while in `wheel` scene. Audio engine still reads `knobsRef`/`voicesRef`; defaults are fine for v1 of the art mode.
- **Bottom BPM footer**: replaced by a single floating dock, absolute-positioned bottom-center.
- Dock: `fixed bottom-6 left-1/2 -translate-x-1/2`, `backdrop-blur-md bg-white/5 border border-white/10 rounded-full px-5 py-2.5 flex items-center gap-4 shadow-[0_8px_40px_rgba(0,0,0,0.4)]`.
- Contents (icon-only, no labels, 16px lucide icons, `text-white/70 hover:text-white`):
  - Play/Pause toggle
  - Add Circle (calls existing `addRing`)
  - Clear Lines (new tiny helper that empties `wheel.lines`)
  - Thin tempo readout `{bpm}` + a 120px-wide hairline range input styled as a 1px track with a 6px dot thumb (no box, no fill). Hover expands a tooltip showing the value.
- Ring chips & line handles (DOM overlays) restyled: 10px text, `text-white/40`, no backgrounds, hover only — so the canvas reads as art at rest.

## 7. Modularity for future sequencers

Refactor the canvas pipeline into a tiny **SceneRenderer interface** (no behavior change for non-wheel scenes):

```ts
type SceneRenderer = {
  draw(ctx, w, h, t, dt): void;
  hitTest?(px, py, w, h): boolean; // for click routing
  onPointerDown?(px, py, w, h): boolean;
};
```

- Extract `drawWheelScene` + ripple/trail/ghost-text layers into `wheelRenderer` conforming to this interface.
- Background painter (charcoal + vignette + grain) and overlay layer (ghost text) live in `src/lib/canvas/background.ts` and `src/lib/canvas/typography.ts` — shared across all future sequencers.
- The main `render()` becomes: `paintBackground → sceneRenderer.draw → paintOverlays`. Adding a future "grid", "graph", or "spiral" sequencer is just another `SceneRenderer`.

## Technical notes

- New files: `src/lib/canvas/background.ts`, `src/lib/canvas/typography.ts`, `src/lib/canvas/ripples.ts`, `src/lib/canvas/trails.ts`, `src/lib/canvas/sceneRenderer.ts`. All pure functions/closures — no React.
- Inter font added via `<link rel="stylesheet" href="https://rsms.me/inter/inter.css">` in `src/routes/__root.tsx` head (per stack rules, never `@import` a URL in styles.css).
- No changes to: `playVoice`, `updateWheel` math, `WheelState`/`WheelRing`/`WheelLine`/`WheelNote` types, BPM range, ring period formula, polygon engine, or any audio knob.
- Removed UI in wheel mode is *hidden*, not deleted — switching back to a non-wheel scene restores the full header (kept for parity even though wheel is the showcase).
- Performance: grain pattern cached; trails capped at 6×N notes; ripples auto-evicted after `life`; ghost text is a single fillText per frame.

## Out of scope

- Theme tokens beyond what this surface needs (no full design-token redo).
- Mobile-specific dock layout.
- Saving/loading the art state.
- Touch-press long-hover for the ghost readout (mouse hover only for v1).
