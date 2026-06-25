
# Applying the Circle Animations Style to Phase

The reference component is a 3×3 gallery of canvas dot-ring animations. Dropping that grid into Phase verbatim would clash with the open, zen composition you've built. Instead, we adopt its **visual vocabulary** — concentric rings of small dots, soft opacity/size pulses, slow rotation, scan/shockwave halos — and weave it into the scenes and chrome you already have.

## Where it fits

### 1. Ambient "dot atmosphere" behind the wheel (primary use)
A new low-opacity canvas layer (above NeuralNoise, below scene canvas) renders slowly drifting concentric dot rings centered on the composition. Inspired by `interwovenRingPulses` + `spiralRadiatingPulse`:
- 4–6 rings of 2px dots, max opacity ~0.12, slow counter-rotation
- Breathes with the project BPM (one pulse cycle per bar) so it feels musical, not decorative
- Sits *outside* the wheel's outermost ring as a quiet halo — never competes with notes

### 2. Note-trigger shockwave (replaces/augments current bloom)
When a note fires, emit a `pulseWaveShockwave`-style expanding ring of dots from the trigger point:
- 1 ring, ~18 dots, expands ~60px over 700ms, fades out
- Per-scene: from the wheel intersection, the pendulum bob's zero-crossing, the bars node hit
- Coexists with the existing additive bloom; this adds *granularity* (dots) instead of just glow
- Also pings `flashBus` as today, so NeuralNoise still reacts

### 3. Idle "breathing grid" in empty dock space
Tiny `pulseWaveBreathingGrid` dot field (~80×40px, opacity ≤0.15) inside the FX / Packs / About drawer headers, behind the title. Adds the "alive" feel to chrome without adding chrome.

### 4. Scene-picker thumbnails (optional, smallest lift)
Each scene rail link (WHEEL / PENDULUM / BARS) gets a 28×28 dot animation as its icon — picked to evoke the scene (Wheel→`pulseWaveSpiral`, Pendulum→`pulseWaveStretched`, Bars→`flowingEnergyBands`). Only the active one animates; others are static dots.

## What we do NOT do
- No 3×3 gallery page, no card grid, no "Circle Animations Collection N°3" header
- No bright white fills — every dot uses the existing palette tokens at low alpha
- No new full-screen WebGL layer (we already have NeuralNoise; this is 2D canvas only)

## Technical approach

**New files**
- `src/lib/visuals/dotFields.ts` — port the relevant `animationLogic` entries (`interwovenRingPulses`, `pulseWaveShockwave`, `pulseWaveSpiral`, `pulseWaveBreathingGrid`, `flowingEnergyBands`, `pulseWaveStretched`) as pure draw functions: `(ctx, w, h, t, opts) => void`. No React, no per-component RAF. Replace hard-coded `rgba(255,255,255,a)` with a `color` opt sourced from CSS var (`--pr-fg` / palette).
- `src/components/visuals/DotAtmosphere.tsx` — fixed canvas behind the scene, draws `interwovenRingPulses` driven by Phase's existing RAF clock + BPM. DPR-aware, `pointer-events-none`.
- `src/components/visuals/ShockwaveLayer.tsx` — subscribes to a new lightweight bus (`shockwaveBus`) or piggybacks on `flashBus`. Maintains an active-shockwaves array, expires entries, draws one frame per RAF.
- `src/lib/visuals/shockwaveBus.ts` — `{ emit(x, y, opts), subscribe(fn) }` mirroring `flashBus`.

**Edits in `src/routes/index.tsx`**
- Mount `<DotAtmosphere />` and `<ShockwaveLayer />` once in the scene container.
- In `updateWheel` / `updatePendulum` / `updateBars`, after the existing `flashBus.flash(...)` call, also `shockwaveBus.emit(x, y, { hue: ringIndex })`.
- Drawer headers (FX/Packs/About): drop in a small `<DotField variant="breathingGrid" />` absolutely-positioned behind the title.

**Performance**
- Single RAF per layer, shared with main scene where possible.
- Cap shockwaves at 12 concurrent; oldest dropped.
- All dot fields clamp max alpha to ≤0.15 (atmosphere) / ≤0.5 (shockwave) so we stay in the "thick water" feel established earlier.

## Open questions before I build

1. **Scope** — do all four use-cases ship together, or just **Atmosphere + Shockwave** first (the two with the biggest "alive" payoff), and we add drawer/icon variants later?
2. **Coupling to BPM** — should the atmosphere ring pulse sync to the global BPM (musical), or drift on its own slow clock (purely ambient)?
3. **Color** — keep dots monochrome white-on-teal like the rest of the HUD, or let them inherit the active **Visuals palette** (Aurora/Lagoon/etc.) so all reactive visuals share a color identity?
