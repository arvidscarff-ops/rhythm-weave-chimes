
# Phase — Design System Enforcement Pass

Acknowledging the four-pillar visual contract. This pass aligns the existing app (charcoal canvas, wheel engine, ArtDock, FX & Packs drawers) to the exact tokens, with no generic shadcn surfaces leaking through.

## 1. Global Canvas & Texture

**`src/styles.css`**
- Replace current `--pr-bg` with `oklch(18% 0.02 240)`; set as `body` background.
- Add a fixed full-viewport `::before` noise layer: tiny SVG noise data-URI, `mix-blend-mode: overlay`, `opacity: 0.06`, `pointer-events: none`, `z-index: 0`.
- Define a `--pr-grain-strength` token so the canvas renderer and the CSS layer stay in sync (we keep the existing in-canvas cached noise pattern for the art surface, but lower its alpha so the two layers compound to ~8% perceived grain instead of stacking).
- Register a tracking utility chain (`.pr-mono`, `.pr-label`) bound to a monospace stack (`"JetBrains Mono", ui-monospace, …`) with `text-xs` + `tracking-[0.15em]` + `uppercase`. Load JetBrains Mono via `<link>` in `src/routes/__root.tsx` (never `@import` a URL in CSS per the v4 rules).

**`src/routes/index.tsx`**
- Swap any remaining geometric-sans labels (dock button captions, drawer headers, BPM readout, ghost readout, ring chips) to `.pr-label`.
- Cap label sizes at `text-xs`; values/ratios use the same class but with tabular-nums.

## 2. Ghost Readouts & HUD

Canvas-side in `updateWheel` / scene draw:
- Replace any 1px concentric guide strokes with `ctx.lineWidth = 0.5` (account for devicePixelRatio so it stays a true hairline) using `rgba(255,255,255,0.06)`.
- Render ring period text (e.g. `4/4`, `11/13`) and lane labels directly on the canvas in the monospace family at **5–8% alpha** baseline. Track a `hoverRingId` (already partially present for the ghost readout) and tween its alpha toward `0.20` via the same `setTargetAtTime`-style decay we use for ripples — never reach 1.0.
- The existing center "Ghost Readout" stays but is rebound to the same opacity rules (`0.05` idle → `0.20` on hover) and uses the monospace family.

## 3. Kinetic Trigger Lines

Refactor line rendering in the wheel scene:
- Trigger lines idle as the same 0.5px hairlines at ~10% alpha (just enough to read geometry).
- On a note crossing, push an `InkBleed` event onto an array keyed by line id with `{ x, y, t0, life: 0.9s }`.
- Each frame, for every active bleed, draw a `createRadialGradient` along the line normal: inner stop `rgba(230,230,255,a)` where `a` follows an exponential decay `a = a0 * exp(-k * dt)` (mirror of `setTargetAtTime` with τ≈0.18s), outer stop transparent. Radius grows from 0 → 56px with an ease-out curve.
- Composite with `globalCompositeOperation = 'lighter'` only inside the bleed pass, then restore — prevents the rest of the scene from blooming.
- Retire the current hard "flash on trigger" segment redraw.

## 4. Floating Dock Glassmorphism

`ArtDock`, `FxDrawer`, `PacksDrawer`:
- Container: `bg-neutral-950/40 backdrop-blur-xl` + a 1px hairline border via `border border-white/10` and an inner gradient ring (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]`) for the top highlight.
- Dock root: `rounded-full` pill; secondary panels (FX, Packs): `rounded-2xl`.
- Buttons inside: ghost style, no shadcn `Button` variant — bare `<button>` with `.pr-label`, hover state = border opacity 10 → 20, never a fill flash.
- BPM slider already uses `.pr-hairline-slider`; recolor thumb/track to neutral whites at low alpha so it reads as etched glass.
- Remove any residual rounded-md / solid card backgrounds in drawer internals; replace voice chips and FX preset chips with hairline-bordered pills matching the same token set.

## 5. Color & Component Guardrails

- Purge any bright blue / shadcn primary leftovers from the wheel/dock surface (audit `index.tsx` + drawers). All accents become warm-neutral whites or the existing `--pr-melo` / `--pr-harm` tokens dialed to ≤ 40% alpha.
- No `Input`, `Card`, `Select`, `Slider` (shadcn) inside the art surface — confirmed during pass; if any creep in, replace with native `<button>` / `<input type="range">` styled via `.pr-*` utilities.

## Technical notes

- All canvas alpha decays reuse one helper `decayAlpha(a0, t, tau)` so HUD hover, ink bleeds, and trail fades share a single math curve.
- Hairline strokes use `ctx.lineWidth = 0.5 / (dpr / window.devicePixelRatio)` guard; on high-DPR displays this still resolves to a sub-pixel line.
- No new dependencies. JetBrains Mono loaded via `<link rel="stylesheet">` in `__root.tsx` head.

## Files touched

- `src/styles.css` — tokens, grain layer, monospace utilities, dock/drawer glass classes, slider restyle.
- `src/routes/__root.tsx` — font `<link>` tags.
- `src/routes/index.tsx` — canvas hairlines, ghost-readout alpha curve, ink-bleed renderer, dock + drawer markup/classes, label typography.

No changes to audio engine, FX state, or sound pack logic — this is purely the visual contract.
