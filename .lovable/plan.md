
# Plan: Replace particle bursts with wispy "light bloom" explosions

The current bursts read as a ring of distinct spheres flying outward. Replace that look with a single coherent flash that feels like a soft pulse of light blooming and dissolving — closer in spirit to the Siri fluid-dots reference (luminous, chromatic, wispy) than to a particle starburst.

## What replaces the current burst

Each note trigger spawns **one composite "bloom" event** (not 14+ separate particles), made of three layered, additive elements that all share the same lifetime and color:

1. **Core flash** — a small bright disc with chromatic-aberration RGB offset (~1–2 px split). Snaps in over ~80 ms, decays over ~250 ms. This is the "ignition."
2. **Halo bloom** — a wide soft radial gradient (3–5× the visual size of the trigger element). Eases in over ~120 ms, expands ~1.4× while fading over ~700–900 ms. Iridescent center → transparent edge, using the phosphor `cos(s+vec4(0,1,8,0))` palette.
3. **Wisps** — 5–7 curved tapered streaks (not dots), drawn as short bezier paths with a soft additive stroke that **tapers to zero at both ends**. Each wisp starts near the center, curls outward along a noisy tangent, and dissolves. Length grows then alpha fades, so they read as drifting smoke/light filaments rather than projectiles. No visible heads.

Together this gives the impression of light *exhaling* from the trigger point — bright at t=0, soft and dispersed by t=900 ms.

## Why this reads as "light", not "particles"

- No more uniformly-sized round sprites flying out radially.
- The halo always dominates the silhouette — wisps live *inside* the halo's glow, not outside it.
- Wisps are tapered strokes, so they have no recognizable "ball" shape.
- Everything shares one color hue per burst → reads as one event, not a swarm.
- Drawn with `globalCompositeOperation = "lighter"` and per-layer `filter: blur(...)` on an offscreen pass for the halo, so edges are diffuse rather than crisp.

## Implementation

- Rewrite `src/lib/visuals/burstField.ts`:
  - Replace particle pool with a small **bloom pool** (cap 10 concurrent blooms). Each bloom stores center, hue, energy, age, maxAge, and a small fixed array of wisp seeds (angle, curl, length, phaseOffset).
  - `spawnBurst(x, y, { hue, energy })` API stays the same — index.tsx wiring is unchanged.
  - `updateBursts(dt)` advances age; `drawBursts(ctx)` renders core → halo → wisps in order, all additive.
  - Wisps drawn via `ctx.beginPath()` + quadratic curve, with `lineWidth` interpolated along life and a tapered `globalAlpha` envelope (in-out cubic).
  - Respect `prefers-reduced-motion`: halo only, no wisps.
- No changes to scenes, audio, or the NeuralNoise background.

## Tuning targets

- Total bloom lifetime: ~0.9 s (vs current ~0.7 s of particles).
- Peak brightness clamped so dense polyrhythms don't blow out — halo alpha cap ~0.55, core cap ~0.85.
- Wisp count scales 4 → 7 with note energy; never more.
- Cap 10 concurrent blooms; over-cap blooms age out faster.

## Out of scope

- No new WebGL surface (the Siri reference uses WebGL, but we already have one heavy WebGL layer — NeuralNoise — and this effect needs pixel alignment with the 2D scene). The 2D additive approach above replicates the *look* without the GPU cost.
- No changes to ring/bob/bar trigger geometry, audio routing, or dock.
