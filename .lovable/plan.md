# Color modes + red-ember fix

## Bug: cinders always red

The cooling-ember afterglow is hardcoded `mix(200,60,k)` red → smoke, ignoring `c.tint`. That's the red you saw on a blue burst. Fix by deriving the cinder color from the particle's own tint (deep saturated version → dim smoke of same hue).

## New: color modes

Add a `colorMode` field to `fireSpark` config with three options:

1. **Single** (current) — every spark uses `tint`.
2. **Rainbow** — each spark gets a random hue at spawn; even distribution around the color wheel. Same saturation/value as tint so it stays fiery, not neon.
3. **Palette** — each spark picks from a small user-defined palette (default: a warm sunset ramp red→orange→yellow, but user can add/remove/reorder colors). Selection is either random or sequential (spark index modulo palette length).

Extend `tint` to serve as the anchor for Single mode; add a `palette: string[]` array (2–8 hex colors) used in Palette mode.

## Implementation

- `pathTransformer.ts`: add `colorMode: 'single'|'rainbow'|'palette'`, `palette: string[]`, `paletteMode: 'random'|'sequential'` to the fireSpark config. Clamp/validate on load.
- `fireShaderLayer.ts`:
  - Extend `FireSpawnOpts` with `colorMode`, `palette` (as `[r,g,b][]` in 0..1), `paletteMode`.
  - In `spawn`, decide each particle's tint:
    - single → `opts.tint`
    - rainbow → HSV(random 0..1, sat=0.85, val=1.0) → rgb01
    - palette → pick per `paletteMode`
  - Also assign per-particle tint to reactive-glow and cinder from the *particle's own tint* rather than the burst tint.
  - Fix cinder color ramp to derive from `c.tint` (start ~90% saturated dark version, end near-black smoke).
- `customScene.ts`: pass new fields through.
- `studio.builder.tsx`:
  - Add a **Color mode** segmented control (Single / Rainbow / Palette).
  - Under Palette: a mini-editor — list of color swatches with add/remove buttons + a small radio for Random/Sequential.
  - Keep the existing single `Tint` color picker but only show it in Single mode; disable/hide in others.

## Files

- `src/lib/engine/pathTransformer.ts` — config type + defaults + validation
- `src/lib/visuals/fireShaderLayer.ts` — spawn logic, cinder tint fix, per-particle color assignment
- `src/lib/scenes/customScene.ts` — plumb config into `spawnFire`
- `src/routes/studio.builder.tsx` — mode segmented control + palette editor UI

## Defaults

- `colorMode`: `single` (backward-compatible — existing presets look the same)
- `palette`: `["#FF3B00", "#FF8A2B", "#FFD447", "#FF66C4", "#4DA6FF"]`
- `paletteMode`: `random`

## Verification

Set colorMode=rainbow, trigger bursts, confirm each spark is a distinct hue and cinders match. Set to palette with all-blues, confirm no orange/red leaks (regression on the bug).
