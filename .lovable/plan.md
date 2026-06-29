# Scene Expansion & Global Architecture Compliance

## Status of the existing roadmap

Most of the scenes you describe are **already in the tree** and already on the Global Clock contract (`globalTime`, `sample`/`eventsIn`, no internal mutating clock):

| Roadmap scene        | Current file                        | State |
|----------------------|-------------------------------------|-------|
| Harmonic Pendulum    | `src/lib/scenes/pendulumFan.ts`     | Built, Phase-Zero compliant. Strands rest on their target ring at `t=0` (`phase0 = RISING_PHASE`) — Big Bang fires. |
| Spiral Arpeggiator   | `src/lib/scenes/spiralArp.ts`       | Built, Phase-Zero compliant. |
| Radial Sweep (Radar) | `src/lib/scenes/radialSweep.ts`     | Built, Phase-Zero compliant. |
| Mandala Matrix       | — (not yet built)                   | **New work.** |

The legacy "wheel / pendulum / bars" scenes still exist alongside the engine scenes and remain on the imperative path; they're not in your roadmap so I'll leave them untouched unless you say otherwise.

So this phase is really two things: (1) a quick **compliance audit pass** across the four engine scenes and the dispatch layer, and (2) **building Mandala Matrix** as a fifth engine scene.

## 1. Compliance audit (no behavior changes unless a violation is found)

Sweep each engine scene + shared layer and confirm:

- No `useState`/`useEffect`/local clock fields drive geometry. Geometry is `f(globalTime)`.
- `sample(state, t, g)` is pure for draw (mutations limited to density reseed / cached flash markers used only for visuals).
- `eventsIn(state, t0, t1, g)` is deterministic and includes the `t=0` boundary so the Big Bang chord fires on first Play.
- Audio is routed exclusively through `triggerPackVoice` via `engineScheduler` (no direct `ctx.createOscillator`, no `dispatchTriggers` shortcut).
- Visual triggers go through `spawnInkBleed` only — no hard flashes, no full-canvas alpha sweeps. The recent `inkBleed` coalesce-damp stays.
- The `flashBus` Big Bang effect remains the toned-down version.

Deliverable: a short written audit in `.lovable/plan.md`. Code edits only where a violation is found.

## 2. New scene — Mandala Matrix

New file `src/lib/scenes/mandalaMatrix.ts` implementing the `Scene<MandalaState>` contract.

### Geometry

- Hexagram skeleton: 6 outer vertices on a circle of radius `R = min(W,H) * 0.36`, centered at canvas mid. Draw the 6 "spokes" (center↔vertex) and the 6 chord edges that form the two overlapping triangles — these are the structural paths.
- 12 structural path segments total. Each note is assigned to one segment and travels along it.

### Motion (pure `f(globalTime)`)

- Each note `i` has a Fibonacci ratio `r_i ∈ {2, 3, 5, 8, 13}` (cycled by `i % 5`).
- Period for note `i`: `T_i = basePeriod(bpm) * r_i`.
- Parametric position on its segment: `u_i(t) = 0.5 - 0.5 * cos(2π * t / T_i)` — a smooth 0→1→0 sweep that **passes through u=0 at t=0**.
- Segment endpoints are arranged so `u=0` is the **center origin** for every note. At `t=0` every note sits at the absolute center → unified Big Bang chord.

### Triggers

- An event fires for note `i` whenever `u_i` crosses `0` (center) or `1` (outer vertex). Solved analytically inside `eventsIn(t0, t1)` (cosine root enumeration), same shape as `pendulumFan.eventsIn`.
- Center crossings → low octave; vertex crossings → high octave. Slot cycles across the 6 pack voices.
- Refractory window per note (~`0.12 s`) to prevent double-fires.

### Visuals

- Canvas trail decay handled at the scene level: `ctx.save(); ctx.fillStyle = 'rgba(15, 23, 42, 0.08)'; ctx.fillRect(0,0,W,H); ctx.restore();` at the top of `draw`. (Trail "paints out" the matrix as notes orbit — exactly the brief.)
- Skeleton drawn with very low-alpha hairlines under `globalCompositeOperation = 'screen'`.
- Notes drawn as small radial gradients (`screen` blend). No hard flashes — trigger visuals come from `spawnInkBleed` via the scheduler.
- Density knob (2..12) → note count scaled `6..30` (multiples of 6 to keep symmetry).

### Wiring

1. Register scene in `src/routes/index.tsx`:
   - import `mandalaMatrixScene` + `MandalaState`
   - add `"mandalaMatrix"` to `SceneKind`, `SCENES`, and `resolveNotesCount`
   - add the lazy-init slot on `EngineState`
   - bind it in the scheduler-active switch like the other engine scenes
2. Add the scene tile + label in `src/components/dock/PhaseDock.tsx`.
3. No clock, scheduler, or inkBleed changes required.

## Technical notes

- All new code lives under `src/lib/scenes/` and follows the existing `Scene<TState>` contract (`init` / `sample` / `eventsIn` / `draw`).
- No audio code paths change. The scheduler's first-tick Big Bang fix (recent change to `scheduler.ts`) already covers Mandala.
- Trail-fill is the *only* place a scene is allowed to paint a full-canvas rectangle, and only at ~8% opacity per frame — this is the documented Mandala visual signature, not a flash.

## Out of scope for this phase

- Touching the legacy `wheel`/`pendulum`/`bars` scenes.
- Any dock/UX rework beyond adding the new scene tile.
- Changing the Big Bang flash effect (already toned down in a prior pass).
