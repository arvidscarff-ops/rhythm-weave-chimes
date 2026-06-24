## Goal
Strip away the framing so the wheel breathes — no glass card, no on-canvas hover readouts. Move numeric info into a small, quiet "data pile" on the left.

## Changes — `src/routes/index.tsx`

1. **Remove the glass card wrapper around the wheel canvas.**
   - In the `isWheel` branch of `<main>`, drop the `<div className="absolute pr-glass-card overflow-hidden" …>` container.
   - Render the wheel canvas the same way as the non-wheel branch: `<canvas className="absolute inset-0 w-full h-full block" style={{ background: "transparent", cursor: "crosshair" }} />`, with `<WheelOverlays>` as a sibling absolute-positioned layer using the full viewport.
   - `WheelOverlays` math already uses `canvasW`/`canvasH` from `canvasRect` — it will recentre automatically once the canvas fills the page.

2. **Remove on-canvas hover readouts.**
   - Delete the call to `drawGhostReadout(...)` and the surrounding `hoverOpacityRef` block in the RAF loop (~lines 834–844). Keep `hoverRingIdRef` (the left pile uses it).
   - Delete the `drawGhostReadout` function itself (~lines 1734–1749).
   - In `drawWheelScene` (~lines 1597–1605), remove the per-ring `${beats}/${subdivision}` text drawn at the ring's right edge. Keep the ring stroke.

3. **Add a small "Readout" pile on the left, under the nav rail.**
   - New component `PhaseReadout({ wheel, bpm, hoverRingId })` rendered inside `PhaseApp` (sibling of `PhaseChrome`), positioned `absolute left-6 top-[260px]` (below About).
   - For each ring print one row in `pr-label` (JetBrains Mono, 10px, tracking-widest, `text-white/40`): `{beats}/{sub}  ·  {period.toFixed(2)}S`. The row for the hovered ring fades up to `text-white/85`.
   - Append a final muted row: `{bpm} BPM`.
   - Use the same `requestAnimationFrame`-driven re-render that `WheelOverlays` already gets via `topo`; pipe `topo` and `hoverRingId` (lifted to React state mirror — reuse existing `setHoverRing` if present, otherwise add a lightweight `useState` synced from `hoverRingIdRef` on each frame inside the existing tick).

4. **Quiet hydration warning on the clock** (drive-by, since we touch `PhaseChrome`): initialize the `now` state to `null` and only render the time/date strings after the first `useEffect` tick, so SSR and first client render match.

## Out of scope
Dock, FX drawer, Packs drawer, audio engine, sound packs — untouched.
