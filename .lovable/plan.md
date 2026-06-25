# Unified metaball orb field

## Problem
Each orb is currently drawn in its own scissored viewport, so the GLSL `smin()` only blends the 6 internal dots of that orb. Orbs can never merge with each other — they read as separate spheres no matter how close they sit.

To get the Siri "one living blob that splits and re-fuses" feel, every orb must contribute to the **same** signed-distance field in a single full-canvas pass.

## Approach
Rewrite `src/lib/visuals/siriOrbLayer.ts` so the WebGL layer is one full-viewport shader pass that consumes an array of orb instances (position, radius, energy, hue, seed) as uniforms and computes one shared SDF across all of them.

### Shader changes (`FLUID_DOTS_SHADER`)
- Add uniforms:
  - `uniform int  uCount;`
  - `uniform vec4 uOrbA[MAX_ORBS];` — `xy` = center (pixels), `z` = radius (pixels), `w` = energy
  - `uniform vec2 uOrbB[MAX_ORBS];` — `x` = hue, `y` = seed
- `MAX_ORBS = 32` (cap; if more requested, drop lowest-energy extras).
- Replace per-orb `scene()` with a global `field(fragCoord)` that:
  1. Loops `i = 0..uCount-1`.
  2. For each orb, computes its 6 inner dots in **screen space** using the existing motion vocabulary (merge cycle, scatter/return, gather/burst), scaled by that orb's radius and seeded by `iSeed = uOrbB[i].y`.
  3. Folds all dots (across all orbs) into a single `total3` via `smin(.., .., SMOOTH_K_GLOBAL)`.
- Use a slightly larger `SMOOTH_K_GLOBAL` (~0.18 in normalized units) for cross-orb welding, while keeping intra-orb dots tight.
- Cross-orb welding only activates when two orbs are within ~1.6× their combined radii (smin naturally handles this — distant orbs don't affect each other).
- Keep the chromatic aberration / spectral edge / white-hot core math, but applied to the unified field so highlights wrap the merged silhouette.
- Tint accumulator (`cAcc`) weighted per dot by that orb's hue + energy, so blended regions show a smooth hue gradient.

### Layer API (unchanged surface)
`mount/begin/place/end` keep the same signatures so `src/routes/index.tsx` needs no changes. Internally:
- `place()` pushes to an instance array.
- `end()` uploads uniforms once, draws one fullscreen triangle, then clears.
- No per-orb viewport/scissor.

### Performance
- Single draw call per frame instead of N.
- Loop bound is the constant `MAX_ORBS`; early-out via `if (i >= uCount) break;` (WebGL1 allows this with a constant max).
- Fragment cost scales with `uCount`; 32 orbs × 6 dots × 3 channels is comfortably real-time at 1× DPR cap (already in place).

### Files touched
- `src/lib/visuals/siriOrbLayer.ts` — full rewrite of shader + `end()`; public API unchanged.

No changes to `src/routes/index.tsx` or any scene code.

## Result
Nearby orbs (e.g. two notes on adjacent rings, or a cluster on the Bars scene) visibly stretch, neck, and fuse into a single chromatic blob with one continuous glow — matching the Siri reference's "living shape" behavior. Solo orbs still look identical to today.
