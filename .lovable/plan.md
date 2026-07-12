## Void Sheets — travel + path fixes

Two focused changes in `src/lib/scenes/voidSheets.ts`. No other files touched.

### 1. Full-length side-to-side traversal
Today, `travelOf(p)` maps progress 0→0.5→1 to distance 0→1→0, and `xn = CENTER_X + side * travel * MAX_TRAVEL`. That means a note only ever occupies its half of the sheet (center → outer edge → center), never crossing to the other side.

Change to a full sweep across the sheet:
- Range: `xn ∈ [X_MIN, X_MAX]` (the full drawn sheet).
- Motion: triangular wave over progress `p ∈ [0,1)` → `xn` goes `X_MIN → X_MAX → X_MIN` in one macro-lap.
- Preserve per-note phase variety by using `n.side` as a half-cycle offset (odd notes start at the right edge and sweep left first, even notes start at the left). This keeps left/right diversity without halving the travel.
- Trigger point stays the central ignition axis: notes still cross `x = CENTER_X` twice per lap, which is when `crossings()` fires — no change to rhythm/audio.

### 2. Notes actually ride the wavy path
`y` is already computed from `sheetYNorm(xn, sheetIndex)`, which is the same function used to draw the sheet, so notes are technically on the curve — but the wave amplitude is small enough (`~0.024 * H`) that against wide travel it reads as a straight line.

Tuning to make the meander clearly visible:
- Increase primary sheet amplitude (`amp`) roughly 2–2.5×.
- Slightly increase secondary amplitude for richer ripple.
- Bump `WAVE_FREQ` a touch so more crests exist across the full sweep (each sheet reads as multi-lobed, not one shallow hump).
- Keep envelope compression at center so the ignition seam stays tight (matches the concept board).

### Not changing
- `phaseAlign` progress/crossings — rhythm engine untouched.
- Trigger dispatch, pack routing, note ↔ slot mapping.
- Sheet count, palette, ignition axis, halo/core rendering.
- Any other scene, dock, or shell code.

### Verification
- Typecheck.
- Visually confirm in preview: pick a single sheet, watch one note traverse from one outer edge to the other along the visible curve, crossing center once per half-lap.
