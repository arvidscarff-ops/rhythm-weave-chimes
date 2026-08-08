# SYS-007 — First Crossing route runtime (prototype)

Isolated implementation experiment for Codex review. Not a claim that SYS-007 is complete.

## Architecture finding

There is no existing journey/transit/route runtime in the repo. The only time authority is
`engineClock` (scene time for rhythm/geometry) plus `cycleOverride` (macro-cycle params).
A crossing is a finite, non-wrapping journey — architecturally distinct from wrapped rhythmic
phase — so extending `engineClock` would violate the "finite route progress is distinct from
wrapped phase" invariant. Therefore: a small, deletable module with a clear boundary, and no
coupling to Trigger Engines or audio.

## What gets built

**1. `src/lib/crossing/crossingRuntime.ts` — the single owner of crossing state**

- Typed state exactly as specified: `id`, `originId`, `destinationId`, `phase`
  (`idle | launching | in_transit | approaching | arrived`), `elapsedSeconds`,
  `durationSeconds`, `progress`, `startedAt`, `arrivedAt`, `paused`.
- One authoritative progress value: `clamp(elapsedSeconds / durationSeconds, 0, 1)`.
- Elapsed integrates wall-clock deltas (`performance.now()`), sampled on demand — never
  frame-count driven, so frame rate cannot change journey state.
- Configurable phase thresholds (defaults 0.05 / 0.90 / 1.0), passed in, not hardcoded canon.
- Arrival fires exactly once, guarded by a latch on the `arrived` transition.
- API: `start(opts)`, `pause()`, `resume()`, `reset()`, `scrubTo(progress)` (dev-only),
  `sample()` (returns immutable snapshot), `subscribe(fn)`.
- Events emitted through the same lightweight subscriber-set pattern already used in
  `cycleOverride.ts` — no new event bus. Callbacks: `crossingStarted`, `phaseChanged`,
  `progressChanged`, `crossingArrived`.

**2. `src/lib/crossing/routes.ts`** — one hardcoded origin/destination pair for the prototype
(`origin` → `destination`, placeholder labels; no lore names invented, since naming is
unresolved). Data-shaped so more pairs are additive.

**3. `src/routes/dev.crossing.tsx`** — isolated developer route at `/dev/crossing`.
Diagnostic-only readout (PHASE, PROGRESS, ELAPSED, DURATION, ORIGIN, DESTINATION) plus
START / PAUSE-RESUME / RESET, a duration input (30–120s), and a progress scrub slider.
Deliberately plain — monospace text and default buttons, explicitly not PHASE HUD styling.
Not linked from the player; nothing in the normal experience changes.

**4. `src/lib/crossing/crossingRuntime.test.ts`** — unit tests for determinism at fixed
elapsed values, clamping, threshold transitions, single arrival, and clean reset.

## Explicitly prototype-only

Hardcoded route pair, the threshold values, the scrub control, and the dev route itself.

## Nothing else changes

No edits to `engineClock`, scheduler, scenes, dock, or audio. No downstream consumers wired up.

## Open questions for Codex

- Should the crossing clock ever be pausable/scaled by the same authority as scene time, or
  stay fully independent (prototype assumes independent)?
- Does arrival need persistence/resume across remount (invariant 11 suggests eventually yes)?
- Should route data eventually live in the database rather than a local module?
