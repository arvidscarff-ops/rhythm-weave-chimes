## Goal
Spread the neural pattern more evenly across the viewport and stop bright clusters from blooming out to white. Same mesmerizing feel, lower contrast.

## Why it clusters and blows out today
In `src/components/ui/neural-noise.tsx`:
- `noise = 1.2 * pow(noise, 3.0); noise += pow(noise, 10.0);` — the `pow(noise, 10.0)` term is a brightness booster that snowballs wherever the pattern is already dense, producing fully-white hot spots.
- `noise = max(0.0, noise - 0.5);` — a hard threshold that kills the dim filaments and leaves only the strongest cluster visible.
- `noise *= (1.0 - length(vUv - 0.5));` — a strong radial vignette that concentrates everything near the center.
- Alpha = `noise * u_opacity` is then clamped to `1.0`, so peaks saturate.

## Changes (visual only)
File: `src/components/ui/neural-noise.tsx` — fragment shader only.

1. Replace the hot-spot booster with a softer curve:
   - `noise = 1.0 * pow(noise, 1.6);` (was `1.2 * pow(noise, 3.0)`)
   - Drop the `+= pow(noise, 10.0)` term entirely (this is the main cause of white-out).
2. Lower the threshold so faint filaments stay visible everywhere:
   - `noise = max(0.0, noise - 0.18);` (was `- 0.5`)
3. Soften the vignette so the pattern fills more of the screen:
   - `noise *= mix(0.55, 1.0, 1.0 - length(vUv - 0.5));` — even the corners get ~55% weight instead of fading to 0.
4. Cap brightness before colorizing so nothing can saturate to white:
   - `noise = min(noise, 0.55);`
5. Slightly tighten the alpha contribution so the wider coverage doesn't make the whole screen feel heavier:
   - Keep `u_opacity` ceiling at `0.55`, but compute alpha as `noise * u_opacity * 0.9` and clamp to `0.6`.

## Out of scope
- No changes to flash behavior, cursor easing, palette, settings UI, or audio wiring.
- No changes to `palette.ts` defaults — opacity/speed defaults stay where we just set them.
- Hydration warning from the Leather browser extension is not a code issue; not touched.

## Acceptance
- The pattern is visible across the full viewport (including corners), not just a single bright cluster.
- No pure-white hot spots at default settings; everything reads as soft, tinted filaments.
- Idle motion and flash behavior unchanged from the previous pass — still slow, viscous, no jitter.
