## Goal
Make the neural-noise background subtle and mesmerizing — slow, deep, "sifting through thick water" — and remove the jitter caused by note flashes warping the whole field.

## Root cause of the jitter
In `neural-noise.tsx`, the flash intensity is added to `p` (the pointer influence), which is then fed into the noise displacement loop:
```
acc += sin(layer) + 2.4 * p;
```
Any change to `p` shifts every layer of the noise, so each note pulls the entire pattern toward the trigger point. That's what reads as a jitter / yank.

## Changes (visual only, no functionality changes)

1. **`src/components/ui/neural-noise.tsx` — decouple flash from distortion**
   - Stop adding `flash` into `p`. The cursor still gently warps the field; flashes only add a soft *additive color bloom* (no geometry warp).
   - Soften the cursor contribution too: lower the `0.5 * pow(1.0 - p, 2.0)` weight so cursor movement doesn't tug the pattern.
   - Tame the flash bloom: tighter falloff (`exp(-fd * 9.0)`), smaller color add (~0.12 instead of 0.35), and lower alpha contribution. No more bright halo.
   - Smooth flash envelope: ease-in over ~250ms and ease-out over ~1.4s using a target/current value (instead of instant `Math.max` jump + fast decay). This removes the "snap" feel.
   - Lower overall motion: cut base speed roughly in half (`u_speed` multiplier 0.00009) and reduce pointer lerp from `0.12` → `0.04` so the field drifts like thick liquid.
   - Lower the opacity ceiling (cap at ~0.55 instead of 0.9) so the effect always sits behind content.

2. **`src/lib/neural/palette.ts` — gentler defaults**
   - Default opacity `0.35` → `0.22`.
   - Default speed `1` → `0.55`.
   - Keep presets and storage schema unchanged so existing saved settings still load.

3. **Hydration warning (quiet fix)**
   - The runtime error is caused by a browser extension injecting a `<script>` tag; nothing to fix in our code. Not addressed.

## Out of scope
- No changes to the flash bus API, scene trigger wiring, Visuals drawer UI, or audio engine.
- No new presets or settings fields.

## Acceptance
- Notes trigger a faint, localized brightening that fades softly — the surrounding pattern does **not** lurch toward the trigger point.
- Idle motion feels slow and viscous; cursor presence is barely perceptible.
- Background sits clearly behind the wheel/pendulum/bars UI at default settings.
