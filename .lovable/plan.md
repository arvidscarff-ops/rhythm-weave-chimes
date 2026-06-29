## Radial Resonator — new scene module

A distinct Phase-Zero scene, fully separate from `metatronLattice.ts`. No nested-polygon vertices, no lattice path-finding code is reused. Notes oscillate on fixed radial rays from a central "Ignition Point," firing audio every time `r` re-touches the origin.

### Files

- **New** `src/lib/scenes/radialResonator.ts` — full scene module (state, `sample`, `eventsIn`, `draw`).
- **Edit** `src/lib/engine/sceneTypes.ts` — add `"radialResonator"` to `SceneId`.
- **Edit** `src/routes/index.tsx` — register scene (note count, state type, bind/runScene wiring) alongside the other scenes.
- **Edit** `src/components/dock/PhaseDock.tsx` — add dock entry, label `"RAD"`.

### Physics — `updateRadialNodes` (pure, `globalTime`-driven)

For N notes (target 24, scales with `density`):
- Fixed angle: `θ_i = (i / N) · 2π`.
- Per-note speed: `ω_i = baseω · primeSpeedCoeff(i)` from the existing `speedCoeffs(N)` helper (same anti-clump table as Metatron / Nebula). Guarantees no two rays share a period.
- Radius: `r_i(t) = |sin(ω_i · t + φ_i)| · R_max`, with `R_max = 0.42 · min(W,H)`.
- Position: `(W/2 + r·cos θ_i, H/2 + r·sin θ_i)`.

This is the only motion model — no lattice traversal, no vertex lerp.

### Ignition firing — `eventsIn(t0, t1)`

Each note's contraction zero-crossing happens at `t_k = (k·π − φ_i) / ω_i` for integer `k`. For every note, enumerate `k` whose `t_k ∈ [t0, t1)` and emit one `TriggerEvent` per crossing. Slot/freq derived from `(i mod 6)` and the scale buffer (same pattern used in `metatronLattice` / `fractalNebula`).

**Stochastic Stagger.** Sort the produced events by time; walk the list and, when ≥3 events fall inside a 20 ms window, nudge `ω_i` on the trailing notes by ±1% (deterministic hash on `i`) and recompute their crossings inside `[t0,t1)`. ω perturbation is persisted in state so future windows stay coherent.

### Draw

- Persistent trail buffer: at the start of each `draw`, paint a translucent dark rect over the full canvas (low alpha, e.g. 0.08) → produces the fading radial-flower look without clearing trails.
- `ctx.globalCompositeOperation = 'screen'` for note heads + trail strokes.
- Central Ignition circle drawn last with a soft additive glow; pulses brighter when `min_i r_i` is near zero.
- Per-note: stroke a short tangent-free segment from previous-frame `(r_prev, θ_i)` to current `(r, θ_i)` so trails accumulate exactly along the ray.

### Scene registration

- `SceneId` += `"radialResonator"`.
- `index.tsx`: add `radialResonatorScene`, default note count 24, state record, `bind`/`runScene` parallel to the Metatron/Nebula entries.
- `PhaseDock.tsx`: add scene button labeled `RAD`.

### Explicit boundaries

- Does **not** import from `metatronLattice.ts` or `fractalNebula.ts`.
- Does **not** call any nested-polygon vertex or lattice path helpers.
- Reuses only generic shared utilities: `speedCoeffs`, scale buffer, and the `TriggerEvent` / `Scene` contract.
