## Goal

Make every note dot an actual SiriWave **fluid-dots** orb — the exact WebGL shader from the reference — not a 2D-canvas imitation. They should be noticeably larger than the current dots.

## Approach

The reference component spins up one WebGL canvas per orb. That doesn't scale (browsers cap ~16 WebGL contexts and we can have many orbs across Wheel/Pendulum/Bars). Instead, render all orbs through **one shared WebGL overlay canvas** that runs the same fluid-dots fragment shader per orb via `gl.scissor` + `gl.viewport`, so the pixels on screen are byte-for-byte the shader's output.

## Files

### New: `src/lib/visuals/siriOrbLayer.ts`

A singleton overlay manager.

- Creates a full-viewport `<canvas>` (absolute, `pointer-events:none`, `mix-blend-mode: screen`, behind the HUD but above the background shader) and a WebGL1 context.
- Compiles the **verbatim** `FLUID_DOTS_SHADER` from the reference (vertex = fullscreen triangle). Uniforms: `iResolution` (orb pixel dim), `iTime`, plus new `iEnergy` (0..1) and `iHue` (rotates the shader's internal hue base) so each orb can have a voice-color tint and trigger flash without changing the algorithm.
- API:
  - `mount(parentEl)` — attach overlay matching the scene canvas's bounding rect (ResizeObserver on the scene canvas keeps it synced).
  - `begin(timeSec)` — clear, store time.
  - `place(id, cssX, cssY, sizeCss, energy, hue)` — schedule one orb at that center.
  - `end()` — one pass: for each scheduled orb, set `viewport`+`scissor` to its square box, upload uniforms, draw the triangle. Reset state.
- Pool entries keyed by `id` (string) so each orb keeps a stable `seedT` (time offset) for unique phase — without that, every orb runs the same shader frame and they look identical.

### Modify: `src/routes/index.tsx`

- Mount the overlay once in the scene effect, sized to the scene canvas.
- Replace every `drawOrb(ctx, x, y, {...})` call (Wheel notes, Pendulum bobs, Bars playheads) with `siriOrbLayer.place(id, x, y, size, energy, hue)`. The `drawOrb` helper stays in the file for now but is unused by the live scenes.
- `size` ≈ `48px` for Wheel notes (vs. ~10px today), `56px` for Pendulum bobs, `44px` for Bars heads — tunable constants.
- Per-orb `id`: `"wheel:<ringIdx>"`, `"pend:<idx>"`, `"bars:<idx>"`.
- Per-orb `energy`: reuse the existing trigger-decay value already passed to `drawOrb`.
- Per-orb `hue`: existing `hueToOrbTpl` source hue.
- Wrap each scene draw with `siriOrbLayer.begin(t)` / `siriOrbLayer.end()`.

### Modify: `src/lib/visuals/orbDot.ts`

Leave the file in place (no other callers to break), but mark `drawOrb` as legacy in a one-line comment. No behavior change.

## Shader integration details

- Use the **exact** `FLUID_DOTS_SHADER` source you pasted — no edits to the metaball math.
- Two tiny additions only:
  - `uniform float iEnergy;` — multiplies `gBright` and adds a brief `flash` so triggers visibly bloom inside the orb.
  - `uniform float iHue;` — added to the shader's internal `hue` so each orb leans into its voice color while keeping the spectral aberration.
- `iTime = sharedTime + perOrbSeed` so every orb is at a different point in the merge/scatter/gather cycle.

## Layering

- Background NeuralNoise shader stays the bottom layer.
- Scene 2D canvas (rings, trigger lines, halos) sits above it.
- SiriOrb overlay sits above the scene canvas, with `mix-blend-mode: screen` so the orbs read as additive light on top of the rings.
- HUD/dock/readouts stay on top via existing z-index.

## Out of scope

- Burst field, NeuralNoise background, audio, scheduler, sound packs — untouched.
- No changes to physics, ring spacing, or trigger logic.

## Validation

- Visual check in all three scenes: orbs should look like a Siri pill of six dancing metaballs, not a glowing dot.
- Performance check: one WebGL context, one program, ≤ ~30 small viewport draws per frame — should stay smooth.
- Confirm trigger flash visibly pulses each orb on note hit.
