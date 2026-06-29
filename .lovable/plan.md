
# Universal Big Bang + Notes Multiplier + Subtler Flash

Three connected changes that apply to every scene (`wheel`, `pendulum`, `bars`, `stringNet`, `pendulumFan`, `spiralArp`, `radialSweep`).

## 1. "Notes" multiplier per scene

The dock already has a `multiply` (DEN) slider that scenes consume as `density`. We'll:

- Rename the dock affordance from `Multiply / DEN·N` to **Notes** with a slider readout of *how many notes will actually play* in the active scene (so the user sees "9 notes" instead of "DEN·5"). The slider keeps the same 2..12 control range; we just label the result.
- Add a `noteCount(scene, density)` helper that mirrors each scene's existing density→N math (`anchorCount` for stringNet → strings × 2 particles, `strandCount` for pendulumFan, `spiralTurns × playheads(3)` for spiralArp, `targetCount` for radialSweep, ring slot counts for wheel/pendulum/bars).
- Show the resolved number in the dock chip and in the slider page.

No engine changes; this is a labeling + helper layer over the existing density knob.

## 2. Universal "Big Bang on commit" behaviour

Today `resetPhaseZero()` only fires when the user clicks the Big Bang button. We'll auto-fire it whenever the *composition shape* changes, so the user always starts a cycle from the rest formation:

Trigger `engineClock.resetPhaseZero()` from `src/routes/index.tsx` when any of these change:

- `scene` (scene switch)
- `knobs.multiply` (notes count)
- `composer.scaleId`, `composer.root`, or any slot's `k`/`n`/`rotation`/`noteMode`
- The first time `togglePlay` transitions from paused → playing (so "click play" always restarts the universe from t=0; pause→resume from mid-cycle still keeps phase)

Implementation: a small `useEffect` keyed on a memoised "shape signature" string that calls `engineClock.resetPhaseZero()` + `engineScheduler.resync()`. In `togglePlay`, when starting from `playing=false` *and* scene-time has advanced past the previous phase-zero by more than a small epsilon since the last shape change, also call `resetPhaseZero()` before `resume()`.

Each scene's existing Phase-Zero contract already guarantees every node sits on its trigger position at t=0 and fires the Big Bang chord — no per-scene code change needed beyond what's already in place.

After N cycles the geometry naturally re-aligns: spiralArp at `lcm(arcAtBucket spacing) / speeds`, pendulumFan at `lcm(RATIOS)` periods, radialSweep at one full sweep, etc. No code needed — the cyclical re-alignment is emergent from the deterministic equations.

## 3. Tame the Big Bang flash

Right now, when the Big Bang fires every node simultaneously each note calls `flashBus.flash(x, y, 0.8, hue)`, which accumulates into a near-full-screen white bloom. We'll:

- **Cap simultaneous flash contributions.** In `src/lib/neural/flashBus.ts`, add a 60ms coalescing window: if multiple `flash()` calls arrive within the window, average their positions and only add `min(0.35, base + 0.05 * count)` to the neural target instead of stacking each one. This keeps individual-note flashes lively but turns 12 concurrent flashes into a single soft pulse.
- **Soften shader response.** In `src/components/ui/neural-noise.tsx`, lower the per-flash contribution: change `state.flash.target + 0.25 + f.intensity * 0.35` to `+ 0.12 + f.intensity * 0.22`, and lower the final additive term `flash * 0.18 → * 0.10` and the alpha bonus `flash * 0.22 → * 0.12`. Shorten release from 1.4s to 0.9s so the haze clears faster.
- **Skip the burst/shockwave layer on the synchronous Big Bang.** In `togglePlay` and the auto-reset effect, set a 120ms `bigBangSuppressVisualsUntil` timestamp; the `spawnBurst` / `spawnShockwave` calls in `index.tsx` (lines ~1826/2197/2309) check this and only emit a single shared shockwave at canvas-center with reduced amplitude instead of one per note.

Audio is unaffected — the chord still fires; only the visual saturation is reduced.

## Files touched

- `src/routes/index.tsx` — shape-signature effect, togglePlay reset, big-bang-visual gate, dock prop wiring.
- `src/components/dock/PhaseDock.tsx` — relabel `Multiply` → `Notes`, show resolved note count.
- `src/lib/neural/flashBus.ts` — coalescing window.
- `src/components/ui/neural-noise.tsx` — softer flash envelope.
- (No scene file changes — Phase-Zero contract already covers Big Bang formation.)

## Open question

Should the **pause → resume** action also re-Big-Bang, or only the first play after a shape change? Default in the plan: only first play / shape change resets; mid-session pause keeps your place. Tell me if you want every play click to restart from t=0.
