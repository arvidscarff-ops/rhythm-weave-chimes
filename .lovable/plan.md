# Phase — Master Refactor Plan

Acknowledged. Below is the current-state read, the target architecture, the step-by-step refactor, and an honest credit estimate.

## Current state (what's actually in the repo)

- `src/routes/index.tsx` — **3,452 lines**. One mega-component that owns: canvas sizing, audio graph, FX chain, three existing scenes (`wheel`, `pendulum`, `bars`), particles, dust, share-URL encode/decode, and most UI glue.
- `src/lib/visuals/` — `burstField`, `lensFlare`, `shockwave` (already additive-blend friendly).
- `src/lib/sound/runtimePacks.ts` — `triggerPackVoice` dispatcher (this is the audio entry point we'll bind scene collisions to).
- `src/components/dock/PhaseDock.tsx` — 776 lines, already glassmorphic-ish; needs scene switcher + density/global controls.
- Scenes today are coded inline (`WheelState`, `PendulumState`, `BarsState`) and share no interface — switching scenes means a giant `if/else` branch in the render loop. This is the core blocker for adding String Network / Spiral / Radial.

The existing `pendulum` and `bars` modes are close in spirit to Scenes B and (loosely) D, but their physics, visuals, and trigger semantics don't match the spec. We will reframe them, not delete them.

## Target architecture

Extract the render loop into a **Scene interface** so each scene is a self-contained module with shared physics→audio contract.

```text
src/
  lib/
    engine/
      sceneTypes.ts         ← Scene interface, TriggerEvent, RenderCtx
      sceneRegistry.ts      ← id → Scene module
      renderLoop.ts         ← rAF, dt, global speed, scene.update + scene.draw
      triggerBus.ts         ← collision events → triggerPackVoice + visual fx
    scenes/
      stringNetwork.ts      ← Scene A
      pendulumFan.ts        ← Scene B (replaces current pendulum)
      spiralArp.ts          ← Scene C
      radialSweep.ts        ← Scene D (absorbs current wheel/bars feel)
    visuals/
      inkBleed.ts           ← new: exponential-decay radial ripple (replaces hard flash)
      trails.ts             ← new: kinetic Bezier/particle trail helper
      grain.ts              ← new: noise/grain backdrop overlay
  components/
    dock/
      SceneSwitcher.tsx     ← 4 scene chips
      GlobalControls.tsx    ← Speed, Reverb Mix, Density/Multiplier
  routes/
    index.tsx               ← thin: mount canvas, wire dock → engine, share-URL
```

### Scene interface (the contract)

```ts
interface Scene {
  id: 'stringNet' | 'pendulumFan' | 'spiralArp' | 'radialSweep';
  init(ctx: RenderCtx): SceneState;
  update(state, dtSeconds, globals): TriggerEvent[]; // collisions found this frame
  draw(state, canvasCtx, globals): void;             // additive blending, trails
  serialize(state): JSON;                            // for share URLs
  hydrate(json): SceneState;
}
type TriggerEvent = { voiceSlot, pitchSemis, velocity, x, y, hue };
```

The render loop calls `scene.update` → pipes returned events through `triggerBus` → which calls `triggerPackVoice` **and** spawns an ink-bleed at `(x,y)`. This is the "zero latency" guarantee: audio + visual are dispatched in the same tick the collision is detected.

## Step-by-step refactor

**Step 1 — Extract the engine skeleton (no behavior change yet)**
- Create `sceneTypes.ts`, `renderLoop.ts`, `triggerBus.ts`, `sceneRegistry.ts`.
- Move the rAF loop, global-speed dt scaling, and resize/DPR handling out of `index.tsx`.
- Wrap the current `wheel/pendulum/bars` code as legacy `Scene` adapters so nothing visibly changes.
- `index.tsx` drops from ~3.4k to ~600 lines (mount + dock wiring + share-URL).

**Step 2 — Visual primitives**
- `inkBleed.ts`: radial gradient with exp-decay alpha `α(t)=α₀·e^(-kt)`, additive blend, slight blur.
- `trails.ts`: ring-buffer of past positions → Bezier path with fading stroke.
- `grain.ts`: pre-rendered tiled noise canvas, drawn once per frame at low opacity over the charcoal backdrop.
- Apply `oklch(18% 0.02 240)` backdrop + grain in the loop's clear step (no more black `fillRect`).

**Step 3 — Build Scene A: Geometric String Network**
- Data model: `anchors[]` (slow-moving vectors, e.g. triangle vertices on Lissajous paths) and `strings[]` (anchor-pair indices).
- Particles travel along normalized `t∈[0,1]` of each string. Audio triggers when a particle crosses `t=0` or `t=1`, **or** when two strings' nearest-points fall under a threshold (the "nexus" collision).
- Draw with `globalCompositeOperation = 'screen'`, `lineWidth = 0.5`, color from voice-slot hue.

**Step 4 — Scene B: Harmonic Pendulum Fan**
- Reframe the existing pendulum: single top anchor, N radial strings, nodes slide with `d(t) = base + A·sin(ωt + φᵢ)` where `ωᵢ` follow Galileo ratios (already in `PEND_RATIOS`).
- Target rings at the bottom of each string; trigger when `|d − targetRadius| < ε`. This replaces the current sign-flip zero-crossing logic.

**Step 5 — Scene C: Spiral Arpeggiator**
- Render `r = a + b·θ` over `θ∈[0, Nturns·2π]`.
- Playheads advance along arc-length parametrization so acceleration emerges naturally from `r→0`.
- Trigger on crossings of K polar grid lines (`θ = k·2π/K`); pitch derived from `r` (smaller r → higher).

**Step 6 — Scene D: Radial Sweep & Nebula**
- Sweeping arm with angular velocity `ω` tied to BPM. Trigger when arm angle crosses each target's angle.
- Central bloom: radial gradient pulse on every K-th trigger (downbeat), driven by `inkBleed` at large radius and slow decay; integrates with existing `lensFlare`.

**Step 7 — Dock & globals**
- `SceneSwitcher`: 4 chips in the existing pill, monospace labels at `text-xs tracking-widest opacity-60`.
- `GlobalControls`: Speed (0.25–2×, scales `dt`), Reverb Mix (existing FX param), Density (per-scene multiplier — anchor count / string count / spiral turns / arm segments).
- Tighten dock visuals to spec: `bg-neutral-950/40 backdrop-blur-xl`, 1px gradient border via masked pseudo-element.

**Step 8 — Share-URL & persistence**
- Extend `src/lib/session/sessionUrl.ts` with a per-scene payload using `scene.serialize/hydrate`. Existing knobs/FX encoders stay.

**Step 9 — Cleanup**
- Delete the legacy adapters from Step 1. Remove `WheelState`/`BarsState` types if not absorbed by `radialSweep`.
- Re-run typecheck, verify all 4 scenes switch cleanly, confirm no flashes (only ink-bleeds).

## Technical notes (for the implementing AI)

- The render loop is the single owner of `dt`. Every scene receives `dt × globalSpeed`. No scene calls `performance.now()` itself.
- `triggerBus` is the only place that calls `triggerPackVoice`. Scenes only return events. This keeps "zero latency audio↔visual" enforceable in one file.
- Additive blending must be set/reset per draw pass; leaving `'screen'` on bleeds into the dock if the canvas overlaps it.
- Backdrop is **never** a `fillRect('black')` — always `oklch(18% 0.02 240)` + grain. Hard-flash `globalAlpha = 1` writes are banned; use `inkBleed`.
- Keep `index.tsx` under 800 lines after Step 9. If it grows, extract more.

## Credit / cost estimate

Rough estimate based on file sizes, parallel-tool batching, and the 9-step scope:

| Step | What | Est. credits |
|------|------|-------------:|
| 1 | Engine skeleton extraction (large refactor of 3.4k-line file) | 8–12 |
| 2 | Visual primitives (3 small modules) | 2–3 |
| 3 | Scene A — String Network | 4–6 |
| 4 | Scene B — Pendulum Fan reframe | 3–4 |
| 5 | Scene C — Spiral Arpeggiator | 4–5 |
| 6 | Scene D — Radial Sweep & Nebula | 4–5 |
| 7 | Dock + global controls + visual polish | 3–4 |
| 8 | Share-URL extension | 1–2 |
| 9 | Cleanup, typecheck, visual QA | 2–3 |
| **Total** | | **~31–44 credits** |

Variance drivers: how aggressively we iterate on visual feel (each "make it more cinematic" pass is ~2–3 credits), and whether scenes need browser-driven QA via Playwright screenshots (adds ~1 credit per scene). A "ship it minimal" path doing only Steps 1, 2, 3, 7 lands around **15–20 credits**.

## Suggested first slice to approve

If you want a low-risk start, approve **Steps 1 + 2 + 3** (~14–21 credits). That delivers the new engine, the ink-bleed/grain/trails primitives, and one fully new scene (String Network) — enough to validate the architecture before committing to the remaining three scenes.
