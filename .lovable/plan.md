## Fixes & upgrades to the Scene Builder

### 1. Fix missed triggers on vertical/horizontal line

`pathCrossings` in `src/lib/engine/pathTransformer.ts` samples with `stepDt = lapDuration / 64`. When the lap is long (slow tracks or short scan windows in `draw()`), the sampling loop can skip the entire `(t0, t1]` window and miss a crossing entirely.

- Cap `stepDt` to at most half of `(t1 - t0)` and to a small absolute (e.g. 8 ms) so crossings are detected reliably on every frame, for both audio (`eventsIn`) and visuals (`draw` detection loop).
- Always seed the loop by evaluating at `t1` so a single-sample window still checks sign change.

### 2. Supercharged particle editor

Expand `AestheticConfig.burst` in `pathTransformer.ts` (with backward-compatible defaults in `validateBlueprint`) and rebuild the Burst tab UI plus the render loop in `customScene.ts`.

New burst controls:
- Shape: `dot | ring | spark | streak | glow`
- Emission: `count`, `angleSpreadDeg` (0–360, default 360), `directionDeg` (0–359)
- Motion: `baseSpeed`, `speedVariance` (0–1), `drag`, `gravity` (px/s², signed)
- Life: `lifespanMs`, `lifespanVariance` (0–1)
- Size: `sizeStartPx`, `sizeEndPx`, `sizeVariance`
- Color: `colorMode` (`palette | fixed | rainbow`), `fixedColor`, `opacityStart`, `opacityEnd`
- Blend: `blendMode` (`lighter | source-over`)
- Trail: `trailLength` (0 = disabled, 1–12 = motion blur segments)

Fix the "particles stay forever" bug: in `updateParticles`, integrate with real `dt` (from `now - lastTime`) instead of the hardcoded `0.016`, and reap any particle whose `age >= life` OR whose alpha reaches 0. Add a global hard cap and a per-frame emission cap.

Rewrite `spawnBurst` and `drawParticles` to honor the new fields (angle spread around direction, size interpolation, gravity, blend mode, optional trail via previous-position ring buffer).

### 3. Play/Pause on preview

Add a `playing` state to `BuilderPage` (default true) with a Play/Pause button overlaid on the preview canvas (top-right, next to the existing expand button, also mirrored in theater mode). When paused, the RAF loop still ticks but skips advancing `globalTime` and skips `customScene.draw`, so the last frame is preserved. Also freeze particle time by not advancing `now`.

### 4. Line color override + universal transparency

Extend `AestheticConfig.palette`:
- New optional `lineColor?: string` (hex) and `lineColorEnabled: boolean`. When enabled, `customScene` wireframe strokes use this solid color (all tracks) regardless of gradient/preset. Note orbs and pulses still follow the gradient/preset.
- New `lineOpacity` (0–1, default 0.22) replacing the hardcoded stroke alpha.

Add transparency sliders (0–1) to every visual section in the Builder that currently lacks one:
- Background: already has `opacity` ✓
- Notes: new `noteOpacity` (multiplies orb alpha) + `glowOpacity`
- Trails: already `decay` (leave; it controls trail persistence) — add `trailTint` alpha via existing decay
- Palette: new `lineOpacity` (above)
- Burst: `opacityStart` / `opacityEnd` (above)
- Path Pulse: new `pulseOpacity`
- Climax: new `flashOpacity` and `stardustOpacity`

All new fields default to current visual values so existing presets look identical.

### Files touched

- `src/lib/engine/pathTransformer.ts` — sampling fix in `crossings`; expanded `AestheticConfig` types + `validateBlueprint`/`mergeAesthetic` defaults.
- `src/lib/scenes/customScene.ts` — dt-based particle update; new burst renderer with shapes/gravity/trails; line-color override; opacity fields applied to wireframe/orbs/pulses/climax/stardust.
- `src/routes/studio.builder.tsx` — Play/Pause button; RAF gated by `playing`; rebuilt Burst tab; Palette tab gets "Line color" toggle + color picker + line-opacity slider; new opacity sliders in Notes/Pulse/Climax; no change to preset storage shape beyond the additive fields.

### Non-goals

- No changes to audio scheduling, pack routing, or the 8 built-in engines.
- No new preset storage location; still LocalStorage, additive schema.

### Verification

- Preview: choose Axis intersect → Vertical line, watch the note crossing produce a burst on every pass.
- Toggle Line color on Palette and confirm wireframes turn a single color while orbs keep the gradient.
- Set high burst count + long lifespan, then reduce them — old particles clear within their new lifespan and no ghost particles linger.
- Play/Pause halts and resumes the preview cleanly.