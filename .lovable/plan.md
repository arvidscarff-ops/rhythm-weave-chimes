## Goal

Make the wheel feel quietly alive. Rings, straight trigger lines, and note dots get a soft energy-beam shimmer — slow gradient flow at rest, a brief bloom on trigger — matching the neural-noise background's "thick water" feel.

No Unicorn Studio embed (heavy, can't sync to audio, would fight the neural-noise background). All effects rendered in the existing canvas.

## Scope

Files touched:
- `src/routes/index.tsx` — only the wheel scene's draw helpers.

Out of scope: Pendulum and Bars scenes (can follow once we like the wheel), audio engine, layout, dock, panels.

The `energy-beam.tsx` + demo files are not added — we're adopting the *aesthetic*, not the Unicorn Studio runtime. (If you'd rather have the actual component file copied into `src/components/ui/` for later use, say so and I'll include it.)

## Visual recipe ("barely breathing")

Each element gets a base layer + a slow shimmer + a trigger bloom.

1. Rings (concentric circles)
   - Keep current 0.5px hairline as the base.
   - Add a second pass: a conic-style gradient stroke at ~10% alpha that slowly rotates (period ~24s). Achieved by stroking the arc in N short segments whose alpha follows `0.5 + 0.5 * sin(theta - t * 0.07)`.
   - On trigger: temporary additive glow ring (shadowBlur 18, alpha 0.35) decaying over ~600ms.

2. Straight trigger lines (radii)
   - Base: existing 0.5px line at ~25% alpha.
   - Shimmer: a traveling highlight — a short bright segment (~12% of the line length) sliding from center→rim every ~8s, alpha peak 0.18.
   - On trigger: full-line flash, alpha 0.6 → 0, decaying ~500ms with shadowBlur 14.

3. Note dots
   - Base: filled dot as today.
   - Resting breath: radius modulated `r * (1 + 0.06 * sin(t * 0.6 + phase))`, alpha `0.85 + 0.15 * sin(...)`. Each dot gets a deterministic phase from its id so they don't pulse in lockstep.
   - On trigger: additive halo (radial gradient, 3× radius, alpha 0.5 → 0) over ~700ms. This replaces / refines the current flash.

All shimmer math uses the existing RAF clock — no new timers.

Color: pull from current ring/line palette; halos use the ring's hue at higher luminance so we stay inside the teal/cyan field. No new tokens.

Performance: shimmer adds ~Nrings × 64 segments + Nlines short strokes per frame. Negligible at current counts. `shadowBlur` only used during decaying trigger windows, not every frame.

## Tailwind / CSS

No CSS changes. The provided `index.css` snippet (`--bg-dark: #000000`, `tw-animate-css`) conflicts with our teal palette and isn't needed for a canvas-only effect, so we skip it.

## Acceptance

- At rest: rings show a slow rotating sheen, lines show a faint traveling highlight, dots breathe gently and out of phase. No element ever fully whites out.
- On note trigger: line flashes, ring blooms briefly at the hit point, dot halos out — all decaying within ~700ms.
- No frame-rate regression; no new dependencies; Pendulum/Bars unchanged.
