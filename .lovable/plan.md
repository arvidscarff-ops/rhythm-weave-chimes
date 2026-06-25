## Goal

Collapse all on-screen chrome into a single minimalistic floating dock at the bottom-center. Everything (navigation, transport, scene selector, BPM/speed, FX, Packs, Visuals, About) lives in that one dock and opens as Material-style drill-down dropdown popovers (per the reference component).

## What gets removed

- `PhaseChrome` left-rail nav (FX / PACKS / VISUALS / ABOUT buttons)
- Top wordmark + live clock HUD
- `PhaseReadout` ring-ratio pile (left side)
- Existing full-screen drawers: `FxDrawer`, `PacksDrawer`, `AboutDrawer`, `VisualsDrawer`
- Old `ArtDock` (replaced)

Result: canvas + dock only. Neural background untouched.

## New dock layout (single row, glassmorphic pill, bottom-center)

```text
[ ▶/⏸ ]  |  [ Scene ▾ ]  [ FX ▾ ]  [ Packs ▾ ]  [ Visuals ▾ ]  |  BPM 84  Speed 1.0x  |  [ ⋯ ▾ ]
```

- Hairline dividers between groups, JetBrains Mono labels, no labels under icons (icon + tiny caption only on hover ghost).
- BPM and Speed remain as inline thin sliders (per "everything in dock" answer). Multiply moves into the Scene popover.
- The `⋯` menu holds About, Dev console link, Sign in/out, Reset.

## Popover behavior (Material drill-down)

Add the provided component at `src/components/ui/material-ui-dropdown-menu.tsx` (verbatim, with the SSR/JSX issues from the paste cleaned up so it builds). Each dock trigger uses `DropdownMenuPage` for nested pages:

- **Scene ▾** → main page lists Wheel / Pendulum / Bars (radio); `Multiply` submenu page with vertex count radio 2–12.
- **FX ▾** → main page: Reverb (drill into Room/Hall/Plate/Cosmic + wet slider page), Chorus (preset page), Grain (preset page), Tone (preset page). Each leaf page has compact knobs/sliders embedded as custom items.
- **Packs ▾** → radio list of MOSS / PRISM / OBSIDIAN + any custom packs; drill page per pack shows its 6 voice slots and lets you assign Melo/Bass/Atmo.
- **Visuals ▾** → radio list of neural presets (Aurora, Lagoon, etc.) + toggles (grain, bursts).
- **⋯ ▾** → About (drill page with project blurb), Dev console (link), Auth (Sign in / Sign out).

Snappy clip-path sweep + staggered item enter come from the component's built-in M3 animations. `side="top"` so they open upward above the dock without overlapping anything.

## Collision rules

- Dock is `fixed bottom-4 left-1/2 -translate-x-1/2 z-50`, max-width ~min(960px, calc(100vw - 32px)).
- Popovers anchor to their trigger with `side="top"`, `align="center"`, `sideOffset={12}`, `collisionPadding={16}` so they never clip the viewport edge.
- Canvas has `pointer-events: auto` only outside the dock footprint (already the case — dock just sits on top).
- Remove all `absolute top-…` chrome elements so nothing else competes for clicks.

## Files

- **Add** `src/components/ui/material-ui-dropdown-menu.tsx` — fix the pasted code: complete the JSX in `RippleLayer`, `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, checkbox/radio items, `DropdownMenuPage`, `DropdownMenuPageTrigger`, `M3Styles`, and the `DrilldownContext` default value; type the context properly; render the page container with `height: menuHeight` animated. Wire Radix `Portal` and `Sub` correctly.
- **Add** `src/components/dock/PhaseDock.tsx` — the new single dock. Owns play/pause, BPM/Speed sliders, scene selector trigger, FX trigger, Packs trigger, Visuals trigger, overflow trigger. Pure presentational; all state passed in as props.
- **Add** `src/components/dock/menus/` — small files per popover content tree (`SceneMenu.tsx`, `FxMenu.tsx`, `PacksMenu.tsx`, `VisualsMenu.tsx`, `MoreMenu.tsx`) to keep `index.tsx` small.
- **Edit** `src/routes/index.tsx`:
  - Delete `PhaseChrome`, `ArtDock`, `FxDrawer`, `PacksDrawer`, `AboutDrawer`, `VisualsDrawer`, `PhaseReadout` components + their renders.
  - Replace render tail with `<NeuralNoise/> <canvas/> <PhaseDock …/>`.
  - Lift the bits of state the dock needs (fxState, packId, voiceSel, neuralSettings, scene, multiply, bpm, speed, isPlaying, auth) and pass setters down.
- **No backend changes.** No new deps (`@radix-ui/react-dropdown-menu` and `lucide-react` already installed).

## Technical notes

- Material component uses `ResizeObserver` and Web Animations API — both browser-only. Guard the height-animating effect with a mount check; render with `height: auto` on first paint to avoid SSR hydration mismatch.
- Cleaning the pasted snippet: many JSX bodies were stripped to empty in the message. I'll reconstruct them faithfully to the original Material spec described in the comments (ripple `<span>` layer, hover/press state span, content `Portal > Content` with the M3 sweep classes, page transitions using the existing `translate-x` classes, etc.). Public API exports stay exactly as the snippet lists.
- Keep dock typography on JetBrains Mono (already in `styles.css`) and continue using the existing semantic color tokens — no hex literals.

## Acceptance

- One bottom-center dock; nothing else floats over the canvas.
- Each dock button opens a Material-style dropdown above it with the clip-path sweep + staggered items.
- FX / Packs / Visuals / Scene / Overflow each drill into sub-pages with a Back row and animated height.
- Play, BPM, Speed, Scene change, FX tweak, Pack swap, Visual preset change all work from the dock and persist behavior of the current app.
- No popover collides with screen edges; no element sits behind the dock.
