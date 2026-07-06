## Plan

1. **Fix the overlay coordinate mismatch**
   - The fire overlay canvas is mounted as a sibling over the scene canvas, but spawns are sent in the 2D scene canvas’ local coordinates.
   - Update the fire layer to store the parent/canvas bounds and convert local spawn points into the overlay’s coordinate space reliably.
   - Use the shorter canvas dimension for shader burst sizing so square and non-square previews behave consistently.

2. **Fix WebGL alpha compositing**
   - Change the WebGL blend mode from `ONE, ONE` to a premultiplied-style alpha-safe blend so transparent areas stay transparent and bright sparks composite predictably over the 2D scene.
   - Keep the CSS blend mode additive/screen so sparks read over dark backgrounds.

3. **Make the shader impossible to miss**
   - Boost the localized shader output and remove remaining masks/falloffs that can zero out most spark cells inside a small burst.
   - Raise the slider/default ceiling for intensity if needed, while keeping existing saved presets compatible.

4. **Add a temporary visual verification path**
   - Add a tiny internal debug hook on the fire layer for preview verification only, so I can spawn a fire burst directly and inspect pixel output without waiting for musical trigger timing.
   - Do not expose debug controls in the UI.

5. **Verify in the live preview**
   - In the builder, select/force `Fire spark (shader)`, spawn a test burst, and confirm the overlay canvas contains visible non-transparent/bright pixels.
   - Also confirm the main app custom scene still mounts the fire overlay and renders without console errors.

## Technical notes

- Likely issue: the WebGL canvas exists and is sized, but the shader either renders outside the visible area or produces too-low alpha/brightness after its masks and blending.
- Files expected to change:
  - `src/lib/visuals/fireShaderLayer.ts`
  - possibly `src/lib/engine/pathTransformer.ts`
  - possibly `src/routes/studio.builder.tsx` only if verification shows the preview wiring needs a small mount/order adjustment.