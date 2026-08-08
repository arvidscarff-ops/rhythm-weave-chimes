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

- Typed state: `id`, `originId`, `destinationId`, `phase`
  (`idle | launching | in_transit | approaching | arrived`), `elapsedSeconds`,
  `durationSeconds`, `progress`, `startedAtMonotonicSeconds`,
  `arrivedAtMonotonicSeconds`, `paused`. No `startedAt` / `arrivedAt` fields exist.
- One authoritative progress value: `clamp(elapsedSeconds / durationSeconds, 0, 1)`.
- Elapsed derives solely from the injected monotonic `TimeSource`, sampled on demand — never
  frame-count driven, so frame rate cannot change journey state. The runtime itself knows
  nothing about `performance.now()`; only the production `TimeSource` implementation does.
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

## Approved clarifications (folded in)

**Injectable time source.** `src/lib/crossing/timeSource.ts` exports a `TimeSource = () => number`
(monotonic seconds) with `performance.now()` as the production default and a manual source for
tests. The runtime takes it as a dependency and never calls `performance.now()` itself.

**Sampling model.** The runtime owns no requestAnimationFrame loop and no timer. `sample()`
reads the time source and recomputes state; consumers poll on their own cadence (the dev route
uses its own rAF). Events fire only from a `sample()` that detects a material change:
`phaseChanged` on phase transition, `progressChanged` only when progress moves past a small
epsilon (default 0.001) since the last emission, `crossingStarted` / `crossingArrived` once each.

**Scrub semantics.** `scrubTo()` is developer-only and intentionally runs the normal transition
logic, so scrubbing to 1.0 produces a real `arrived` phase and one `crossingArrived` event —
it is documented as indistinguishable from a natural completion by design. The arrival latch is
per-run: scrubbing back below the arrival threshold does not re-arm it, only `reset()` /
`start()` does, so repeated scrub/reset sequences can never emit arrival twice in one run.
Tests specify all three behaviors explicitly.

**Time fields (option A).** No epoch timestamps and no `Date.now()`. The fields are named
`startedAtMonotonicSeconds` / `arrivedAtMonotonicSeconds`, typed and documented as monotonic
runtime seconds from the injected `TimeSource` — not wall-clock, not persistence-safe.
Persistence/history is out of scope.

**Arrival observability.** On the arrival transition, progress is set to exactly `1.0` and a
`progressChanged` event is emitted unconditionally, bypassing the epsilon suppression, so the
final state is always observable alongside `phaseChanged` and `crossingArrived`. Covered by test.
