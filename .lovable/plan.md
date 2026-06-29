# Plan: Fractal Nebula scene (50-particle, 5-layer lattice)

A new scene `fractalNebula` following the same `eventsIn` / `sample` / `draw` contract as Metatron, but at higher density and with a particle-pool architecture instead of one-note-per-edge.

## Geometry — 5 nested polygons

| L | Shape      | Vertices | Radius (× minR) | Pack       |
|---|------------|----------|-----------------|------------|
| 0 | Triangle   | 3        | 0.14            | moss       |
| 1 | Square     | 4        | 0.22            | moss       |
| 2 | Hexagon    | 6        | 0.30            | prism      |
| 3 | Octagon    | 8        | 0.36            | prism      |
| 4 | Dodecagon  | 12       | 0.42            | obsidian   |

`minR = min(W, H) * 0.42`. Each layer rotates as a whole at `ω_layer = ω_base · φ^(-L)` (inner spins fastest, outer slowest — see direction note below).

## Particles — 50 total

**10 particles per layer**, riding the layer's polygon edges (`particle.edge ∈ 0..V-1`, position `u ∈ [0,1]` along that edge). At `t = 0` every particle parks at `u = 0` → play-time emergent chord (consistent with the rest of the engine).

### Velocity formula — direction call-out

Your spec says `V_i = BaseSpeed · φ^L + NoiseOffset`. Taken literally, `φ^L` grows with layer (φ ≈ 1.618), making outer = faster — which contradicts both the project-wide "inner = fastest" convention and your own "outer layers trigger less often" rule from §3 (outer being faster + outer triggering less would mean outer particles whip around silently). I will implement:

```
V_i = BaseSpeed · φ^(-L) · noise_i
noise_i = speedCoeffs(10)[i % 10]   // prime/φ within each layer's 10 particles
```

so inner = fastest, outer = slowest, and the `noise_i` term gives every particle in a layer a unique prime/φ-derived coefficient (otherwise 10 same-layer particles would share a period and clump immediately).

Per-particle period: `T_i = basePeriod(bpm) / V_i`. Phase offsets from `phaseOffsets(50)` (golden-ratio 1-D), so initial positions stagger off `u=0` immediately after t=0.

### The "meander" wobble — visual only

A `sin(globalTime)` modulation injected into the live velocity would invalidate the analytical crossing solver in `eventsIn` (it solves `cos(2π · (t/T + φ))` roots, which assumes constant T). Two options:

- **(a)** Apply the wobble **to the rendered `u` only** — visuals breathe, audio cadence stays clean and analytically solvable. Recommended.
- **(b)** Drop the analytical solver and numerically scan each particle each tick. Costlier; loses the "pure function of scene-time" guarantee.

I'll do **(a)**. The wobble formula: `u_render = u(t) + 0.04 · sin(2π · t / wobblePeriod + particle.phaseOffset)`. Audio still fires on the un-wobbled `u` crossings.

### Anti-clump pass (the "Micro-Quantization")

Same deterministic build-time pass that ships in Metatron, scaled up: after assigning the 50 coefficients, walk every pair; if `|T_i / T_j - 1| < 0.001`, perturb `coeffs[j]` by `±1%` (golden-nudge sign). With 50 notes this is the only sane place to do it — true "approaching the intersection within 20 ms" detection at dispatch time would fight the existing emergent-chord behavior.

## Auditory density filter

Triggers per particle fire when `u` crosses 0 (A-vertex, loud) or 1 (B-vertex, softer). Then a **deterministic** gate (no `Math.random` — the scheduler contract is "same args → same events"):

```
keep = ((hashInt(particle.id, crossingIndex)) % (L + 1)) === 0
```

So L=0 keeps 100 %, L=1 keeps 50 %, L=2 keeps 33 %, L=3 keeps 25 %, L=4 keeps 20 % — outer layers feel airier exactly as you described, and the result is reproducible across renders / hot reloads. (`hashInt` = small xorshift-style int hash of `(particleId, k)`.)

## Per-event pack routing

Reuses the optional `pack` field on `TriggerEvent` shipped with Metatron. Each particle carries its layer's `PackId` ("moss" | "prism" | "obsidian") and emits it on every event.

## Rendering

- Trail-wipe: `rgba(15, 23, 42, 0.18)` (a bit heavier than Metatron — 50 particles).
- Lattice scaffolding: polygon outlines + radial spokes + nearest-neighbor inter-layer connectors, all on `globalCompositeOperation = "screen"`.
- Particles: `globalCompositeOperation = "hard-light"` for the orb pass so heads punch above the additive halo. Tail/glow stays on `screen`.
- Layer hue ramp: moss-cyan inner → obsidian-violet outer.

## Integration touchpoints

1. **New `src/lib/scenes/fractalNebula.ts`** — scene object + `FractalNebulaState`.
2. **`src/lib/engine/sceneTypes.ts`** — add `"fractalNebula"` to `SceneId`.
3. **`src/routes/index.tsx`** — import, add to engine state map + null reset, scene-id switch in `bind()` and the render loop, `resolveNotesCount` returns `50`, append to `SCENES`.
4. **`src/components/dock/PhaseDock.tsx`** — add `{ id: "fractalNebula", label: "Fractal Nebula", short: "NEB" }` to chips + dropdown.
5. **`.lovable/plan.md`** — refresh.

## Out of scope

- Touching legacy `wheel` / `pendulum` / `bars`.
- Reworking the scheduler's per-tick `whenHorizon` coalescing.
- Exposing density-filter or wobble depth as dock knobs (fixed in code; can be lifted later).

## Open questions

1. **φ^L direction** — I'm flipping to `φ^(-L)` for engine consistency (inner = fastest). Say so if you actually want outer = faster.
2. **Probability gate at L=0** — I'm using `1/(L+1)` so the triangle (L=0) keeps every hit. `1/L` is undefined; happy to use `1/max(1, L)` instead (triangle still 100 %).
3. **Meander wobble** — visual-only by default; flag if you want the audio cadence itself to wobble (requires dropping the analytical solver).
