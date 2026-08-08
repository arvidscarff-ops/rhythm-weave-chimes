# SYS-006 — Transit Movement Sandbox (prototype)

An isolated developer playground for testing how steering *feels* during transit. Nothing here is canon, and the whole thing is deletable without touching the player, audio, crossing, or trigger engines.

## What gets built

**1. Pure movement model (no rendering, no input, no loop)**
Authoritative state is only **position** and **velocity**. Base speed and steer input are per-frame params/inputs, never stored in state; heading is *derived* from velocity rather than kept as a second source of truth. One `step(state, input, dt, params)` function, delta-time based, allocation-light, with pathological `dt` clamped inside the simulation boundary (a stalled tab cannot teleport). Forward motion is always on; input only bends lateral/vertical motion. No physics library, no new clock.

Params: baseSpeed, steeringStrength, acceleration, damping, maxLateralSpeed — camera params kept separate.

**Coordinate frame (prototype):** +Z forward transit, +X lateral, +Y vertical. `baseSpeed` drives the forward (z) component only; `steeringStrength`, `acceleration`, `damping` and `maxLateralSpeed` act only on x/y. Guaranteed and tested: zero input keeps baseline forward motion, damping after release never bleeds forward speed, steering never raises forward speed, `maxLateralSpeed` caps lateral/vertical rather than total magnitude, and total speed may naturally exceed baseline while carving while one clear forward baseline remains.

Reset goes through an explicit `createMovementState(params)` / `resetMovementState` initializer in the model — tests exercise that helper, not route state.

**2. Input abstraction (dumb adapters)**
The keyboard adapter normalizes device state only: pressed keys to ±1, released keys straight to 0. All feel — acceleration, inertia, damping, coast, recentring — lives in the movement model and its params, so controller, mouse or touch can later feed equivalent normalized input into identical behaviour.

**3. Camera**
Separate module: chase camera with follow strength, look-ahead and damping, reading movement state read-only.

**4. Dev route `/dev/movement`**
Dark space, sparse depth markers and a horizon reference, simple glider marker — just enough to read direction, inertia and settling. Live sliders for base speed, steering strength, acceleration, damping, max lateral speed, plus camera params. Three dev-only presets: CALM, RESPONSIVE, DRIFT. Buttons: Reset defaults, Copy settings (JSON to clipboard). Debug readout: position, velocity, speed, steerX/Y, dt, live params. No crossing progress readout: there is no existing shared read-only source for an active crossing (the SYS-010 sandbox constructs its own instance), and standing up a second runtime or global ownership just to print a percentage is exactly the coupling to avoid — movement stays independently testable. Existing SYS-005 profiler probe can be enabled with `?perf=1`; no profiler code is duplicated.

**5. Tests** on the pure math only:
zero input stays numerically stable and keeps moving forward; identical input + dt sequence reproduces identical state; steering respects max lateral speed; damping decays lateral velocity after release; values stay finite; reset restores clean state; a 5-second `dt` spike does not teleport.

## Technical notes

- New files only: `src/lib/movement/movementModel.ts`, `movementInput.ts`, `movementCamera.ts`, `movementPresets.ts`, `movementModel.test.ts`, and `src/routes/dev.movement.tsx`.
- Rendering is plain Canvas2D with a cheap perspective projection of a point field — no shaders, no three.js, no particle systems.
- The route owns the rAF loop; the model exposes only `step()`, matching how SYS-007/SYS-010 keep loops out of runtimes.
- `dt` comes straight from the route's own monotonic rAF timestamps; no `TimeSource` indirection where it buys nothing. The pure model receives only `dt`. `engineClock` is untouched.
- No audio mapping. State is readable enough that a later system could consume speed / steer amount / directional change.

## Explicitly prototype-only

Movement equations, defaults, presets, camera behaviour, visuals, key bindings, baseline speed. SYS-006 stays open pending Codex review.
