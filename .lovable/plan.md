# SYS-006 — Transit Movement Sandbox (prototype)

An isolated developer playground for testing how steering *feels* during transit. Nothing here is canon, and the whole thing is deletable without touching the player, audio, crossing, or trigger engines.

## What gets built

**1. Pure movement model (no rendering, no input, no loop)**
A tiny simulation module holding only: position, velocity, heading, steer input, base speed. One `step(state, input, dt, params)` function, delta-time based, allocation-light, with pathological `dt` clamped (frame stalls cannot cause jumps). Forward motion is always on; input only bends lateral/vertical motion. No physics library, no new clock.

**2. Input abstraction**
Movement logic never sees key codes. A keyboard adapter (WASD / arrows) produces a normalized `{ steerX, steerY }` in -1..1, with a smoothed return-to-neutral on release so controller/mouse/touch adapters can be added later without touching the model.

**3. Camera**
Separate module: chase camera with follow strength, look-ahead and damping, reading movement state read-only.

**4. Dev route `/dev/movement`**
Dark space, sparse depth markers and a horizon reference, simple glider marker — just enough to read direction, inertia and settling. Live sliders for base speed, steering strength, acceleration, damping, max lateral speed, plus camera params. Three dev-only presets: CALM, RESPONSIVE, DRIFT. Buttons: Reset defaults, Copy settings (JSON to clipboard). Debug readout: position, velocity, speed, steerX/Y, dt, live params. Optional read-only crossing progress line (First Crossing %, sampled from SYS-007 — movement never writes to it). Existing SYS-005 profiler probe can be enabled with `?perf=1`; no profiler code is duplicated.

**5. Tests** on the pure math only:
zero input stays numerically stable and keeps moving forward; identical input + dt sequence reproduces identical state; steering respects max lateral speed; damping decays lateral velocity after release; values stay finite; reset restores clean state; a 5-second `dt` spike does not teleport.

## Technical notes

- New files only: `src/lib/movement/movementModel.ts`, `movementInput.ts`, `movementCamera.ts`, `movementPresets.ts`, `movementModel.test.ts`, and `src/routes/dev.movement.tsx`.
- Rendering is plain Canvas2D with a cheap perspective projection of a point field — no shaders, no three.js, no particle systems.
- The route owns the rAF loop; the model exposes only `step()`, matching how SYS-007/SYS-010 keep loops out of runtimes.
- Time comes through the existing injectable `TimeSource` boundary; `engineClock` is untouched.
- No audio mapping. State is readable enough that a later system could consume speed / steer amount / directional change.

## Explicitly prototype-only

Movement equations, defaults, presets, camera behaviour, visuals, key bindings, baseline speed. SYS-006 stays open pending Codex review.
