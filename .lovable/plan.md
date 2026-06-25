
# Plan: Phosphor-inspired note burst effects

Take visual inspiration from the phosphor-30 shader (iridescent cyan/magenta/amber gradients, soft additive bloom, organic flowing energy) and translate it into short-lived particle "bursts" that erupt from the exact pixel where a note is triggered — across all three scenes (Wheel, Pendulum, Bars).

## Approach

Render bursts on the **existing scene canvas** (not a new WebGL layer), using additive 2D canvas drawing. This keeps the bursts pixel-aligned with the rings/bobs/bars that triggered them, costs almost nothing, and stays inside the existing RAF loop. The NeuralNoise WebGL background stays exactly as it is.

## What a "burst" looks like

Each trigger spawns one burst (~14–22 particles + a central flash) with phosphor-shader aesthetics:

- **Palette**: shimmering cyan → magenta → amber gradient sampled per-particle from a `cos(s + vec4(0,1,8,0))`-style lookup (the same color recipe the shader uses). Color is biased by the ring/bob/lane's pack voice so each layer reads as its own instrument.
- **Motion**: particles fly outward on a `normalize(cos(...))` jittered direction, decelerating fast (ease-out cubic), with a tiny tangential curl so the burst "twists" instead of being a flat starburst.
- **Render**: each particle is a small additive radial-gradient sprite (`globalCompositeOperation = "lighter"`), `shadowBlur` ~10–16, drawn at half-alpha and shrinking over its ~600–900ms life. A brighter sub-flash core fades in ~180ms.
- **Velocity coupling**: burst size + particle count scale with the note's gain so loud hits feel bigger; quiet hits stay restrained.

## Integration points

- **`src/lib/visuals/burstField.ts`** (new): a tiny burst manager — `spawn(x, y, { hue, energy })`, `update(dt)`, `draw(ctx)`. Holds a pooled particle array (cap ~400) so trigger storms can't leak memory.
- **`src/routes/index.tsx`**:
  - In `updateWheel` / `updatePendulum` / `updateBars`, at the same spot we already call `flashBus.flash(...)`, also call `burstField.spawn(px, py, { hue: ringHue, energy: gain })`.
  - In the scene paint pass, after rings/bobs/bars are drawn, call `burstField.draw(ctx)` so bursts sit on top of the geometry but under the HUD text.
- **No changes** to audio, NeuralNoise, dock, or readouts.

## Tuning to match the "alive / zen" feel

- Bursts decay smoothly (no hard cut) and never exceed the existing trigger-bloom brightness — they enhance the existing pulse, not replace it.
- Hard cap: max 12 concurrent bursts; older ones fade out faster when the cap is hit, so dense polyrhythms stay readable instead of flashbanging.
- Respect `prefers-reduced-motion`: fall back to a single soft halo with no flying particles.

## Out of scope

- No new WebGL canvas, no porting the full phosphor shader into the app (it's heavy and would compete with NeuralNoise).
- No changes to existing ring/line/bloom rendering — the bursts layer on top.

If this looks right I'll switch to build mode and implement it.
