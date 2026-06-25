## Goal
Make the Visuals → Background presets visually distinct, and add a near-black "Obsidian" dark mode preset that also dims the app's stage background (not just the shader tint).

## Changes

### 1. `src/lib/neural/palette.ts` — bolder, more differentiated presets
Replace the current 6 presets (all mid-saturation teal/violet siblings) with 6 dramatically different palettes, each with a strong `colorB` partner so the shader actually gradients:

- `aurora` — icy mint → electric cyan (cool, bright)
- `ember` — molten orange → deep crimson (hot, warm)
- `violet` — magenta → indigo (vivid, saturated)
- `acid` — chartreuse → toxic green (high-chroma pop, new)
- `phase` — hot pink → cobalt blue (synthwave contrast)
- `obsidian` — near-black charcoal → faint steel blue (dark mode, very low luminance)

Extend `NeuralPreset` with an optional `stage` field carrying a CSS gradient string. Only `obsidian` sets one (near-black radial field); other presets leave it undefined and inherit the existing teal stage.

### 2. `src/styles.css` — make stage background themable
Promote the stage gradient to a swappable variable. Keep `--pr-bg-grad` as the default (current teal). Add `--pr-stage-bg` defaulting to `var(--pr-bg-grad)`, and change `.pr-stage` to use `--pr-stage-bg`. This lets a preset override just the stage without touching the default.

### 3. `src/routes/__root.tsx` (or wherever neural settings subscribe) — apply stage override
On neural settings change, if the active preset defines `stage`, set `document.documentElement.style.setProperty('--pr-stage-bg', preset.stage)`; otherwise remove the override. Subscribe via existing `subscribeNeuralSettings`. Do this once at mount + on each change.

### 4. No changes to shader code
`NeuralNoise` already reads `color`/`colorB` from the preset, so new palettes flow through automatically. Opacity/Flow sliders unchanged.

## Out of scope
Dock chrome, dock readability, audio engine, scene rendering colors (rings/notes keep their phosphor palette).

## Risk
Low — additive CSS variable, palette data swap, one effect in root route.