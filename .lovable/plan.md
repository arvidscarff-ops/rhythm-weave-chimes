# Fix: tiny cigar-shaped ember sparks (no sprite baking)

## What went wrong before

I built 128×64 pre-baked sprites with noise texture, then stretched them to 60–100px streaks. That's why you see the checkerboard of soft rectangles — any residual alpha at the sprite's rectangular edge stacks visibly with additive blending. Even with envelope fixes, `putImageData` in Canvas2D is spec'd as un-premultiplied so the RGB × alpha trick doesn't work the way I hoped.

The reference sparks are much simpler: **small elongated ellipses** (roughly 4–8 px minor axis × 12–20 px major axis on a ~440×300 image), soft warm gradient inside, no visible noise texture, no visible rectangular boundary. Just small cigars.  
  
USER NOTE: Well yeah, they are cigar shaped, but also vary a bit in shape. Goal is basically to make these look as close to realistic fire sparks as possible.

## What to build

Replace the sprite-stamping renderer with **direct ellipse drawing per particle** — no sprites, no offscreen canvases, no ImageData:

For each particle:

1. Compute heading `theta = atan2(vy, vx)`.
2. `ctx.save()`, translate to `(p.x, p.y)`, rotate to `theta`, non-uniformly scale so a unit ellipse becomes the target cigar (long axis ≈ 12–20 px + small speed contribution, short axis ≈ 3–6 px).
3. Draw a radial gradient in local unit-circle space (radius 1): white-hot core at ~30% radius offset toward the leading tip → warm tint mid → transparent at radius 1. Because the transform scaled the circle into an ellipse, this renders as a cigar-shaped soft blob whose alpha genuinely reaches zero at the ellipse edge.
4. `ctx.restore()`.
5. Optional tiny bloom halo: a small round radial gradient (radius ≈ 2× cigar length, very low alpha) at the particle position — but keep it small and dim.

Sizing (in css px):

- Long axis: `L = clamp(8, 24, r0 * 6 + speed * 0.012)` — always small.
- Short axis: `W = clamp(2.5, 6, r0 * 1.4)`.
- No sprite → no rectangle → no checkerboard.

Ember color ramp stays the same (life-t → white-hot / warm / cool), but applied as gradient stops in a single radial gradient rather than picking a pre-baked tinted sprite.

## Meander stays

The perpendicular-curl physics I added last turn stays. If it still reads as too straight, bump `curlAmp` per particle by another ~1.5× — but see it live before tuning further.

## Files to change

Only `src/lib/visuals/fireShaderLayer.ts`:

- Delete `bakeSprite`, `bakeSprites`, `TintedSprites`, `spriteCache`, `getSprites`, `SPRITE_W`, `SPRITE_H`, `smooth`, `hash2`, `valueNoise`, `fbm` — all dead once sprites are gone.
- Keep `Particle`, `emberColor`, `hexToRgb01`, spawn logic, physics.
- Rewrite the per-particle draw block in `layer.render` to translate/rotate/scale + one radial gradient fill.

No API changes, no caller changes.

## Verification

Playwright: navigate to `/studio/builder`, force-select the fire-spark visual, trigger 3–4 notes. Screenshot at t≈0.15s and t≈0.7s. Confirm:

- Sparks are small elongated warm cigars, not large blobs, not rectangles.
- Trajectories curve.
- No visible sprite/tile artifacts anywhere on the canvas.

If the sparks look too soft/gaussian and not "sharp enough like real embers," tighten the gradient stops (move the white-hot core to ~15% radius, cool tail dropping off at ~85%) rather than adding sprite noise back.