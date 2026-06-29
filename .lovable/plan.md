# Plan: Metatron Lattice scene (25-note nested geometry)

## Geometry

Four concentric, centered polygons drawn additively at 0.5 px line weight:


| Layer | Shape     | Vertices | Radius (× minR) | Pack assignment |
| ----- | --------- | -------- | --------------- | --------------- |
| 0     | Triangle  | 3        | 0.16            | moss (Ethereal) |
| 1     | Square    | 4        | 0.26            | moss            |
| 2     | Hexagon   | 6        | 0.34            | prism           |
| 3     | Dodecagon | 12       | 0.42            | obsidian (Deep) |


`minR = min(W, H) * 0.42`. Each layer rotates as a whole around the center:

```
ω_layer = [1.00, 0.66, 0.50, 0.25] · ω_base
ω_base  = 2π / (basePeriod(bpm) · 6)
```

Inner = fastest, outer = slowest (the user's "X, 0.5X, 0.25X" pattern, with the square slotted between triangle and hexagon).

The "lattice" overlay: thin radial lines from center through every layer vertex, plus a faint connecting edge from each inner-layer vertex to the two nearest outer-layer vertices. Pure visual — not used for note paths.

## Notes — 25 along the polygon edges

3 + 4 + 6 + 12 = **25 segments** (the polygon perimeters themselves). One note per segment:

- A note rides its segment from vertex A → vertex B and back, with position `u(t) ∈ [0, 1]` parameterized by a cosine of scene-time so it rests at A at `t = 0` (the trigger / "vertex" endpoint).
- `u_i(t) = 0.5 - 0.5 · cos(2π · (t / T_i + φ_i))` (parent layer rotation is added separately to the rendered position, so it doesn't affect ignition timing).
- Trigger fires when `u` crosses 0 (vertex A — the loud strike) or 1 (vertex B — softer return). Enumerated analytically inside `eventsIn`, exactly like `mandalaMatrix.ts`.
- At `t = 0` every `u_i = 0` → every note sits on its A-vertex → the play-time emergent chord fires as one tick coincidence (no special dispatch, per the existing scheduler contract).

## Velocity distribution (the "non-clumping" rule)

**Reuse the existing canonical helper `speedCoeffs(25)` from `src/lib/engine/polyrhythm.ts`.** It already implements the prime / φ-jitter scheme you described — wrapping past the 12-prime table with a golden-ratio jitter so wrapped indices stay unique and irrational-ish. Adding a second prime helper would fragment the engine.

```
coeffs   = speedCoeffs(25)            // length-25, max == 1
offsets  = phaseOffsets(25)           // golden-ratio φ-spaced
T_i      = basePeriod(bpm) / coeffs[i]
φ_i      = offsets[i]
```

Notes are assigned to segments in pitch-descending order onto the **inner→outer** layer sequence (fastest coefficient = innermost segment = highest pitch = moss bell), preserving the project-wide "fast notes inward / leftward" rule.

## Pitch + voice routing

- Scale: `[0, 2, 3, 5, 7, 10, 12, 14, 15, 17, 19, 22]` (project default).
- Per-layer pitch range: inner triangle uses semis +12..+22 (bright), square +5..+14, hexagon -2..+10, dodecagon -12..+0 (deep).
- Voice slot = `i % 6`.

### Per-layer pack routing — flag

The current scheduler holds **one active pack globally**. Honoring "inner = moss / outer = obsidian" requires either:

- **(a)** add an optional `pack?: PackId` field to `TriggerEvent` and let the scheduler resolve `pack ?? activePack`; only Metatron uses it. Small, isolated change to `sceneTypes.ts` + `scheduler.ts` + `runtimePacks.ts` call site. **Recommended.**
- **(b)** ship Metatron on the active pack only (ignore the per-layer pack spec for now).

I will go with **(a)** unless you say otherwise.

## Collision filter (">3 notes in 30 ms")

Pre-existing scheduler behavior, important to be honest about: every event scheduled in a single 25 ms tick currently lands at the same `whenHorizon` audio time (chord by default). With 25 prime-distributed periods, three or more events landing inside the same 30 ms scheduler window is rare but real.

I will implement the deterministic anti-clump at **note-build time, not at dispatch time**:

- After `speedCoeffs(25)`, walk the period list; for any pair `(i, j)` whose period ratio `T_i / T_j` is within `1 ± 0.001` (a near-rational relationship that would re-cluster repeatedly), perturb `coeffs[j]` by `+0.02 · ((j * φ) mod 1 - 0.5)`. Deterministic, idempotent, and respects the existing "no two notes share a rational period" rule.

This is structurally cleaner than nudging at dispatch (which would also fight the natural-coincidence chord behavior we just preserved).

## Rendering

- The trail-fill rectangle uses `rgba(15, 23, 42, 0.15)` as specified — tighter than Mandala's 0.08 because the scene is denser.
- Polygons drawn additively on `screen` with 0.5 px lines, soft hue rotation per layer (moss-cyan inner → obsidian-violet outer).
- Notes drawn as orbs with the standard `exp(-(t - lastFireT) * 2.8)` flash decay.

## Integration

1. **New file `src/lib/scenes/metatronLattice.ts**` — scene object, state type, `init` / `sample` / `eventsIn` / `draw`, following the mandala/pendulum template. Reuses `speedCoeffs` + `phaseOffsets` + the analytic-roots crossing pattern. Density knob clamps note count to 25 always (this scene is fixed-density by design).
2. `**src/lib/engine/sceneTypes.ts**` — add `"metatronLattice"` to `SceneId`; add optional `pack?: PackId` to `TriggerEvent`.
3. `**src/lib/engine/scheduler.ts**` — when `ev.pack` is set, resolve it via the runtime-pack registry instead of the active binding's pack.
4. `**src/routes/index.tsx**` — import the scene, add to engine state map, scene-id switch in `bind()` and the render loop, and the lazy-init list.
5. `**src/components/dock/PhaseDock.tsx**` — add `{ id: "metatronLattice", label: "Metatron Lattice", short: "MTN" }` to the scene chips and dropdown.
6. `**.lovable/plan.md**` — refresh.

## Out of scope

- Touching legacy `wheel` / `pendulum` / `bars` scenes.
- Reworking the scheduler's "all events in a tick share `whenHorizon`" decision — that's a separate refactor.
- Adding a runtime UI control for per-layer pack overrides (Metatron's mapping is fixed in code).

## Open question (one)

The plan reuses the canonical `speedCoeffs(N)` helper instead of introducing a parallel `getNoteVelocity(index)`. If you specifically want a separate helper exported (for future scenes outside the engine), say so and I'll add it as a thin wrapper.