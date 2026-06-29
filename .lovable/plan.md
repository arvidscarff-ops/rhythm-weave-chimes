
# Prime-Distributed Velocity refactor

Confirmed: shifting from "uniform / linear ratio" speeds to a **Prime-Ratio + φ distribution** shared across every Phase-Zero scene. This is generative-rhythm hygiene: incommensurable speed ratios guarantee strands phase out of unison the instant the t=0 chord releases.

## 1. New shared module — `src/lib/engine/polyrhythm.ts`

Single source of truth for per-note speed/phase assignment so every scene (and the Mandala work) draws from the same well.

- `PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37]`
- `PHI = (1 + √5) / 2`
- `speedCoeffs(N): number[]` → for `i ∈ 0..N-1`:
  - `raw_i = PRIMES[i % len] / PRIMES[len-1]` (your spec) **plus** a φ jitter `* (1 + ((i * PHI) % 1 - 0.5) * 0.07)` so wrapping past `PRIMES.length` still yields unique, irrational-ish values.
  - Normalize so the **max coefficient = 1** → `BaseSpeed` from each scene stays meaningful.
- `phaseOffsets(N): number[]` → `(i * (1 - 1/PHI)) % 1` (golden-angle 1-D analog). Even, non-repeating distribution in `[0,1)`.
- `pathNormalizedSpeed(coeff, baseSpeed, pathLen)` → returns the velocity that makes one full traversal take `pathLen / (baseSpeed * coeff)` **scene-seconds**, so the polyrhythmic ratio — not the geometry — sets the ignition cadence.

All functions are pure. No state. Documented as the canonical helper; future scenes must use it.

## 2. Per-scene wiring

### Mandala Matrix (`src/lib/scenes/mandalaMatrix.ts`)
- Replace `FIB_RATIOS` + `i % 5` cycling with `speedCoeffs(N)`.
- Each note gets `phaseOffset_i` from `phaseOffsets(N)`. Position formula becomes:
  `u_i(t) = 0.5 - 0.5 * cos(2π * ((t / T_i) + phaseOffset_i))`
- **Big Bang preservation:** `phaseOffset` is applied to the *cosine argument*, not to `t`, AND we add a hard rule: at `t ≤ 0` we clamp `u_i = 0` for every note. The t=0 chord still fires (engine path is `eventsIn` with the existing t=0 boundary); offsets only start to bite for `t > 0`.
- `eventsIn` cosine-root enumeration updated to include the offset (closed-form: shift the k-window by `-phaseOffset_i * T_i`).
- Path-length normalization isn't relevant here (all spokes equal length R), but `pathNormalizedSpeed` is used so future asymmetric variants stay correct.

### Pendulum Fan (`pendulumFan.ts`)
- Replace `RATIOS[]` table with `speedCoeffs(N)` (mapped to the existing `ratio` field; faster coeff = smaller period multiplier, preserving fast-left/slow-right).
- Add `phase0 += phaseOffsets(N)[i]` *only when `i > 0`*. Strand 0 stays on `RISING_PHASE` so the Big Bang ring still ignites; the other strands are perturbed by a fraction of a θ-cycle so they desynchronize after the first hit. (Acceptable trade-off: only the leftmost strand sits exactly on its ring at t=0, but every strand still fires its own t=0 trigger via the eventsIn boundary because `RISING_PHASE` is the analytic anchor — we shift the *future* schedule, not the t=0 event.)
  - Alternative if you want every strand exactly on its ring at t=0: keep `phase0 = RISING_PHASE` for all and inject `phaseOffset` as an additive term inside `strandD` from `t > 0`. I'll go with this alternative — it's cleaner and preserves the chord 100 %.

### Spiral Arpeggiator (`spiralArp.ts`)
- Replace the hardcoded `speed: 22 / 28 / 18` and the 3-playhead default with `N` playheads derived from density, speeds from `speedCoeffs(N) * BASE_SPIRAL_SPEED`.
- Phase offsets distribute `s0` across `arcAtBucket[]` (currently `applySpeedToLeftRight` already snaps to bucket angles — extend it to also offset by `phaseOffsets(N)[i] * Ltotal / N` along arc length, then re-snap to nearest bucket so the Big Bang chord still lands on grid lines).
- Path normalization already implicit (arc length is uniform per playhead); leave intact.

### Radial Sweep (`radialSweep.ts`)
- The sweep arm has a single angular velocity ω, so "prime-distributed velocity" doesn't apply to motion. Instead apply it to **target placement**: replace the even half-arc distribution with `targetAngle_i = 2π * phaseOffsets(N)[i]`. This breaks the uniform cadence that currently makes targets fire at evenly-spaced moments. Velocity of each *event* (per-target ω is constant) stays the same; the polyrhythm comes from non-uniform angular spacing.

### String Network (`stringNetwork.ts`)
Out of scope for this pass unless it already uses ratios — I'll audit and report; no behavioral change without your sign-off.

## 3. Unison guard in the scheduler — `src/lib/engine/scheduler.ts`

Add a `UNISON_GUARD_S = 0.05` window applied **only when `isBigBangTick === false`** (the t=0 chord is intentional and must remain).

```text
within each tick:
  events.sort by (when, slot)
  lastWhenBySlot = {}
  for ev in events:
    if !isBigBangTick:
      conflict = events scheduled to fire within 50 ms
      if conflict:
        when += micro_nudge (deterministic: ±0.012 s based on slot parity)
    schedule(ev, when); record lastWhenBySlot
```

The nudge is **time-only** (delay the dispatch), not a speed mutation — speed mutation would desync the visual ink-bleed from the audio. The dispatch's `spawnInkBleed` is moved to fire at the nudged audio time via `setTimeout(..., nudgeMs)` so the visual still lands with the sound.

This satisfies your "automatically nudge by ±0.05" intent while keeping the visual/audio contract intact and never altering scene-time geometry.

## 4. Audit deliverable

Updated `.lovable/plan.md` with:
- Confirmation that all four engine scenes now route through `polyrhythm.ts`.
- Note on the one deliberate exception (t=0 Big Bang exempt from unison guard).
- Note that string-network was reviewed but left alone (pending sign-off).

## Out of scope

- Legacy `wheel` / `pendulum` / `bars` paths.
- `packs.ts` — voice sample assignment is orthogonal to speed distribution; no changes needed.
- Dock UI.
- Big Bang flash effect.

## Files touched

- new `src/lib/engine/polyrhythm.ts`
- edit `src/lib/scenes/mandalaMatrix.ts`
- edit `src/lib/scenes/pendulumFan.ts`
- edit `src/lib/scenes/spiralArp.ts`
- edit `src/lib/scenes/radialSweep.ts`
- edit `src/lib/engine/scheduler.ts`
- edit `.lovable/plan.md`
