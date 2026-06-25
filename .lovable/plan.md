
## What's wrong

The shimmer code I shipped is technically running, but two things broke the effect in practice:

1. **Ring sheen is too faint to see.** Each ring gets a 64-segment sweep with peak alpha `0.10` modulated by `sin³` — at rest most segments are below 1% alpha, so on a teal glass background it visually reads as a flat hairline. No "alive" feel.
2. **Trigger-line "traveling highlight" reads as a weird floating disc.** The code drops a soft radial gradient that slides from one end of every trigger chord to the other every 8s. With one chord visible, this looks exactly like what you described: "a low-opacity gradient white circle moving down the main divider line every few seconds." It's not zen, it's a UFO.
3. **Note breathing is invisible.** ±6% radius and ±15% alpha on a 3.5px disc is below perceptual threshold against the bloom halo.

## Plan

All changes in `src/routes/index.tsx`, canvas-only. No new deps, no audio touched.

### 1. Remove the traveling-highlight disc on trigger lines
Delete the `hg` radial-gradient block (the moving circle). Replace it with a chord-aligned shimmer: a single soft alpha-pulse along the *whole* chord that breathes in/out on a 6–9 s sine, per-line phase-offset via `hashPhase`. No moving point, no disc — the line itself gently brightens and dims.

### 2. Make the ring sheen readable but still slow
- Drop segment count from 64 → 24 (less stippling, smoother sweep).
- Raise `sheenPeak` to ~`0.22` (hovered `0.32`) and switch from `sin³` to `sin²` so the bright arc is wider and the dark side never fully disappears.
- Slow the sweep slightly (`t * 0.18` instead of `0.26`) so it feels like a tide, not a rotation.
- Add a faint constant base over the hairline (alpha ~`0.10`) so the ring reads as "lit" even between sheen peaks.

### 3. Make notes actually breathe
- Increase resting radius pulse to ±18% and resting alpha pulse to ±35%.
- Add a slow secondary halo (radial gradient, alpha ~`0.06–0.10`, radius ~`baseR * 2`) that pulses on the same per-note phase. This gives each note a soft "glow halo" that swells and recedes — the zen part.
- Keep `n.flash` trigger halo untouched (already working).

### 4. Sanity check the runtime error
The `Failed to fetch dynamically imported module: virtual:tanstack-start-client-entry` in the snapshot is the standard symptom of an HMR reload after a dev-server hiccup, not a code bug. I'll verify with a fresh build after the changes; if it persists I'll restart the dev server.

## Out of scope

- No changes to scenes other than Wheel (Pendulum/Bars use their own decay paths; once Wheel reads right we can port the same idiom).
- No changes to the neural-noise background, audio engine, layout, or dock.
