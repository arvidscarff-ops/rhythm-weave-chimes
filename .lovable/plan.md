# Fix square sprite halos + add real meandering

## Bug 1: rectangular "squares" around each spark

Cause: the baked sprite has a nonzero alpha floor almost everywhere in the 128×64 rectangle. My alpha formula was
`shape^1.6 * (0.55 + 0.55*noise) * (0.75 + 0.35*fbm) + tip`
where `shape` only decays to zero at the ellipse boundary (d=1), but noise and streak factors have hard floors of 0.55 and 0.75. So at d=0.9 the sprite still writes alpha ≈ 0.025, and `globalCompositeOperation="lighter"` stacks the resulting rectangular halos into the checkerboard the user sees.

Fix:
- Compute a hard sprite envelope: `env = smoothstep(1.05, 0.75, d)` (0 outside the ellipse, 1 near center) and multiply it into final alpha as the outermost factor.
- Drop the noise floors: `mask = max(0, 0.15 + 1.0 * (n - 0.35))`, `streak = max(0, 0.35 + 0.9 * (fbm - 0.4))` so wispy edges genuinely thin out to zero.
- Apply an extra edge-safety multiplier `pow(env, 0.6)` to guarantee alpha = 0 at the exact rectangle boundary.

Additionally use a **premultiplied-alpha-safe fill**: store RGB × alpha in the ImageData bytes so additive blending doesn't leak the flat tint color into "empty" pixels near the edges.

## Bug 2: sparks fly in straight lines

Cause: `wobble()` returns world-space sinusoids of position. Adding those to `(vx, vy)` mostly modulates speed along whatever axis the particle already travels; the heading barely changes. Also the magnitude (`CURL = 95` px/s²) is small next to typical initial speeds (several hundred px/s).

Fix — real curl-style meander:
- Give each particle a **phase-drifting angular offset** `theta(t) = A * sin(w1*t + s1) + B * sin(w2*t + s2)` — a slow low-frequency noise sampled from two sines with per-particle seeds. Low frequencies (~0.7 Hz and ~1.9 Hz) so the path curves over its lifetime instead of jittering.
- Each frame compute the current velocity heading `h = atan2(vy, vx)`, then apply a **perpendicular** acceleration `a_perp` of magnitude `CURL_STRENGTH * theta_dot` (or just `CURL_STRENGTH * dtheta/dt` numerically). Because the force is perpendicular, it steers rather than modulates speed → S-curves.
- Increase magnitude so heading actually turns: aim for the perpendicular acceleration to rotate the velocity by ~1–2 rad over the particle's lifetime. Roughly `CURL_STRENGTH ≈ 0.8 * initialSpeed`.
- Keep the drag as-is so sparks still slow down; keep gravity subtle.

Optional polish: also add a small tangential wobble (component parallel to velocity) so speed oscillates slightly — this reads as flicker of streak length, which sells the "living ember" feel.

## Files to change

- `src/lib/visuals/fireShaderLayer.ts` only:
  - `bakeSprite()`: new alpha formula with hard envelope + premultiplied RGB write.
  - `Particle` type: add per-particle noise phase seeds (`ph1`, `ph2`) — or derive from existing `seed`.
  - `layer.render()` physics block: replace the axis-aligned wobble with perpendicular-heading curl force; bump `CURL_STRENGTH`.

No API or caller changes.

## Verification

After the edit, run Playwright: navigate to `/studio/builder`, force-select the fire-spark visual, trigger 3–4 notes at different positions, screenshot at t≈0.15s and t≈0.7s. Confirm (a) no visible rectangular halos around individual streaks, (b) trajectories visibly curve rather than radiating in straight rays. If either check fails, tune envelope thresholds / CURL_STRENGTH and re-verify before ending the turn.
