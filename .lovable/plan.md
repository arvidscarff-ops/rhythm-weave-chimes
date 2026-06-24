# Laser Beam Visual System

Goal: rebuild every line in the Wheel, Pendulum, and Bars scenes so they read as real laser light — a hot white core, a saturated chromatic halo, atmospheric scatter, and a constant fine shimmer/glitter like the reference photos.

## Color model

Add a `laserColor` choice to the dock (Green / Red / Cyan / Magenta / Amber) stored in scene state. Each color defines three tokens used by every laser primitive:
- `core` — near-white tinted (e.g. green: `oklch(98% 0.05 145)`)
- `glow` — saturated mid (`oklch(78% 0.28 145)`)
- `haze` — deep saturated low-alpha (`oklch(55% 0.22 145)`)

Switch the page background from teal gradient to a near-black atmospheric gradient (`oklch(12% 0.02 240)` → `oklch(8% 0.01 260)`) with a faint volumetric vignette so lasers actually glow. Keep the noise grain.

## The laser primitive (canvas)

Replace every `ctx.stroke()` for rings / wheel lines / pendulum strings / bar lanes / playheads with a shared `drawLaser(ctx, path, opts)` helper that paints the same path in 4 stacked passes using `globalCompositeOperation = 'lighter'` (additive blending — this is what sells the look):

1. **Haze pass** — width ~10–14px, `haze` color, alpha 0.12, heavy blur via `ctx.filter = 'blur(6px)'`. Atmospheric scatter.
2. **Bloom pass** — width ~4–6px, `glow` color, alpha 0.45, `blur(2px)`.
3. **Beam pass** — width 1.25px, `glow` color, alpha 0.9, no blur.
4. **Core pass** — width 0.5px, `core` color, alpha 1.0. The hot white filament.

Endpoints get a radial-gradient "burn dot" (core → glow → transparent, r≈6px) so beam terminations look like the laser source/impact points in the references.

## Shimmer / glitter

Two layered animations driven from the existing RAF loop, both subtle:

- **Beam jitter**: each frame, offset the beam+core passes perpendicular to the path by `sin(t*Hz + seed) * 0.35px` and modulate core alpha by `0.85 + 0.15*noise(t)`. This is the "breathing" wobble of a real laser through air. Per-laser seed so they don't move in unison.
- **Sparkle particles**: along each visible beam, spawn 1–2 short-lived (180–320ms) bright dots per second at random arc positions. Each sparkle is a tiny additive radial gradient (r 1.5→4px) that fades out — this is the "glitter" from the moonbeam / Imagine Peace Tower reference. Cap total sparkles at ~80 globally for perf.

For trigger events (note hits) add a one-shot **starburst**: 4-point cross flare (long horizontal+vertical thin gradients, 220ms ease-out) like the green stars in the laser-field reference. This replaces the current ripple as the primary hit feedback.

## Per-scene application

- **Wheel**: rings = laser circles, radial trigger lines = laser beams extending slightly past the outermost ring with a burn dot at the tip. Center gets a small persistent core glow (the "emitter").
- **Pendulum**: pivot bar + each string drawn as laser; bob = burn dot. Zero-crossing trigger = starburst at the bob.
- **Bars**: each lane = vertical laser column; playhead = bright traveling burn dot leaving a short additive trail; bottom zigzag connector = laser polyline.

## Performance

- Offscreen canvas for the haze/bloom passes, composited once per frame, so `ctx.filter` blur isn't re-applied per primitive.
- DPR-aware (`devicePixelRatio` capped at 2) for crispness without tanking fps.
- Sparkles in a single pooled array; starbursts capped at 6 concurrent.
- Skip blur passes entirely if `prefers-reduced-motion` or fps drops below 45 (rolling average) — falls back to beam+core only.

## Files touched

- `src/styles.css` — new bg gradient, laser color CSS tokens, reduced-motion rule.
- `src/lib/visual/laser.ts` (new) — `drawLaser`, `drawBurnDot`, `drawStarburst`, sparkle pool, offscreen-bloom helper.
- `src/routes/index.tsx` — swap ring/line/pendulum/bars stroke calls to `drawLaser`; add `laserColor` to dock; trigger handlers spawn starburst+sparkles; remove ripple visuals.

No audio engine or scene logic changes — purely the render layer and one dock control.
