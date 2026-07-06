# Fire sparks: streaks + noisy edges

## Why they came out as orbs

The reference shader encodes spark shape in three lines I skipped:

1. **`PARTICLE_SCALE = vec2(0.5, 1.6)`** — anisotropic distance metric → ellipse, ~3× taller than wide.
2. **`rotate(tempUV - pointUV, 0.7)`** — rotates the ellipse ~40°.
3. **Two `noise2_2` UV perturbations** applied to `tempUV` — jitters the coordinates fed into the distance calc, which is what gives the sparks their crackly/wispy silhouette instead of a clean gradient.

My rewrite used `createRadialGradient` circles, which is rotationally symmetric by construction. No aspect ratio, no rotation, no noise → orbs.

## What to build

Each spark = a **motion streak with a noisy, feathery silhouette**.

**Shape (streak):**
- Draw each particle as an ellipse whose long axis aligns with its velocity vector.
- Long-axis length scales with speed and shrinks as the spark dies; short axis stays small. Head-heavy (bright leading tip, soft trailing tail).
- Implemented in Canvas2D by translating to the particle, rotating by `atan2(vy, vx)`, non-uniform scaling, then stamping a pre-baked sprite.

**Texture (noisy edges):**
- Generate one offscreen 128×64 "spark sprite" once per layer using value-noise on a CPU (small, cached) — a bright core with feathered, crackly edges. Colored white; we tint it at draw time via `globalCompositeOperation` + a colored overlay, or by using multiple pre-baked sprites in white and letting additive blending pick up the tint from a second colored ellipse pass.
- Simpler concrete plan: bake a single grayscale RGBA sprite where alpha = `radialFalloff * (0.6 + 0.4 * valueNoise)`. At draw time, set `ctx.fillStyle` to the tint color, draw a filled rect, then use `globalCompositeOperation = "destination-in"` with the sprite. Or use `drawImage` of the sprite followed by a tinted `source-atop` pass on a small offscreen buffer.
- To avoid per-particle offscreen buffers, bake **three sprites at spawn-layer init**: a "hot" (white-yellow), "warm" (orange), and "cool" (deep red) variant. Pick the one closest to the particle's current life-t and draw with additive blend. Cheap, produces the color ramp implicitly, and keeps all noise texture without per-frame offscreen work.

**Trail feel:**
- The streak IS the trail — no separate trail primitive needed. Length ≈ `speed * 0.06s`, clamped, so fast sparks feel like short comet tails and slow/dying sparks compress back into a dot.

## Physics tweaks (small)

- Slightly lower drag so sparks travel visible distances before slowing (needed for the streak to read).
- Slightly higher wobble amplitude so trajectories curve more, matching the reference's "meandering" feel.

## Files to change

- `src/lib/visuals/fireShaderLayer.ts` — replace radial-gradient blob draw with:
  - one-time sprite baking (3 pre-tinted noisy-ellipse sprites, ~128×64) in `createFireLayer`
  - per-particle transform + `drawImage` in `render`
  - keep the halo pass as a large soft radial gradient for the bloom (that part reads correctly and matches the reference `distBloom` term)

No API changes; no callers touched.

## Verification

Playwright: navigate to `/studio/builder`, select the fire-spark visual, trigger notes, screenshot at t≈0.1s / 0.4s / 0.8s. Confirm elongated streaks fanning outward with visibly non-circular, textured silhouettes, cooling from white-yellow → orange → red.

## Why streaks + noisy edges from a shader don't "just work" in Canvas2D

The shader gets its look almost for free: every pixel independently evaluates a distance-to-ellipse plus noise, so shape and texture emerge from math. Canvas2D has no fragment programmability, so the equivalent is baking that math into a bitmap once and stamping the bitmap with transforms. That's the whole gap — the reference logic is intact, it's just moved from per-pixel GPU eval to per-particle CPU stamping.
