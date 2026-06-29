
# Universal Rest-At-Trigger Big Bang

Make every note in every scene visually sit on (or just before) its own trigger point at `t = 0`. The first play click then guarantees every note strikes simultaneously — regardless of scene, density, BPM, or speed distribution — and only afterward do the per-note polyrhythmic cycles diverge.

Right now this only half works:

- **Pendulum Fan** — nodes do rest on the ring at `t=0` (phase = RISING_PHASE) and `eventsIn` injects a chord at `t=0`. ✅
- **Mandala Matrix** — notes rest at the *center* spoke origin (u = 0) and fire center triggers. They never visually rest on the outer vertex (the "louder" trigger). ⚠️
- **Spiral Arpeggiator** — heads sit on the outermost polar grid line at `t=0`. ✅
- **Radial Sweep** — only the target at angle 0 is on the arm at `t=0`. The other N-1 targets do not fire on the first click. ❌
- **String Network** — particles start at `u=0`, but `eventsIn` uses a strict `lo < k ≤ hi` integer count that excludes `t=0`, so no Big Bang chord fires. ❌

## Goal

A single, scene-agnostic rule: at `t = 0`, every note is **visually parked on its trigger location**, and the audio scheduler fires one event per note (the "Big Bang chord") on the first tick after play. From `t > 0` onward, each scene's existing analytic `eventsIn` runs unchanged and the prime/φ velocity spread takes over.

## Approach

### 1. Add an optional `bigBang(state, g): TriggerEvent[]` to the Scene contract

A new optional method on `Scene<S>` in `src/lib/engine/sceneTypes.ts`:

```ts
bigBang?(state: S, g: SceneGlobals): TriggerEvent[];
```

It returns one event per note, positioned at that note's resting/trigger coordinates, with the same `slot`/`freq`/`hue`/`velocity` it would emit during normal play. Pure function of `(state, g)`. No mutation.

### 2. Scheduler owns the Big Bang dispatch

In `src/lib/engine/scheduler.ts`, replace today's "if window includes t≈0, schedule at currentTime" hack with an explicit one-shot:

- Track a per-binding `bigBangFired: boolean`, reset on `setActive()` and `resync()`.
- On the first tick where `engineClock.t() >= 0` and `!bigBangFired`:
  1. Call `scene.bigBang?.(state, g)` (fallback: query `eventsIn(state, -ε, +ε, g)` for legacy compatibility).
  2. Schedule every returned event at `audioCtx.currentTime` (no unison guard — the chord is intentional).
  3. Spawn ink-bleeds immediately at each event's `(x, y)`.
  4. Mark `bigBangFired = true` and advance `lastScheduledT` to a tiny positive epsilon so the normal analytic path picks up cleanly.
- Remove the current `isBigBangTick` branch and the duplicated t=0 anchor insertions inside individual scenes.

### 3. Per-scene rest-at-trigger placement + `bigBang` impl

For each scene, ensure the visual position at `t = 0` lands exactly on the point the corresponding trigger event will use, then implement `bigBang` to enumerate that chord. Strip the now-redundant `if (t0 <= 0 && 0 < t1)` insertions from `eventsIn`.

- **Pendulum Fan** (`pendulumFan.ts`)
  - Keep `phase0 = RISING_PHASE + offset` so nodes rest on their target rings.
  - Add `bigBang`: one event per strand at `(tx, ty)` (the ring coords), `velocity = velocityBase`.
  - Remove the explicit `t=0` push inside `eventsIn`.

- **Mandala Matrix** (`mandalaMatrix.ts`)
  - Decision: change resting position from center (u=0) to **outer vertex** (u=1) so notes sit on the vertex trigger — the louder, more visible "strike" point. Adjust `spokeU` to `0.5 + 0.5·cos(...)` with `t≤0 → u=1`, and update outer/center anchor enumeration accordingly.
  - Add `bigBang`: one event per note at its outer vertex, `octave = +12`, `velocity = velocityBase`.
  - Remove explicit `t=0` push.

- **Spiral Arpeggiator** (`spiralArp.ts`)
  - Already correct: `s0` is bucket-snapped, so heads rest on a polar grid line.
  - Add `bigBang`: for each playhead, compute `(x, y)` from `s = s0` and emit one event with the same pitch/slot/hue/velocity it would emit on that grid crossing.

- **Radial Sweep** (`radialSweep.ts`)
  - The sweep arm geometry can't park all targets at once. Treat the Big Bang as a **conceptual** chord: every target fires once at `t=0` at its own `(x, y)`, while the arm still starts at angle 0 and the per-target analytic schedule resumes from `t > 0`.
  - Add `bigBang`: enumerate all targets with `velocity = velocityBase`. Bump each target's `lastFireT = 0` so the arm's first orbital sweep through angle 0 doesn't double-strike that target inside the refractory window.
  - The existing `lastFireT = -Infinity` initialization handles future cycles cleanly.

- **String Network** (`stringNetwork.ts`)
  - Particles already rest at endpoint A (u=0) — which *is* an endpoint trigger location.
  - Add `bigBang`: one event per particle at `(A.x, A.y)` for the resolved string at `t=0`.
  - In `eventsIn`, change the integer-crossing count from `lo < k ≤ hi` to `lo < k ≤ hi` *plus* exclude `k = 0` exactly (Big Bang owns it). Cleanest: leave `eventsIn` strictly post-Big Bang and let the scheduler's `bigBangFired` gate handle the gap.

### 4. Strip per-scene Big-Bang anchors

Once the scheduler owns the chord, remove every `if (t0 <= 0 && 0 < t1) hits.push(...)` snippet from `mandalaMatrix.ts` and `pendulumFan.ts`. They become dead code and risk double-firing.

### 5. Plan doc

Update `.lovable/plan.md` with the new contract: "All notes rest on their trigger point at `t=0`. The scheduler dispatches one chord on the first post-play tick via `scene.bigBang()`. `eventsIn` is responsible only for `t > 0`."

## Out of scope

- Legacy `wheel`/`pendulum`/`bars` scenes (still on the imperative path).
- Sound pack / dock / UI changes.
- Any change to the prime/φ velocity distribution itself.

## Files touched

- `src/lib/engine/sceneTypes.ts` — add `bigBang?` to `Scene<S>`.
- `src/lib/engine/scheduler.ts` — one-shot Big Bang dispatch, drop `isBigBangTick` branch.
- `src/lib/scenes/pendulumFan.ts` — add `bigBang`, drop t=0 push.
- `src/lib/scenes/mandalaMatrix.ts` — flip rest to outer vertex, add `bigBang`, drop t=0 push.
- `src/lib/scenes/spiralArp.ts` — add `bigBang`.
- `src/lib/scenes/radialSweep.ts` — add `bigBang` + set `lastFireT=0` per target.
- `src/lib/scenes/stringNetwork.ts` — add `bigBang`.
- `.lovable/plan.md` — note the new contract.

## Acceptance check

On every scene, clicking play from a fresh load (or after Phase-Zero reset):
1. Every visible note is parked on its trigger point at the moment of click.
2. A single audible chord lands on click — N voices, one per note.
3. Within the next 50 ms the prime/φ unison guard kicks the cycles apart and the polyrhythmic motion takes over.
