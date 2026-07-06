# Fire-Spark Shader — WebGL Overlay Burst Shape

Port Jan Mróz's Shadertoy fire-spark effect (CC BY 3.0) into the app as a new burst shape that spawns on note triggers, running through a WebGL2 layer stacked over the existing Canvas2D scene.

## Why an overlay (not a replacement)

The shader is a full-screen fragment shader — it computes fire everywhere, every frame. Our current bursts are per-particle Canvas2D. Rather than force one into the other, we run **both pipelines side-by-side**:

- Canvas2D layer: notes, tracks, pulses, existing `dot/ring/spark/streak/glow` bursts, stardust, climax flash — unchanged.
- WebGL2 layer: stacked on top, transparent by default, additively blended, renders the fire shader only where active emitters exist.

Both live in `/` (player) and `/studio/builder` (preview).

## Rendering model

The original shader is ambient — it fills the whole screen with a rising fire field. To make it react to note triggers, we mask the shader by **per-emitter locality + lifetime**:

- Each note trigger spawns a `FireEmitter { x, y, birthTime, life, intensity, tintR, tintG, tintB, size }`.
- The fragment shader receives up to `MAX_EMITTERS` (32) emitters as a `uniform vec4[]` (two arrays: position/time, and color/size/life).
- Per pixel, we loop emitters, transform screen coords into each emitter's local UV, run the ported fire logic, multiply by a radial spatial falloff and a time-based envelope (fast attack, slower decay), and accumulate additively.
- After lifetime elapses, emitter slot is freed (ring buffer).

This preserves the *visual character* of the shader (voronoi sparks, layered particles, smoke wisps, bloom) while making it trigger-reactive and localized.

## Files

### New

- **`src/lib/visuals/fireShaderLayer.ts`** — Module owning:
  - A `HTMLCanvasElement` (WebGL2 context, `premultipliedAlpha: false`, `alpha: true`).
  - Vertex shader (full-screen triangle) + fragment shader (ported GLSL, adapted to WebGL2 GLSL ES 3.00: `#version 300 es`, `precision highp float`, `in`/`out` instead of `varying`, `texture()` — no textures needed here).
  - `mount(parent)` / `unmount()` / `resize(w, h)`.
  - `spawn(x, y, timeSec, opts)` — writes into next free emitter slot.
  - `render(timeSec)` — uploads emitter uniforms, clears with `(0,0,0,0)`, blends `SRC_ALPHA, ONE`, draws fullscreen tri.
  - Author attribution comment at top: `// Fire shader ported from Jan Mróz (jaszunio15) — Shadertoy wl2Gzc — CC BY 3.0`.

### Edited

- **`src/lib/engine/pathTransformer.ts`** — Extend `AestheticConfig.burst.shape` union to include `"fireSpark"`. Add optional `fireSpark: { life: number; size: number; intensity: number; tint: string }` sub-config with defaults matching the shader's warm orange.

- **`src/lib/scenes/customScene.ts`** — In the trigger-scan block inside `draw()`, when `A.burst.shape === "fireSpark"`, call `fireShaderLayer.spawn(px.x, px.y, t, {...})` **instead of** `spawnBurst` (Canvas2D bursts skipped for that shape). Everything else (pulses, note glow, climax) still runs.

- **`src/routes/index.tsx`** — Mount `fireShaderLayer` as a sibling canvas over the scene canvas, drive `resize` from the same size effect, and call `render(t)` inside the existing rAF loop (same `t` as the Canvas2D draw, so speeds match).

- **`src/routes/studio.builder.tsx`** — Same mount pattern inside the preview container, using the preview's scaled `t` (`t * PREVIEW_SPEED`) so preview and player look identical. Unmount on component teardown.

- **Builder UI (in `studio.builder.tsx` burst panel)** — Add `"fireSpark"` to the shape dropdown. When selected, show a small sub-panel: Life (0.5–4s), Size (0.5–3×), Intensity (0–2), Tint color picker. Hide the Canvas2D-only fields (drag/gravity/trailLength) for this shape since the shader owns its own motion.

## Technical notes

- **GLSL adaptation**: The pasted `mainImage` code is kept largely intact inside a helper `vec3 sampleFire(vec2 uv, float iTime)`. The `main()` we write loops emitters, computes per-emitter `uv = (fragCoord - emitter.xy) / (emitter.size * iResolution.x)`, calls `sampleFire`, multiplies by `radialFalloff(length(uv)) * lifeEnvelope(age/life) * intensity * tint`, and accumulates.
- **Uniform packing**: `uniform vec4 uEmittersA[32]` = `(x, y, birthTime, life)`, `uniform vec4 uEmittersB[32]` = `(tintR, tintG, tintB, size)`, `uniform int uCount`. Well under the 8-storage-buffer WebGL/WebGPU limit and fine for WebGL2 uniform slots.
- **Sandbox safety**: WebGL2 (not WebGPU) — broadly supported, no adapter check needed. If `getContext('webgl2')` returns null (very old browsers), silently fall back to a Canvas2D approximation of the `fireSpark` shape (reuse `glow` + warm tint) so the app never breaks.
- **Perf**: Emitter cap 32, shader loop is bounded. Shader-inner layer count already `LAYERS_COUNT = 15` per emitter is heavy; we reduce to `LAYERS_COUNT = 6` in the port to keep 32 emitters × 6 layers manageable at 1080p. This is the one visible fidelity trade vs. the original — documented in the file header.
- **Attribution**: License comment in `fireShaderLayer.ts` and a short "Shaders: Jan Mróz (CC BY 3.0)" line added to the Builder's shape dropdown help text for `fireSpark`.
- **No audio/scheduler/clock changes.** Trigger detection reuses the existing `pathCrossings` scan already in `customScene.draw`.

## Verification

1. `/studio/builder` → set Burst → Shape = "Fire Spark". Preview shows fire bursts blooming from each trigger point, drifting up-and-right per the shader's `MOVEMENT_DIRECTION`, fading over Life.
2. Adjust Life / Size / Intensity / Tint — changes apply instantly without restarting the clock.
3. `/` → same behavior, at the app's current 0.25× speed cap.
4. Other shapes (dot, ring, spark, streak, glow) unchanged; existing presets still load.
5. Tab away and back → no runaway emitters (lifetime-capped).
