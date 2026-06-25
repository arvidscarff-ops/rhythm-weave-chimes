
# Plan: Organic, seeded bursts that share DNA with the NeuralNoise background

Make every burst feel like a tiny pocket of the background shader — domain-warped, iridescent, and uniquely shaped — instead of a deterministic halo+wisp template.

## Core idea: seed-driven noise blooms

Each burst gets a **unique random seed** that drives every visual parameter, so no two ever look alike. The seed feeds a small procedural noise field rendered into an offscreen sprite, then blitted additively over the trigger point. That sprite is the visual cousin of the NeuralNoise background — same palette, same domain-warp recipe — just compressed into one flash.

## What each burst looks like

1. **Noise-cloud sprite (new, primary layer)**
   - Rendered once per burst into a small offscreen canvas (~96×96 px, scaled up to burst size).
   - Each pixel: 2-octave value noise with **domain warp** — `noise(p + noise(p + seed))` — to produce the same writhing, ink-in-water filaments the shader has.
   - Threshold + soft contour so it reads as wisps/filaments, not a flat blob.
   - Colorized with the phosphor `cos(s+vec4(0,1,8,0))` palette, hue rotated by seed.
   - The sprite is **animated for ~3 frames** at spawn (warp offset advances), then frozen — gives an organic "settle" without re-rendering every frame.
   - Drawn additively, scaled and rotated by seed, expanding ~1.3× and fading over the bloom's life.

2. **Core flash** — kept, but chromatic offset and brightness are now seed-modulated (different RGB split per burst).

3. **Halo** — kept, but radius, eccentricity (slight x/y stretch), and hue rotation jitter per seed so silhouettes vary.

4. **Wisps removed** — the noise-cloud sprite replaces them with organically curling filaments that look hand-drawn rather than parametric.

## What "seeded uniqueness" produces

Per burst, the seed controls:
- Palette phase (hue rotation 0..2π) and saturation tilt
- Noise warp offset, scale (0.8–1.4×), and rotation
- Halo eccentricity (1.0–1.25 stretch) and orientation
- Lifetime jitter (±15%)
- Filament density via noise threshold
- Asymmetric center offset (a few px) so the brightest point isn't always the geometric center
- Chromatic core offset direction

This makes dense polyrhythms feel like a constellation of distinct embers rather than one repeating effect.

## Tie-back to the NeuralNoise background

- Same palette recipe (phosphor cosine) — bursts read as "light pulled from the background field."
- Same domain-warp noise topology — bursts and background share visual grammar.
- Burst color hue is biased by the active NeuralNoise palette preset (Aurora/Lagoon/etc.) so they always harmonize with the current background. (Read once from `getNeuralSettings()`.)

## Implementation

- `src/lib/visuals/burstField.ts`:
  - Add `mulberry32(seed)` PRNG and a small value-noise + domain-warp routine.
  - Per bloom, allocate a tiny `OffscreenCanvas` (fallback: `document.createElement('canvas')`) sized 96×96. Render the warped noise field once at spawn, write to RGBA via `ImageData`.
  - Store the sprite on the bloom; reuse on every draw frame (just scale/alpha-modulate).
  - Remove wisp-stroke path; keep core flash + halo with seed-driven jitter.
- `src/lib/visuals/burstField.ts` imports `getNeuralSettings()` from `@/lib/neural/palette` to derive a hue bias.
- API (`spawnBurst`, `updateBursts`, `drawBursts`) unchanged → no changes in `src/routes/index.tsx`.

## Performance

- Offscreen render: 96×96 = ~9k pixels, done once per spawn. Cap 10 blooms → at most 10 sprite renders per ~second under heavy play.
- Per-frame draw cost is just `drawImage` + halo gradient + core gradient — cheaper than the current per-segment wisp strokes.
- Reduced-motion: skip sprite, keep halo only.

## Out of scope

- No new WebGL surface; sprites stay 2D-canvas to preserve pixel alignment with the scene.
- No change to audio, scenes, neural background, or dock.
