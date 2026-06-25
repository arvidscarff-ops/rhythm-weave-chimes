## Goal

Replace the current radial-gradient orb with a faithful port of the SiriWave **fluid-dots** look so every note dot reads as a small cluster of breathing light particles rather than a soft blob. Bump base radius ~40% so they're visibly bigger.

## What changes

Only `src/lib/visuals/orbDot.ts`. All call sites in `src/routes/index.tsx` keep the same `drawOrb(ctx, x, y, opts)` signature — nothing else moves.

### New rendering model (fluid-dots)

For each orb:

1. **Dot cluster (the signature look)** — render N ≈ 14 small soft dots arranged on a ring of radius `R`, each offset by a per-dot sinusoidal wobble so the ring breathes asymmetrically:
   - `angle_i = i * TAU/N + phase + t * 0.35`
   - `r_i = R * (1 + 0.18 * sin(t * 1.2 + i * 1.7 + phase))` (organic in/out)
   - dot radius `≈ R * 0.32`, drawn as a white-hot radial gradient tinted with the voice color at the edge
   - additive blending; opacity per-dot modulated by `0.55 + 0.35 * sin(t*0.9 + i)`
2. **Inner counter-rotating ring** — a second smaller ring (N ≈ 8, radius `R*0.55`) rotating the opposite direction at half speed, for the classic Siri "liquid" interference.
3. **Soft core glow** — a single white-hot radial gradient at the center (`R*0.45`) so the cluster reads as one luminous orb when zoomed out.
4. **Halo** — keep the existing wide colored halo, but thinner (alpha ~0.05) so the dots remain the dominant feature.
5. **Trigger flash** — on `energy > 0`, expand `R` by `energy * 5`, brighten core, and pulse dot opacity. No new bloom layer needed; the cluster itself swells.

### Sizing

- Default `radius` constant inside `drawOrb` lifted from current `~4` baseline to `~5.5` (≈ +40%).
- Cluster outer extent ≈ `radius * 1.6`, so visual footprint grows noticeably without callers changing their `radius` arg.

### Color

- Keep `colorTpl` / `hueToOrbTpl` API unchanged.
- Dots: white core → voice-color edge (so they still feel "of the ring").
- Remove the chromatic R/G/B aberration triad — Siri fluid-dots is monochromatic per orb; chromatic split fights the cluster read.

## Out of scope

- No changes to scenes, triggers, audio, burst field, or shader background.
- No new files, no new deps.

## Validation

- Visual check on all three scenes (Wheel, Pendulum, Bars) via preview.
- Confirm orbs are visibly larger and clearly cluster-shaped when paused, still readable as single points of light when many are active.
