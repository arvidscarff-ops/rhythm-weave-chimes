# Fix fire sparks: per-particle meandering embers

## What's wrong now

The current `fireShaderLayer.ts` treats each note trigger as **one big fireball** — one emitter fills a whole voronoi-tiled disc with hundreds of static sparks + orange smoke. That's why your screenshot shows a giant crackling orange blob instead of a handful of tiny embers flying out.

The reference shader's "fire sparks" are actually **individual small streaks** — each one is a single glowing dot with a soft bloom, drifting along its own curved trajectory, shrinking and fading as it ages.

## What to build instead

One trigger → spawn N tiny spark particles (default ~15), each with:
- its own emission angle (spread around an upward-biased cone)
- its own initial velocity
- gravity + drag + a small curl-noise wobble → produces the "winding path"
- size and alpha both decay to zero over its lifetime
- warm gradient tint (white-hot core → orange → deep red as it cools)
- soft additive bloom halo

## Approach

Rewrite `fireShaderLayer.ts` as a **CPU-simulated particle system** rendered on a 2D canvas with additive blending. This is the right tool: dozens of independent trajectories with per-particle physics are awkward in a single fragment shader but trivial in JS, and the visual density we need (~15–30 particles per burst, a few bursts on screen) is well within Canvas2D budget.

Keep the public API identical (`createFireLayer`, `spawnFire`, `hexToRgb01`, `FireSpawnOpts`) so `customScene.ts` and `pathTransformer.ts` don't change. Reinterpret the existing opts:
- `intensity` → particle count multiplier (e.g. `round(8 + intensity * 6)`) and brightness
- `size` → base spark radius + initial speed scale
- `life` → max particle lifetime (with per-particle jitter)
- `tint` → warm color the sparks cool toward

Per frame:
1. Integrate each particle (velocity += gravity·dt + curlNoise·dt; pos += velocity·dt; velocity *= drag)
2. Compute `t = age/life`; radius = `r0 * (1 - t)`; alpha = `(1 - t)^1.5`
3. Draw a radial gradient sprite (white core → tint → transparent) with `globalCompositeOperation = "lighter"`
4. Reap when `t >= 1`

Overlay canvas stays absolutely-positioned inside the scene parent, `mix-blend-mode: screen`, pointer-events none — same as today.

## Files to change

- `src/lib/visuals/fireShaderLayer.ts` — full rewrite (WebGL2 → Canvas2D particle system). Keep exports and signatures.
- No changes needed in `pathTransformer.ts`, `customScene.ts`, `studio.builder.tsx`, or `__root.tsx`. Existing slider ranges (life 0.3–3s, size 0.05–0.6, intensity 0–6) map cleanly onto the new interpretation.

## Out of scope for this pass

- Background smoke (item 1 in your list). The reference smoke is a separate large-scale layered noise field; I'll leave the current subtle warm glow off and we can add a dedicated smoke pass afterwards if you want it. Focus this turn on getting the sparks right.

## Verification

After the rewrite, run a Playwright script that navigates to `/studio/builder`, selects the fire-spark visual, triggers a note, and screenshots the overlay canvas at t≈0.2s and t≈0.8s. Confirm visually: distinct point-like sparks with trails/bloom fanning outward, shrinking and fading, not one solid disc.
