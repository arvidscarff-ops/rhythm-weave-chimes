
# Phase → Elasti-style Visual Redesign

Keep all audio + wheel engine logic untouched. This is a pure visual/layout pass on `src/routes/index.tsx`, `src/routes/__root.tsx`, and `src/styles.css`.

## Target aesthetic (from reference)
- Deep **teal/aqua atmospheric gradient** background (not charcoal) with soft, painterly light blooms — `oklch(45% 0.06 200)` deep teal → `oklch(60% 0.04 190)` misty cyan, plus a faint vignette and the existing noise grain on top at lower opacity.
- **Monospace HUD chrome** everywhere: JetBrains Mono, `text-[10px]/[11px]`, `tracking-[0.18em]`, uppercase, low-contrast white/70.
- **Glass card** as the dominant surface: heavy `backdrop-blur-xl`, `bg-white/8`, 1px `border-white/15`, generous `rounded-2xl`, soft inner highlight.
- **Small circular HUD icons** (thin 1px stroked circles ~22px) for toggles instead of filled buttons.
- Live **clock + date** in top-right (`HH:MM:SS AM` / `MON DD, YYYY`), wordmark top-left (`Phase®`).
- Small left-rail nav list (WHEEL / FX / PACKS / ABOUT), bottom-left tagline block, bottom-right meta (`© 2026 PHASE` / `X / GITHUB`).

## Layout

```text
┌──────────────────────────────────────────────────────┐
│ Phase®                              14:36:29 PM      │
│                                     JUN 24, 2026     │
│                                          ◐  ✱        │
│ WHEEL                                                │
│ FX        ┌───── glass canvas card ─────┐            │
│ PACKS     │                             │            │
│ ABOUT     │      wheel + rings here     │            │
│           │                             │            │
│           └─────────────────────────────┘            │
│                                                      │
│                  ┌── floating dock ──┐               │
│                                                      │
│ GENERATIVE                              © 2026 PHASE │
│ POLYRHYTHMIC                              X / GITHUB │
│ AMBIENT INSTRUMENT.                                  │
└──────────────────────────────────────────────────────┘
```

- The wheel canvas moves **inside a centered glass card** (~min(900px, 70vw) wide, ~70vh tall), offset slightly right of center like the reference.
- Existing dock + drawers (FX, Packs) stay functionally identical but restyled to match: white/8 fill, white/15 hairlines, white/70 mono labels. Left rail items toggle the same drawers.

## Visual tokens (in `src/styles.css`)
- `--pr-bg-grad`: radial + linear teal blend.
- `--pr-glass`: `color-mix(in oklab, white 8%, transparent)`.
- `--pr-hairline`: `color-mix(in oklab, white 15%, transparent)`.
- `--pr-ink`: `color-mix(in oklab, white 78%, transparent)` for HUD text.
- Replace charcoal `--pr-bg` baseline; keep noise overlay but drop to `opacity .35` and `mix-blend-mode: soft-light` so it reads as misty grain over teal.
- New utilities: `.pr-glass-card`, `.pr-hud-ring` (circular icon button), `.pr-rail-link` (active = white, inactive = white/45).

## Canvas adjustments (no engine changes)
- Wheel strokes shift to `rgba(255,255,255,0.55)` hairlines on the new lighter ground; ratio + ghost readouts re-tuned to `rgba(255,255,255,0.08 → 0.22)` so they still read on teal.
- Ink-bleed ripple gradient stays but tinted toward warm white (`rgba(255,245,230,a)`) so triggers pop against the cool ground.

## Files touched
- `src/styles.css` — new background gradient, glass + hud utilities, rail/clock styles, noise overlay retuned.
- `src/routes/__root.tsx` — body class for the new gradient; JetBrains Mono link already present.
- `src/routes/index.tsx` — add Wordmark, Clock (live `setInterval`), LeftRail (wired to existing drawer toggles), BottomMeta, glass card wrapper around the canvas; restyle ArtDock / FxDrawer / PacksDrawer chrome to the new tokens; recolor canvas strokes/readouts. No audio, no engine, no scene-logic changes.

## Out of scope
- No new features, no sound changes, no routing changes, no engine refactor.
