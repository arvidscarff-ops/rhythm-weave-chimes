# Phase-Zero Global Clock Refactor

Acknowledged. Every scene becomes a deterministic, stateless function of one
shared `globalTime` (seconds, monotonic, modulated by `speed`). Nothing else
advances on its own.

## Audit findings (what violates the mandate today)

Every per-frame `+= dt` mutation across the engine. From the audit:

- `index.tsx`: `ring.phase += omega*dt`, `bob.phase += dt/period`,
  `lane.phase += dt/period`, plus flash decays, sparks, bursts, flares,
  shockwaves, ink-bleeds.
- `stringNetwork.clock`, `pendulumFan.clock + strand.phase`,
  `spiralArp.clock`, `radialSweep.clock` — every scene increments its own
  local clock.
- `SceneGlobals` exposes `bpm/speed/density/pitchSemis/audioNow` but **no
  `globalTime`** — scenes have no choice today but to track time locally.
- Audio scheduler is imperative: triggers fire at `ctx.currentTime + 0.01`
  from inside the render loop. No lookahead.
- `SessionState` partially saves phase (pendulum/bars/engine scene clocks)
  but wheel ring phase isn't stored — proof that phase isn't currently
  treated as canonical state.

## Target architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│  engineClock (singleton, src/lib/engine/clock.ts)               │
│    audioCtx.currentTime  →  rawT                                │
│    rawT × speed (integrated) → globalTime                       │
│    phaseZeroAt: number   (last "Big Bang" reset, in globalTime) │
│    t(): number = globalTime - phaseZeroAt                       │
└───────────────┬──────────────────────────────┬──────────────────┘
                │                              │
                ▼                              ▼
   render loop (rAF)               audio scheduler (25 ms tick)
   for each visible scene:         look ahead t..t+0.12 s,
     positions = scene.sample(t)   call scene.eventsIn(t0,t1),
     draw(positions)               schedule voices at
                                     ctx.currentTime + (eventT - t)
