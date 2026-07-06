# More organic, varied fire sparks

Goal: break the "identical cigars" look and push toward realistic, alive embers. All changes in `src/lib/visuals/fireShaderLayer.ts` (rendering only, meander physics untouched).

## 1. Per-particle shape variance (fixes "same shape")

Give each particle a persistent `shape` object at spawn:
- `baseL`, `baseW` sampled from wider ranges (L: 5–26px, W: 1.8–6.5px) with a power-law bias so most are small and a few are long.
- `aspectPhase`, `aspectFreq` — the L/W ratio breathes over lifetime: `L *= 1 + 0.35*sin(t*freq+phase)`, `W *= 1 + 0.25*sin(t*freq*1.7+phase)` out of phase, so a spark stretches thin then puffs shorter/thicker as it travels.
- `hotShift` — the hot-core offset inside the ellipse drifts (`hotX = 0.15 + 0.4*sin(...)`) so the bright head slides along the body.
- `flicker` — alpha gets a fast low-amp noise (`a *= 0.75 + 0.25*fbm(t)`) so intensity twinkles instead of a smooth fade.
- `curvature` — tiny per-frame rotation offset from velocity heading (±8°) using a slow sin, so the cigar isn't perfectly axis-aligned with motion.

## 2. Shape richer than a single ellipse

Instead of one radial-gradient ellipse, composite 2–3 offset gradients per particle in the same transform:
- Main body ellipse (current).
- Small hot nucleus (0.15× size) offset toward the head — sharper white-hot point.
- Faint tail smear (1.3× length, 0.6× width, lower alpha) trailing behind the head — gives a comet feel without being a streak.

Cheap (3 fills per particle, all in one `setTransform`).

## 3. Micro-sparks and debris

On each render, ~15% chance per active particle to emit a 1px "ash" pixel at its position with tiny random velocity and 120–250ms life. Adds the crackly, high-frequency detail real fire has without heavy cost.

## 4. Color temperature over life

Currently tint is static per burst. Make each particle interpolate:
- Age 0–0.2: near-white (2500K-ish, `#fff2c8`)
- Age 0.2–0.6: user tint (orange/amber)
- Age 0.6–1.0: deep red → smoke gray (`#3a1a0a` fading to transparent)

Uses one lerp per particle per frame — negligible cost, huge realism win.

## 5. Halo variance

Current halo is uniform `a*0.22`. Make halo radius and opacity per-particle (`haloScale` 0.7–1.6, `haloAlpha` 0.12–0.3) and pulse slowly. Prevents the "row of identical glows" look.

## 6. High-DPI crispness

Confirm `ctx.setTransform` uses `dpr` throughout (it does). Add a subtle 0.5px sub-pixel jitter per frame so ellipses don't lock to the pixel grid — reads as higher resolution / less digital.

## 7. Optional (ask before doing)

- **Motion blur trail**: draw each particle's previous position as a low-alpha copy, giving true streaks without changing shape. ~2× draw cost.
- **Turbulence field**: add a low-freq curl-noise perturbation to velocity (in addition to current meander) so paths curl in gusts, not just sine-wave meanders. Small physics change.

Recommend doing 1–6 in one pass; ask about 7 after you see the result.

## Verification

Playwright screenshot at t≈0.15s and t≈0.7s of a burst; compare against reference. Confirm: varied lengths, some fat/some thin, hot-point drift visible, color shift to red at end of life, tiny ash flecks present, no rectangular artifacts.

## Files

- `src/lib/visuals/fireShaderLayer.ts` — spawn (add shape params), render loop (multi-gradient composite, color lerp, halo variance, sub-pixel jitter), plus small ash-emission block.
