## Goal

Two things in one pass:

1. **Close feature-parity gaps** between the four scenes so every scene has the same baseline: per-trigger flash, per-trigger refractory cooldown, and velocity that scales with event energy.
2. **Add a universal rule**: notes/voices that play or move fastest are placed toward the **left** of the canvas; slowest toward the **right**. Implemented with a shape-appropriate interpretation per scene so motion still feels native to each shape.

## Part 1 — Parity fixes (small, surgical)

`src/lib/scenes/stringNetwork.ts`
- Add `lastFireT: number` to `Particle`; in `eventsIn` skip events where `tEv - p.lastFireT < PARTICLE_COOLDOWN` (≈ `0.09 s`); set `p.lastFireT = tEv` on fire.
- In `draw`, decay particle head radius/alpha from `Math.exp(-(t - p.lastFireT) * 3.0)` (parallels pendulumFan + spiralArp).
- Make `velocity` scale with `|p.rate|` (normalized 0..1 across particles) so fast particles ink-bleed harder.

`src/lib/scenes/radialSweep.ts`
- Add `TARGET_COOLDOWN = 0.12` (mostly defensive — uniform ω + fixed angles means duplicates are rare, but the contract should match the others).
- Make `velocity` scale with target's pitch rank (higher pitch → higher velocity) so the new left/right rule reinforces visual energy.

`src/lib/scenes/pendulumFan.ts`
- Make `velocity` scale with `1/ratio` (faster strand → higher energy ink-bleed).

`src/lib/scenes/spiralArp.ts`
- Already has variable velocity; no parity changes.

## Part 2 — Speed → left / slow → right

Universal rule: rank a scene's "voices" by their motion speed (or trigger cadence if static), then place rank 0 toward x ≈ left edge and rank N−1 toward x ≈ right edge, using the scene's native geometry.

### stringNetwork
- Sort `state.particles` by `|rate|` **descending**.
- Sort `state.strings` by the **average X** of their two anchors at t = 0 **ascending** (leftmost first).
- Reassign so the fastest particle rides the leftmost string, second fastest → second-leftmost, etc. Two particles per string (opposite directions): leftmost string takes the two highest |rate| values, etc.
- Anchors stay on their Lissajous orbits — only the rate→string mapping changes, so the visible effect is that the fastest blink/wrap activity lives on the left side of the canvas.

### pendulumFan
- Make the rate→strand mapping explicit and monotonic:
  - `const RATIOS_SORTED = [...RATIOS].slice(0, N).sort((a,b)=>a-b);`
  - strand `i` (left = 0) gets `RATIOS_SORTED[i]` (smallest ratio = fastest oscillation).
- Mirror the same order onto `pitchSemis` so the leftmost strand is also the highest pitch (cleaner audio image of "left = fast/bright").
- Drop the `i % RATIOS.length` wrap so the monotonic ramp is preserved at all densities.

### spiralArp
- Sort `state.playheads` by `speed` **descending**.
- Assign each playhead an angular t=0 anchor: `targetTheta_i = π * (1 - i/(N-1))`, where i=0 is fastest (left, θ=π) and i=N−1 is slowest (right, θ=0).
- Realize that anchor by setting `s0_i` so that `thetaForArc(s0_i)` ≈ `targetTheta_i` at t=0 (use the existing inverse via the cached `arcAtBucket` plus a one-shot bisection, or precompute by scanning `arcAtBucket` for the bucket angle closest to `targetTheta_i`).
- All playheads still spiral inward; at the Big Bang they sit fanned across the canvas left → right by speed.

### radialSweep
- Targets are static and ω is global, so "speed" doesn't vary geometrically. Use pitch / "voice activity" as the proxy:
  - Sort `state.targets` by `pitchSemis` **descending** (highest pitch first).
  - Reassign each target's `angle` so high-pitch targets fall in the canvas-left arc `(π/2, 3π/2)` and low-pitch targets in the canvas-right arc.
  - Concretely: split sorted targets into left-half and right-half halves; within each half distribute angles evenly so the arm still hits them in a smooth cadence as it sweeps.
- Keep `rNorm` cycling 0.45/0.63/0.81 for visual variety.

## Big-Bang invariant

For all four scenes, the assignment happens during `init` / density-reseed, **not** per frame. That keeps the Phase-Zero contract intact: state is still a pure function of scene time after seeding, and `engineClock.resetPhaseZero()` continues to snap the canvas back to a coherent left→right speed gradient.

## Verification

- `bun run tsgo` after edits.
- Headless Playwright pass: load `/`, cycle through all four scenes (via the URL `#s=…` payload or scene button), screenshot each, sanity-check left-side density vs right-side density.
- Confirm no regression in the existing parity matrix (sample / eventsIn / density reseed / flash decay still fire).

## Out of scope (call out for follow-up)

- Mapping pitch to a shared `SCALE_SEMIS` across all scenes (currently stringNet + pendulumFan use ad-hoc semis tables).
- Wiring `engineClock.resetPhaseZero()` to also clear `lastFireT` / `lastNebulaT` / `triggerCount` (open question from Step 5).
- Trails on pendulumFan and spiralArp.