```

**Scene contract becomes pure:**

```ts
interface Scene<S> {
  init(g): S                                  // geometry only — no clock
  sample(state, t, g): RenderFrame            // positions at time t
  eventsIn(state, t0, t1, g): TriggerEvent[]  // triggers in [t0, t1)
  // no update() that mutates a clock
}
```

`t = 0` is the universal Phase-Zero: every `sample(state, 0)` returns each
node/particle at its origin/trigger position, and `eventsIn(state, 0, ε)`
fires the "Big Bang" chord (every voice in the active scene triggers at
t=0 simultaneously). A new `Reset to Phase Zero` control sets
`phaseZeroAt = globalTime`.

## Implementation steps

1. **`src/lib/engine/clock.ts` (new).** Singleton with:
   `start(audioCtx)`, `pause()`, `resume()`, `setSpeed(x)`, `resetPhaseZero()`,
   `t()` (scene time, seconds), `audioToSceneTime(audioNow)`,
   `sceneToAudioTime(t)`. Speed changes integrate so `t` stays continuous.

2. **`src/lib/engine/sceneTypes.ts`.** Add `globalTime: number` to
   `SceneGlobals` (kept for back-compat reads). Add the new pure-function
   methods `sample` and `eventsIn` to the `Scene` interface. Keep `update`
   temporarily as a deprecated no-op shim so the refactor can land
   scene-by-scene without breaking the build.

3. **Engine scenes — convert one at a time** (stringNetwork → pendulumFan →
   spiralArp → radialSweep). For each:
   - Move every `clock`/`phase` field out of state. State now holds only
     immutable geometry (anchors, strand base periods, spiral params,
     target angles).
   - `sample(state, t)` computes positions from `t` with `%` modulo on the
     scene's period — so the loop is truly infinite and deterministic.
   - `eventsIn(state, t0, t1)` solves crossings analytically (root-find
     where a sine/linear sweep equals the threshold inside the window)
     instead of comparing this-frame vs last-frame signs.
   - At `t = 0` every node sits on its origin and every analytical
     crossing solver emits a trigger — Phase-Zero "Big Bang" falls out
     for free.

4. **Legacy scenes (wheel / pendulum / bars).** Same treatment, scoped to
   the same file (`src/routes/index.tsx`):
   - Wheel: `ring.phase = (ring.startPhase + sign * omega * t) % 2π`.
     Note triggers via analytical line-crossings in
     `eventsIn(t0, t1)`.
   - Pendulum bobs / bar lanes: `phase = (startPhase + t/period) % 1`.
   - Remove ring/bob/lane `phase` fields from runtime state; keep
     `startPhase` (constant per element) so layouts are still editable.

5. **Audio scheduler (`src/lib/engine/scheduler.ts`, new).** 25 ms
   `setInterval`. Each tick:
   - Read `now = engineClock.t()`, `horizon = now + 0.12`.
   - Call `activeScene.eventsIn(state, lastScheduledT, horizon)`.
   - For each event at scene-time `eT`, schedule via
     `triggerPackVoice(ctx, dest, pack, slot, freq, sceneToAudioTime(eT))`.
   - Advance `lastScheduledT = horizon`. On Phase-Zero reset or scene
     switch, flush any pending Web Audio nodes scheduled past `now` and
     reset `lastScheduledT = 0`.
   This replaces the imperative `dispatchTriggers` path. `triggerBus`
   stays as a UI-only event channel for visuals (flashes/bursts).

6. **Visual decays (flash, sparks, bursts, flares, shockwaves, ink-bleeds).**
   Each particle stores `bornAt` (scene-time). Brightness/lifetime is
   derived: `alpha = decay(t - bornAt)`. Particles whose `t - bornAt`
   exceeds `lifetime` are culled. No per-frame `-= dt` anywhere.

7. **Render loop.** Becomes a thin shell:
   ```ts
   function frame() {
     const t = engineClock.t();
     const positions = activeScene.sample(state, t, g);
     draw(ctx, positions, t);
     raf = requestAnimationFrame(frame);
   }
   ```
   No `dt` parameter passed anywhere except into the optional visual
   easing for hover opacity (UI-only, not engine state).

8. **Scene switching.** `engineClock.t()` keeps running; switching scenes
   just swaps the `activeScene` pointer. Because both old and new scenes
   are pure functions of `t`, there's no visible discontinuity — the new
   geometry appears already in motion at the current phase.

9. **`SessionState`.** Replace the scattered phase fields with a single
   `clock: { t: number; speed: number }` at the top level, captured at
   share-time. On hydrate, set `engineClock` to that `t` and call
   `resetPhaseZero` only if the user asks. Remove
   `engine.{...}.clock/arm/tc` and the pendulum/bars per-element phases —
   they're no longer state. Old hashes that include those fields are
   read tolerantly (ignored) so existing share links keep loading.

10. **Dock additions.**
    - `⏮ Phase Zero` button next to play/pause — calls
      `engineClock.resetPhaseZero()` (instant Big Bang chord, all
      voices fire at t=0).
    - Metadata strip gets a `T+mm:ss.ss` readout next to BPM / SPD /
      DEN, so the global clock is visible.

## Sequencing & risk

Land in this order to keep the app runnable every step:

1. Clock singleton + `globalTime` in `SceneGlobals` (additive, zero risk).
2. Scheduler module, wired in parallel with the existing imperative path
   behind a feature flag; flip per-scene as each one converts.
3. Convert engine scenes one at a time (stringNet first — simplest
   geometry, cleanest analytical crossings).
4. Convert legacy wheel/pendulum/bars.
5. Delete the deprecated `update()` shim and the old `dispatchTriggers`
   render-loop call site. Migrate `SessionState`.
6. Add Phase Zero button + T+ readout.

Each step is independently shippable and reversible. The mandate ends up
enforced by the type system: `Scene` no longer has a mutable-clock
escape hatch.

## Out of scope (call out)

- Tempo automation / curves — `speed` stays a scalar for now.
- Swing / micro-timing — would attach to `eventsIn` later as a phase
  offset per element.
- Non-Lovable scene plugins — the new contract is plugin-ready but no
  plugin loader is built here.

## Credit estimate

- Steps 1–2 (clock + scheduler skeleton, feature-flagged): ~3
- Step 3 (4 engine scenes × ~1.5): ~6
- Step 4 (legacy wheel + pendulum + bars): ~4
- Step 5 (cleanup, session migration): ~2
- Step 6 (UI: Phase Zero button + T+ readout): ~1

**Total: ~14–18 credits**, spread across 6 shippable slices.
