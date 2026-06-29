## Problem

On the first Play click, every scene already snaps to its Big Bang formation (each scene's `eventsIn` is written so the resting position at `t = 0` lies exactly on its trigger anchor — `RISING_PHASE` for pendulumFan, `angle 0` for radialSweep, `s = 0` for spiralArp, the t=0 string positions for stringNetwork). But the chord never plays: the user sees the notes start moving and only hear them when each one independently reaches its trigger point during its first cycle.

## Root cause

In `src/lib/engine/scheduler.ts`, `schedulerTick()` runs on a 25 ms interval. After `engineClock.resetPhaseZero()` + `engineScheduler.resync()`, the cursor `lastScheduledT` is set to `engineClock.t()` (= 0). By the time the first tick fires, `engineClock.t()` is already ≈ 0.025 s, so this line:

```ts
if (lastScheduledT < now) lastScheduledT = now;
```

bumps the cursor past 0 and the `eventsIn(0, ...)` window — which is the only window where the universal Big Bang events live — is never queried. The clamp exists to prevent dumping a backlog after long pauses, but it also kills the t=0 chord on every play.

## Fix

Change the clamp in `schedulerTick()` so it only triggers when we are genuinely behind (more than one horizon stale), not on the normal first tick after `resync()`:

```ts
if (now - lastScheduledT > HORIZON_S * 2) lastScheduledT = now;
```

That preserves the cursor set by `resync()` for the first tick, so `eventsIn(0, ~0.145)` runs and every scene's Big Bang events are scheduled. After the first tick, `lastScheduledT` advances normally to `horizon` and steady-state behavior is unchanged.

Also tighten the audio target so the Big Bang chord lands at the user's click rather than `+HORIZON_S` later: schedule events whose scene-time falls within the first window at `max(audioCtx.currentTime, sceneToAudioTime(eventSceneTime))`. Since `eventsIn` currently returns events without per-event scene-time, use `engineClock.sceneToAudioTime(Math.max(lastScheduledT, 0))` for the first tick's batch — i.e. schedule them at "now" in audio time — and keep the existing `horizon` target for subsequent ticks. This is a minimal change to `schedulerTick` and does not touch the scene contract.

## Scene audit (no changes required)

Verified each scene already places its rest formation on the trigger anchor:

- `pendulumFan.ts` — `phase0 = RISING_PHASE` for every strand → θ(0) hits the trigger ring.
- `radialSweep.ts` — arm at angle 0 at t=0, target placed at angle 0.
- `spiralArp.ts` — all playheads start at outer end (s=0), bucket 0 aligns to t=0.
- `stringNetwork.ts` — particles bound left-to-right and seeded on the "B" anchor at t=0.

So fixing the scheduler is sufficient to make every scene fire its full chord on first play.

## Files touched

- `src/lib/engine/scheduler.ts` — relax the `lastScheduledT < now` clamp and special-case the first-tick audio target.

## Verification

1. `tsgo` typecheck.
2. Manual: load each of the four scenes, click Play, confirm all notes sound simultaneously on the first click, then continue their independent cycles.
