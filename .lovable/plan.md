# Plan: Big Bang as Emergent Coincidence

## Intent
The Big Bang is **not** a separate feature. It is simply the visible/audible result of every note happening to cross its trigger point in the same scheduler tick. We should:

1. Keep notes resting on their trigger points at `t = 0` (so play starts with a natural coincidence chord).
2. Let the normal `eventsIn(t0, t1)` path emit those simultaneous hits — no special dispatcher, no flag.
3. Allow this to happen again whenever the polyrhythm cycles realign (technically unbounded times).

## Changes

### 1. `src/lib/engine/sceneTypes.ts`
- Remove the optional `bigBang?(state, g): TriggerEvent[]` from the `Scene<S>` interface. Coincidence is just `eventsIn` doing its job.

### 2. `src/lib/engine/scheduler.ts`
- Delete `bigBangFired`, the `scene.bigBang?.(...)` call, and the post-bigbang `lastScheduledT` floor.
- `eventsIn` is called from `t = 0` inclusive on the first tick, so the resting-on-trigger chord emerges naturally.
- Keep `UNISON_GUARD_S` (≥ 50 ms) — but this is the polyrhythm safety nudge for *near*-coincidences. **Exact** coincidences (multiple notes hitting `t = 0` together, or a future realignment tick) must pass through untouched as a single chord. Update the guard to bypass nudging when the time delta is `< 1 ms` (treat as the same instant = intentional chord) and only nudge separations in `[1ms, 50ms)`.

### 3. Per-scene `eventsIn` must include `t = 0`
Currently several scenes were changed to enumerate strictly `t > 0` to avoid double-firing with the dispatcher. Revert that:
- **`mandalaMatrix.ts`** — include the `t = 0` crossing; remove the `bigBang` method and the "strictly `t > 0`" guard.
- **`pendulumFan.ts`** — remove `bigBang`; ensure first-tick crossing at the resting ring emits via `eventsIn`.
- **`spiralArp.ts`** — remove `bigBang`; let the playhead emit its grid-line crossing at `t = 0`.
- **`radialSweep.ts`** — remove `bigBang`; ensure the arm at angle 0 with all targets at angle 0 fires every target on the first tick.
- **`stringNetwork.ts`** — remove `bigBang`; restore the integer-crossing count to include `k = 0` (anchor A).

### 4. Resting positions stay as already implemented
All five scenes already park their notes on the trigger point at `t ≤ 0` from the previous change. Keep that — it's what makes the first-tick coincidence happen.

### 5. `.lovable/plan.md`
Document the new contract:
- Notes rest on their trigger point at `t ≤ 0`.
- The scheduler has no special "big bang" path.
- A "big bang" is the emergent visual/audible event of N notes crossing in the same tick — happens on play, and again on any future polyrhythm realignment.
- `UNISON_GUARD_S` only nudges near-but-not-exact coincidences (1–50 ms apart) to preserve rhythmic independence; exact coincidences (< 1 ms) are preserved as chords.

## Files
`sceneTypes.ts`, `scheduler.ts`, `mandalaMatrix.ts`, `pendulumFan.ts`, `spiralArp.ts`, `radialSweep.ts`, `stringNetwork.ts`, `.lovable/plan.md`.

## Out of scope
Sound packs, dock/UI, prime/φ velocity distribution, legacy scenes.

## Open question
Should the visual ink-bleed / flash be amplified when N ≥ some threshold of notes fire in the same tick (a "the cycle realigned!" emphasis)? Default in this plan: **no special visual** — the simultaneous strikes already produce a stacked bleed naturally. Say the word if you want a coincidence-detector that boosts the flash on realignment ticks.
