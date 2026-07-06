## Why the sparks are invisible

The original Shadertoy shader is a full-screen fire field: `uv = fragCoord/iResolution` gets multiplied by a scale factor before `layeredParticles`, producing dozens of voronoi cells across the screen with each spark sized `PARTICLE_SIZE = 0.009` in that scaled UV space.

In `src/lib/visuals/fireShaderLayer.ts` I localized the shader per-emitter but only did `uv *= 1.8` inside `sampleFire`. Consequences:

- Burst UV spans roughly `[-1.4 .. 1.4]` → after `*1.8`, ~4 voronoi cells total across the whole burst.
- Half of those cells are hidden by the built-in `appear`/`disappear` vertical masks (which key off `originalUV.y`, itself now a tiny range).
- Each spark is `PARTICLE_SIZE = 0.009` in a UV that spans ~3 units → ~0.3% of the burst diameter → sub-pixel on a 200-ish px burst.
- The final `smoothstep(-0.08, 1.0, col)` crushes the already-faint values to near zero.

Net effect: the layer runs, the additive blend happens, but every fragment is ~0.

## Fix

Rework `sampleFire` and the per-fragment loop in the fragment shader only. No API/type changes; existing spawn calls, blueprint schema, and builder UI stay as-is.

### 1. Scale UV into the shader's "screen" space

- After computing local `uv = duvPx / sizePx` (still `[-1..1]` across the burst radius), pass it into `sampleFire` and inside there do `uv *= 12.0` (tunable constant `FIELD_SCALE`) so the voronoi grid gets ~24 cells across the burst instead of ~4.
- Feed `originalUV = uv * 0.5 + 0.5` into `layeredParticles` so `appear`/`disappear` operate on a `[0..1]` band across the burst height, matching the original shader's expectation.

### 2. Enlarge sparks so they're visible at burst scale

- Multiply `PARTICLE_SIZE` by `2.5` when used inside the localized burst (either by redefining a local `pSize` in `fireParticles` or by adding a `sizeBoost` uniform-less constant). Keeps voronoi structure but the sparks themselves are 5–8 px each on a 250 px burst.
- Boost bloom radius proportionally (`PARTICLE_SIZE * 12.0` for the bloom smoothstep).

### 3. Increase layer count and remove crushing

- Bump `LAYERS_COUNT` from `4` to `6` — cheap given 16 emitters cap, and the original uses 15.
- Drop the final `smoothstep(-0.08, 1.0, col)` inside `sampleFire` (it exists in the original to compress a full-screen haze; here it just kills faint sparks). Keep the additive envelope/falloff/intensity multiplication in `main`.

### 4. Tighten envelope so bursts actually flash

- Change envelope to `smoothstep(0.0, 0.04, lifeT) * (1.0 - smoothstep(0.4, 1.0, lifeT))` — sharper attack, so first frame after spawn already reads bright.

### 5. Raise defaults so the effect is obviously visible on first use

In `src/lib/engine/pathTransformer.ts`:
- `fireSpark` defaults change from `{ life: 1.6, size: 0.22, intensity: 1.2, tint: "#FF8A2B" }` to `{ life: 1.4, size: 0.28, intensity: 2.0, tint: "#FF8A2B" }`.

### 6. Verification

After the edit, load `/studio/builder`, pick **Fire spark (shader)** in the Burst tab, and confirm in the preview iframe that visible orange sparks appear at every note crossing. If sparks are still absent, check `console` for `[fireShaderLayer] shader compile failed` or `link failed` messages (both already logged) and fix the reported line.

## Technical scope

Files touched:

- `src/lib/visuals/fireShaderLayer.ts` — fragment shader body only: local `pSize`, uv scale, `LAYERS_COUNT`, envelope, remove final smoothstep. No JS API change.
- `src/lib/engine/pathTransformer.ts` — defaults for `fireSpark` (life/size/intensity).

No changes to:
- `src/lib/scenes/customScene.ts` (spawn path is correct — px + scene time)
- `src/routes/studio.builder.tsx` / `src/routes/index.tsx` (mount + rAF are correct)
- Blueprint schema, slider ranges, tint picker.
