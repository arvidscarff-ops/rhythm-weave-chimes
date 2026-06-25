# Subtler, Organic, Note-Colored Light

Three coordinated fixes so flares and bursts feel like the same living organism, tinted by whatever note just played.

## 1. Carry note color through the flash bus

Right now `flashBus.flash(x, y, intensity)` only carries position + intensity, so the lens flare has to guess color from the global preset. The bursts already receive a per-call `hue`, but the flares don't.

- Extend `NeuralFlash` and `flashBus.flash` with an optional `hue` (0..1).
- Update the three trigger sites in `src/routes/index.tsx` (Wheel, Pendulum, Bars) to pass the same hue they already pass to `spawnBurst`, so a single note emits one consistent color across burst + flare + neural background.
- `NeuralNoise`'s flash handler ignores extra fields, so it stays compatible.

## 2. Lens flare: organic, subtle, note-tinted

Rewrite `drawFlares` in `src/lib/visuals/lensFlare.ts` to remove the rectangular streak and lean fully into soft, living forms:

- **Color source:** if the flash carried a hue, convert HSL→RGB and use that as the flare's base color; fall back to palette only when absent.
- **No more `fillRect` streaks.** Replace with an organic bloom built from:
  - A primary soft elliptical halo (radial gradient, very low alpha, gently elongated on a per-flare random angle — not always horizontal).
  - 3–5 wispy "filaments" drawn as quadratic-bezier ribbons with hairline stroke width and additive alpha, offset and curved with seeded noise so each flare looks hand-drawn.
  - Ghost orbs kept, but smaller, fewer (1–2), and only when energy is high.
- **Subtlety pass:** roughly halve all alphas (halo ~0.18 max, filaments ~0.06, core ~0.4), shorten radii, raise the global opacity floor so it never spikes harsh. Tie max intensity to `neural.opacity` so the Visuals → Glow slider remains the master.
- **Motion:** the ellipse rotates a few degrees over its lifetime and filaments drift outward slightly, so the flare breathes instead of just fading.

## 3. Bursts: respect the note hue

In `src/lib/visuals/burstField.ts`, when `opts.hue` is provided, lock the burst's color to that hue (skip the neural-bias blend and the broad seed-driven phosphor randomness for the dominant tint). Keep a tiny per-burst jitter (±0.04) for life, but the dominant color must read as the note's color. Sprite recoloring stays — only the hue input changes.

## Files

Edited:
- `src/lib/neural/flashBus.ts` — add optional `hue` field.
- `src/routes/index.tsx` — pass `hue` into the three `flashBus.flash(...)` calls (same value already passed to `spawnBurst`).
- `src/lib/visuals/lensFlare.ts` — note-hue coloring, organic bloom + bezier filaments replacing the rectangle, alpha/radius tuning, breathing rotation.
- `src/lib/visuals/burstField.ts` — honor `opts.hue` as the dominant color.

No new files. No changes to audio, composer, dock, routes, or UI controls.

## Out of scope

- No new visual settings; everything still flows through Visuals → Glow.
- No shader work; stays on the existing 2D canvas.
