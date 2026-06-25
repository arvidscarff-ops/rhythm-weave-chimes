## Plan — "Living orb" note dots

Goal: make every note dot feel like a tiny, organic Siri-style orb of light without changing how/when they move (constant tangential speed per ring stays exactly as-is).

Implementation, all inside `src/routes/index.tsx` (and a tiny helper in `src/lib/visuals/`):

1. **New helper `src/lib/visuals/orbDot.ts`**
   - Single function `drawOrb(ctx, x, y, opts)` that paints one fluid orb at canvas coords.
   - Internally layers, all additive:
     - **Soft halo** — wide low-alpha radial gradient in the voice color.
     - **Chromatic-aberration core** — 3 tinted radial blobs (R/G/B) offset by 0.4–0.8 px along a slowly rotating axis, mimicking the Siri waveform's spectral fringe.
     - **White-hot center** — small bright disc lifting the core to "light".
     - **Wobble** — per-orb deterministic phase (`hashPhase(id)`) drives subtle eccentricity (sx/sy oscillation ±10%) and slow rotation, so each orb breathes on its own beat.
   - All amplitudes scale with an `energy` arg (0..1) driven by `n.flash` so triggers swell the orb without changing its travel.

2. **Wheel scene (`drawWheel`)**
   - Replace the current disc + breath halo + trigger halo block with one `drawOrb` call per note.
   - Keep the existing trail sampling and rendering exactly as-is (constant travel preserved).

3. **Pendulum bobs** and **Bars nodes**
   - Swap their current dot rendering for `drawOrb` so the whole app shares one "orb" language. Physics/timing untouched.

4. **Performance**
   - 2D canvas only, ~6 notes × 3 rings + bobs/bars. No WebGL, no per-orb shaders.
   - Uses `globalCompositeOperation = "lighter"` for the orb layers, then restores.

5. **Verify**
   - Open the preview, confirm orbs read as glowing fluid light, each one wobbling on its own phase, travel speed unchanged, triggers swell + bloom as before.