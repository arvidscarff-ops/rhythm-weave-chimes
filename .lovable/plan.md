## Global slowdown — 4× reduction of note motion

Current player SPD slider: `0.25×–2×` (default `1×`). Studio preview: fixed `1×`.

User rule: today's *slowest* speed is the new *fastest*. So the entire range shrinks by 4×.

### Changes

1. **Speed knob range** — `src/components/dock/PhaseDock.tsx`
   - InlineSlider "SPD": `min 0.0625`, `max 0.25`, `step 0.01`, digits 2.

2. **Default speed** — `src/routes/index.tsx`
   - Initial `knobs.speed` from `1` → `0.25` (new max = current default feel divided by 4).
   - Any scene-action that sets `speedMultiplier` (line ~1200) gets clamped to the new max via `Math.min(0.25, a.speedMultiplier)` so old triggers can't override the cap.

3. **Studio preview player** — `src/routes/studio.builder.tsx`
   - The preview builds `globalTime` from a local `performance.now()` counter at 1× and passes `speed: 1` in globals. Multiply the preview's derived `t` by `0.25` before handing it to `customScene` so preview motion matches the app's new default. The pause/resume offset math continues to work because we only scale the output `t`, not `startRef`.

### Not touched

- `engineClock.setSpeed` internals stay as-is; the cap is enforced at the UI/default boundary so any code reading `engineClock.getSpeed()` keeps working.
- Phase-Alignment math (`baseLaps`, `macroCycleSeconds`) is unchanged, so the Big Bang cadence still lands exactly on macro-cycle boundaries — the whole clock just runs slower.
- No changes to audio pitch, no changes to particle physics, no other engines touched.

### Verification

- Load `/` → SPD slider tops out at `0.25×`, notes crawl compared to before.
- `/studio/builder` → preview motion matches the app at its new max.
- Toggle preview Play/Pause → still freezes cleanly.