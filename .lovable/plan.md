# Phase-Alignment Macro-Cycle Rule

Establish one mathematical law shared by every trigger engine: every active note completes an integer number of laps per macro-cycle, so all notes fire in unison at t=0, phase into polyrhythmic chaos, and snap back to unison at cycle end. The "Big Bang" is emergent — it's simply every voice triggering on the same frame.

## The Rule (canonical, non-negotiable)

For a scene with `N` active notes, base laps `B`, and macro-cycle duration `D` seconds:

- Note `i` (0-indexed) completes `laps_i = B + i` full traversals per macro-cycle.
- `progress_i(t) = ((t mod D) / D) * laps_i mod 1`
- A trigger fires whenever `progress_i` wraps past 1 → 0.
- At `t = k·D` for any integer k, every `progress_i = 0` simultaneously → unison.

Every engine must derive its motion from `progress_i` (or a deterministic function of it). No engine may keep its own free-running clock, use `Math.random()` per-frame, or set velocity from geometry length (which currently makes rings desync).

## Shared module: `src/lib/engine/phaseAlign.ts` (new)

Single source of truth. Exports:

- `computeProgress(t, i, B, D)` → `[0,1)`
- `crossings(t0, t1, i, B, D)` → array of trigger scene-times in `(t0, t1]` (handles multiple wraps per frame for fast notes)
- `lapsFor(i, B)` = `B + i`
- Reads `engineClock.t()`; unaffected by pause/speed because `engineClock` already integrates those.

The existing `speedCoeffs` / `phaseOffsets` in `src/lib/engine/polyrhythm.ts` become **deprecated** for cadence — kept only for visual jitter (hue offsets, initial angles), not for period math. Rewriting them would silently break scenes; the retrofit swaps call sites instead.

## Engine retrofits (all 8)

Each scene's `eventsIn(state, t0, t1, g)` and `sample(state, t, g)` are rewritten to consume `phaseAlign` for cadence. Geometry (angles, radii, lattice positions) stays; only the timing math changes.

| Engine | What changes |
|---|---|
| `stringNetwork` | Node position along path = `progress_i`; trigger on wrap. |
| `pendulumFan` | Replace `strandRatios` / sine-crossing math with `progress_i` sweep between ring endpoints; drop `RISING_PHASE` / `COOLDOWN` (cooldown obsolete — unison is now the design). |
| `spiralArp` | Arm rotation = `progress_i * 2π`. |
| `radialSweep` | Sweep angle per lane = `progress_i * 2π`. |
| `mandalaMatrix` | Petal pulse phase = `progress_i`. |
| `metatronLattice` | Node illumination cycle = `progress_i`. |
| `fractalNebula` | Orbit angle = `progress_i * 2π`. |
| `radialResonator` | Ring expansion phase = `progress_i`. |

The Phase-Zero "Big Bang" chord already fires at `t=0`; with this rule it also naturally fires at every `t=k·D`.

## Global controls: scene defaults + live overrides

**Scene Creator (`app_scenes` new columns):**
- `base_laps int not null default 10`
- `macro_cycle_seconds numeric not null default 30`
- `note_count int not null default 8` (range 4–24)

Edited in `/studio/scenes` as three sliders in a new "Macro-Cycle" section of the editor.

**Dock live override:** New "Cycle" panel in `PhaseDock` with the same three sliders. Overrides persist in `sessionUrl` (not DB). If unset, active scene's defaults apply. Reset button restores scene defaults.

**Wiring:** `SceneGlobals` gains `baseLaps`, `macroCycleSeconds`, `noteCount`. `sceneOverlay` resolves the effective values (dock override ?? active scene ?? hardcoded fallback) per frame and passes them in.

## UI: canonical proof-of-concept engine

Add a 9th `SceneKind`: `phaseAlignRings` — nested concentric circles, one dot per note orbiting clockwise (0° = top). Renders directly from `computeProgress`, no bespoke state. Serves as the visual reference that the rule is working; also useful as a "debug scene" to sanity-check retrofits.

## Build order

1. `phaseAlign.ts` module + unit-verifiable pure functions.
2. Extend `SceneGlobals` + `sceneOverlay` resolution logic.
3. Retrofit engines one at a time (stringNetwork first as smallest), verifying unison at each `k·D` visually.
4. Migration: add `base_laps`, `macro_cycle_seconds`, `note_count` to `app_scenes` (+ GRANTs already in place; column-level defaults, no policy changes).
5. Scene Creator UI: Macro-Cycle section.
6. Dock override panel + `sessionUrl` schema bump (v→2 with back-compat parse).
7. Add `phaseAlignRings` scene + register in dock's Backdrop menu.
8. `tsgo` clean; verify snapback visually on preview.

## Technical notes

- **Why kill `polyrhythm.ts` cadence use:** its coefficients are irrational-by-design (φ jitter) — they *guarantee* non-repeating cycles, which is the exact opposite of what we now want. Keep the file, mark cadence exports deprecated, migrate call sites.
- **Fast notes crossing multiple times per frame:** at high `i`, `laps_i` can be ~34 (B=10, N=24) → up to 34/60·D wraps per frame at D=1s. `crossings()` enumerates all of them so no triggers are dropped.
- **Pause/speed:** `engineClock` already integrates `speed` into `t()`. Macro-cycle math uses `t mod D` so slowing down stretches the cycle rather than breaking alignment.
- **Big Bang amplification:** deferred. Rule naturally produces unison; amplification (compressor sidechain, reverb pre-delay, volume swell) is a separate later pass.
- **`user_scenes` table** is untouched by this change.
