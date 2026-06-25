## Plan

1. **Remove dark-energy contribution from the burst sprites**
   - Change the procedural burst sprite so RGB stays near-white / high-luminance while noise only controls alpha and shape.
   - Avoid multiplying color channels by low noise values in a way that creates smoky/dark colored patches.

2. **Switch burst rendering to “luminance mask + additive tint”**
   - Treat the organic shader/noise pattern as a transparency mask, not as visible dark pigment.
   - Keep unique seed-driven shapes, but ensure every visible pixel is light-emitting: white-hot core, pale colored edges, transparent elsewhere.

3. **Soften the global background shader’s darker readable patches**
   - Adjust `NeuralNoise` so its pattern is less like a semi-transparent colored texture and more like faint additive caustics.
   - Bias color toward a lighter tint before opacity is applied, reduce contrast, and let low-intensity areas fade out instead of showing as dark shapes.

4. **Preserve the current organic motion and reactivity**
   - Keep the slow “thick water” movement, note-trigger flashes, and unique burst variation.
   - Do not change the music engine, scene logic, controls, or pack/FX features.

5. **Verify visually**
   - Check the preview for burst events and background behavior to confirm there are no dark colored spots, only subtle light blooms over the dark interface.