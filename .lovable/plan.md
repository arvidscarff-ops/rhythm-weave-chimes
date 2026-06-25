# Reactive Lens Flare Overlay

Yes — doable cleanly within the budget. The flash bus already broadcasts every note trigger (`src/lib/neural/flashBus.ts`) and `burstField.ts` consumes those events for blooms. We add a third subscriber: a canvas overlay that renders an artistic, abstract anamorphic-style lens flare driven by the same energy.

## What you'll see

- A soft, painterly flare layer sitting above the neural background and below the dock.
- Each note bloom emits an answering flare: a horizontal anamorphic streak, a chromatic core, 2–3 ghost orbs along the optical axis, and a faint iris halo.
- Flares inherit the active neural palette hue (so OBSIDIAN stays moody, ACID gets toxic green, etc.) plus a per-burst hue jitter so it never looks mechanical.
- Energy from many simultaneous notes accumulates into a global "bloom pressure" that gently brightens and lengthens streaks during dense passages, then decays.
- Honors `prefers-reduced-motion` and the existing Visuals → Glow / Flow sliders for intensity.

Purely additive blending, no DOM, no new dependencies.

## Files

New:
- `src/lib/visuals/lensFlare.ts` — flare state, `spawnFlare(x,y,opts)`, `updateFlares(dt)`, `drawFlares(ctx, w, h)`. Subscribes to `flashBus` and to neural settings for palette + intensity.

Edited:
- `src/routes/index.tsx` — in the existing rAF render loop, after `drawBursts(ctx)` call `updateFlares(dt)` + `drawFlares(ctx, w, h)` on the same canvas. No new canvas element.

No changes to audio, composer, dock, or routes.

## Technical notes

- Flare primitives drawn with radial + linear gradients and `globalCompositeOperation = "lighter"`, matching `burstField`'s additive approach.
- Anamorphic streak = thin tall-aspect radial gradient stretched on the x-axis, with a subtle RGB split (3 offset draws in R/G/B-tinted alpha) for chromatic aberration.
- Ghosts placed along the line from burst position to canvas center, sized/colored by a seeded PRNG so each note's flare feels unique but stable.
- Envelope: ~80ms attack, ~900ms eased release; cap at ~24 concurrent flares with slot recycling (same pattern as `burstField`).
- Reads `neuralHueBias()` style helper to stay palette-coherent; multiplies output alpha by Visuals "Glow" setting so users can tone it down or off.

## Out of scope

No new UI controls this pass (uses existing Glow/Flow). No shader work — 2D canvas keeps it inside budget.
