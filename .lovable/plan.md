# Award-tier fire sparks — mesmerizing polish

The current Canvas2D pipeline is already crisp. To push it into "eye candy" territory we go beyond drawing better shapes — we add **physically-motivated post-processing** and **environmental interaction**. Ranked by impact-per-effort.

## Tier 1 — Transformative (do these)

### 1. Real bloom post-process

The single biggest visual jump. Right now "glow" is a dim halo gradient. A true bloom (bright-pass → separable Gaussian blur → additive composite) makes hot cores bleed light into the surrounding dark, which is how real fire reads on camera.

- Switch the fire canvas to **WebGL2** (or add a second offscreen WebGL canvas above the Canvas2D one).
- Render sparks to an HDR-ish float texture, then bright-pass threshold ~0.7, blur at 3 mip levels (1×, 1/2×, 1/4×), composite back with tunable `bloomStrength` and `bloomRadius`.
- Fallback path: keep Canvas2D with a cheap fake bloom via `ctx.filter = 'blur(6px)'` on a bright-only copy — 60% of the look, zero WebGL work.

### 2. Curl-noise turbulence field

Sparks currently meander via per-particle sinusoids — nice, but every spark meanders in isolation. A shared **curl-noise velocity field** (2D simplex noise, take the curl → divergence-free flow) makes nearby sparks swirl *together* in visible eddies and gusts, like heat rising through disturbed air. This is the "alive" factor.

- One noise field, sampled per particle per frame at `(x*scale, y*scale, t*flowSpeed)`.
- Expose `turbulence` (0–2) and `windY` (upward bias) sliders.

### 3. Motion-blur trails (persistence buffer)

Instead of clearing the canvas each frame, fade the previous frame by ~92% and draw on top. Fast sparks leave true light streaks; slow embers barely trail. This is what makes long-exposure fire photos gorgeous.

- One-line change: replace `clearRect` with `fillRect` at `rgba(0,0,0,0.08)` using `destination-out` composite.
- Expose `trailPersistence` (0–0.98).

### 4. Ember afterglow / cooling embers

When a spark's life ends, don't just vanish — spawn a **long-lived dim red ember** at that position that slowly drifts down and fades over 2–4s. Real sparks leave a trail of cooling cinders behind the leading burst.

## Tier 2 — Sensory richness

### 5. Chromatic aberration on hot cores

The white-hot nucleus splits into faint R/G/B offsets (~1px). Makes the brightest points feel over-exposed on a lens. Cheap: draw the nucleus 3 times with small offsets in pure red, green, blue additive.

### 6. Heat-shimmer distortion above sparks

A subtle screen-space displacement above each burst zone (sample a slow noise, offset pixels by 1–3px vertically). Sells the "hot air rising" effect. Requires WebGL pass (piggybacks on bloom pipeline).

### 7. Anisotropic streaks for fast sparks

Fast-moving sparks currently stretch, but the trail still fades symmetrically. Add a **velocity-aligned motion smear** — an elongated tail gradient whose length = `speed * dt * N` — so fast embers become true streaks and slow ones stay orb-like. Speed-dependent character.

### 8. Sub-particle "crackle" bursts

Occasionally (1–3% per frame per spark), a spark **pops** — spawns 4–6 tiny ash flecks in a small radial burst with a brief flash. Reads as micro-explosions inside the fire, like real crackling logs.

## Tier 3 — Environmental integration

### 9. Reactive lighting on surroundings

Sparks cast a warm additive glow onto the scene background near them — a soft, animated vignette centered on the burst that tints the underlying UI orange briefly. Makes the fire feel *part of* the app, not overlaid on it.

- One large blurred additive gradient per active burst, drawn under the sparks.

### 10. Audio-reactive intensity (if audio available)

If the scene has music/beat data, briefly spike `intensity`, `speed`, and bloom on beats. Turns bursts into a synchronized fireworks show.

### 11. Depth parallax with two spark planes

Split sparks into **foreground** (large, sharp, fast) and **background** (small, blurred, slower). The two planes drift at slightly different rates. Adds depth without 3D.

## Tier 4 — Micro-polish that pros notice

- **Gamma-correct additive blending** — accumulate in linear space, gamma-encode on output. Highlights stop looking muddy.
- **Temporal jitter** — 2× the current 0.5px sub-pixel jitter with a blue-noise pattern instead of sin; kills any residual aliasing.
- **Slight color-temperature-driven halo hue** — hot cores glow bluish-white in the halo, cooling embers glow deep red. Halo hue ≠ core hue.
- **Randomized birth flash** — first 40ms of a spark's life is 1.4× brighter and 20% larger, then settles. Reads as ignition.

## Recommended build order

1. **Persistence-buffer trails** (30 minutes, huge payoff)
2. **Curl-noise turbulence** (1 hour, "alive" moment)
3. **Cheap Canvas2D fake bloom** via `ctx.filter blur` on a bright copy (30 minutes)
4. **Cooling-ember afterglow** (30 minutes)
5. **Reactive lighting glow under sparks** (20 minutes)
6. **Birth-flash + randomized ignition** (10 minutes)
7. If we want more: promote fire canvas to **WebGL2** and add real HDR bloom + heat shimmer + chromatic aberration.

Everything gets sliders in the Fire Spark panel so the user can dial the drama.

## Files to edit

- `src/lib/visuals/fireShaderLayer.ts` — main render loop, add persistence buffer, curl noise, afterglow, birth flash, fake bloom
- `src/lib/engine/pathTransformer.ts` — extend `fireSpark` config with new fields, defaults, clamps
- `src/lib/scenes/customScene.ts` — pass new fields through to `spawnFire`
- `src/routes/studio.builder.tsx` — new sliders (Trail, Turbulence, Bloom, Afterglow, Wind, Glow)
- (Tier 3+ only) new `src/lib/visuals/fireBloomWebGL.ts` for real HDR bloom

## Question before I build

Do you want me to:

- **A)** Ship Tier 1 + Tier 2 in one pass (persistence trails, curl noise, fake bloom, afterglow, chromatic core, birth flash, reactive glow) — biggest visible jump, all Canvas2D, ~1 file mostly
- **B)** Go full WebGL2 rewrite with true HDR bloom + heat shimmer + all Tier 1–3 — the "award" version, bigger change
- **C)** Pick specific effects from the list above  
  
USER NOTE: B please
  &nbsp;