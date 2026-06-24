## Why the distortion happens

The audio graph clips at the destination. Three compounding causes:

1. **Per-voice peaks are too hot.** Each voice sums 2–3 oscillators at 0.3–0.55 gain into one envelope that then ramps to `peak = 0.45–0.7`. A single `pluck` or `bass` note already hits ~1.0 instantaneous on transients.
2. **Parallel mix adds, never attenuates.** `shelf → dryToMaster (gain 1.0)` AND `shelf → chorusDelay → chorusMix (0.5)` AND `shelf → delay → wet` AND `shelf → grain → grainMix` all sum into `master`. Dry is never reduced when chorus/wet/grain are added — the bus sits at 1.5–2.5× before `master.gain`.
3. **No limiter before `ctx.destination`.** Any sum > 1.0 hard-clips in the browser output stage, which on a MacBook's built-in DAC sounds like crunchy/fizzy distortion exactly when several circles fire together.

## Fix (audio engine only, no UI changes)

**File:** `src/routes/index.tsx`

1. **Add a master limiter.** Insert a `DynamicsCompressorNode` between `master` and `ctx.destination` with brickwall-ish settings: `threshold = -6`, `knee = 0`, `ratio = 20`, `attack = 0.003`, `release = 0.12`. Store as `a.limiter`.
2. **Add a headroom trim.** New `busTrim` GainNode at `0.5` placed between the parallel sends and `master` (i.e. everything that currently `.connect(master)` connects to `busTrim` instead, and `busTrim.connect(master)`). Gives ~6 dB of headroom for the four parallel paths.
3. **Make chorus a true send.** Lower `chorusMix.gain` default to `0.25` (mapping in `applyKnobs` already scales it; clamp upper bound to `0.5`).
4. **Tame per-voice peaks** in `playVoice`: drop `peak` values to `chime 0.32`, `pluck 0.42`, `bell 0.3`, `pad 0.28`, `bass 0.42`. Scale the inner oscillator gains by ~0.7 as well so harmonic stacks don't sum past 1.0.
5. **Reduce delay feedback default** from `0.55` to `0.38` to prevent buildup distortion when many notes hit.
6. **Cap `mainVol`** effective output: in `applyKnobs`, write `master.gain` as `knobs.mainVol * 0.85`.

After this, the chain looks like:

```text
voices → preFx → filter → shelf ─┬─ dryToMaster ──┐
                                 ├─ chorus ───────┤
                                 ├─ delay → wet ──┼─→ busTrim → master → limiter → destination
                                 └─ grain ────────┘
```

No visual/FX-panel changes. All slider ranges stay the same; only internal scaling and the limiter are added, so the FX presets continue to behave as before but without clipping.

## Out of scope

- No changes to the FX drawer UI, presets, or `fxState.ts` shape.
- No changes to the canvas rendering or sequencer timing.
