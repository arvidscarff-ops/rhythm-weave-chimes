# SYS-010 — Transmission Runtime Prototype (implementation experiment)

Prototype only. Not a claim that SYS-010 is done. No audio, no radio UI, no subtitles, no narrative canon.

## Scope check (verified in repo)

- SYS-007 lives in `src/lib/crossing/crossingRuntime.ts`: poll-based `sample()`, injectable `TimeSource`, listener-object `subscribe()`, `scrubTo()` for dev, per-run arrival latch. SYS-010 will mirror these patterns and stay loosely coupled.
- No existing transmission/comms/radio runtime code exists in `src/`.
- `docs/WORLD_LORE.md` §24.2 describes transmissions as calm/professional/routine but contains no canonical transmission text or channel taxonomy. So the prototype uses clearly labelled developer placeholders ("Transmission A/B/C") and invents no lore.

## What gets built

**1. Transmission definitions** — `src/lib/transmissions/transmissionTypes.ts`
Typed definition with only the fields the prototype needs: `id`, `label` (dev placeholder text), `windowStart`, `windowEnd`, `durationSeconds`, `weight`, `oncePerCrossing`. No channel/region/source/category — canon does not support them yet.

**2. Sample data** — `src/lib/transmissions/sampleTransmissions.ts`
Three developer placeholders with prototype windows 0.10–0.25, 0.35–0.55, 0.70–0.88. Explicitly marked non-canon configuration data.

**3. Seeded random** — `src/lib/transmissions/rng.ts`
Tiny injectable seeded PRNG (mulberry32 + string→seed hash), matching the "one small function, injectable" style of `timeSource.ts`. No `Math.random()` in scheduling logic, no library.

**4. Runtime** — `src/lib/transmissions/transmissionRuntime.ts`
Owns only scheduling state: `currentTransmission`, `activeUntilSeconds`, `playedIds`, `eligibleIds`, `seed`. Owns no progress, no clock, no rAF.

API: `createTransmissionRuntime(config)` with `startCrossing(runInfo)`, `update(snapshot)`, `sample()`, `reset()`, `subscribe(listener)`.
Input is a minimal read-only snapshot `{ crossingId, progress, phase }` — a local structural type, so SYS-007 can be refactored without touching SYS-010. No import of crossing internals.
Events: `transmissionStarted`, `transmissionEnded`, `eligibilityChanged`.

**5. Dev harness** — `src/routes/dev/transmissions` route
Plain diagnostic surface in the same unstyled spirit as `/dev/crossing`: drives a real SYS-007 crossing runtime, feeds its snapshot into the transmission runtime each poll. Shows crossing phase, progress, seed, current transmission with remaining seconds, played list, eligible list. Controls: start, pause/resume, reset, progress scrub, seed entry + restart.

**6. Tests** — `src/lib/transmissions/transmissionRuntime.test.ts`
Covers every case listed in the brief, using injected manual time and fixed seeds — including an **update-rate independence** test: the same progress/time progression sampled at a high polling rate and at a sparse polling rate, with the same seed, yields equivalent admission and selection results.

## Explicit semantics (documented in code and tests)

- **Sparseness (admission at eligibility entry)**: no per-update rolls, and no `startChancePerCheck`. When a transmission first *enters* eligibility, one deterministic seeded admission roll is made from `(seed, crossingId, transmissionId, episodeIndex)` and latched for that entire eligibility episode. Repeated `update()` calls inside the window never re-roll. Admitted items may start when constraints allow (nothing active, minimum gap satisfied); rejected items stay unplayed for that episode. Leaving and re-entering the window begins a new episode with a new deterministic roll. **Invariant: changing update frequency cannot change which transmissions are admitted.** A configurable minimum gap between transmissions also applies.
- **Selection**: weighted pick, via the seeded RNG, among items currently eligible, admitted, and permitted to play.
- **`oncePerCrossing`**: a real field, not a blanket exclusion of everything played. `true` ⇒ never again during that crossing once played. `false` ⇒ may become eligible and play again under normal eligibility/admission/gap rules. All sample definitions are `true`, but the runtime respects both.
- **Determinism guarantee**: same seed + same transmission definitions + same crossing-snapshot sequence + same monotonic-time sequence ⇒ same scheduling result. Progress alone is insufficient, since duration and minimum-gap logic depend on monotonic time.
- **Progress jumps**: only the window the crossing is *currently inside* is considered. Jumping 0.20 → 0.80 never retroactively fires a 0.40–0.50 item. Scrubbing backwards cannot replay a `oncePerCrossing` item — `playedIds` is per-run and only cleared by `startCrossing()`/`reset()`.
- **Arrival**: phase `arrived` starts nothing new and immediately ends any active transmission, emitting `transmissionEnded` exactly once (reason `arrival`). Marked prototype behaviour, not canon.
- **Duration**: measured against the injectable monotonic `TimeSource`, never frame counts or `Date.now()`.

## Nothing else changes

No edits to `crossingRuntime.ts`, engine clock, trigger engines, audio, graphics, player routes. Only new files plus one new dev route.
