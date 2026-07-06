
# Trigger Engine & Scene Creator — Studio Expansion

Extends the existing `/studio/builder` route (already wired to the `custom` scene runtime via `activeBlueprint`) into a full aesthetic authoring tool. No new AI, no new audio engines — pure front-end JSON state driving the existing Phase-Alignment `customScene`.

## 1. Blueprint schema extension

Extend `CustomSceneBlueprint` in `src/lib/engine/pathTransformer.ts` with an `aesthetic` block (backward-compatible via `validateBlueprint` defaults):

```ts
aesthetic: {
  background: { kind: "none"|"image"|"video"; url: string; opacity: number; blurPx: number };
  notes: { baseRadiusPx: number; breathHz: number; breathDepth: number };
  trail: { decay: number };            // 0..0.98 (alpha of clear rect)
  palette: {
    mode: "gradient"|"preset";
    startHex: string; endHex: string;
    presetId?: "neonCyberpunk"|"deepOcean"|"autumnHorizon"|"phosphorLime"|"violetDusk";
  };
  burst: { count: number; baseSpeed: number; lifespanMs: number; drag: number; sizeVariance: number };
  pathPulse: { enabled: boolean; speed: number; widthPx: number };
  climax: { ambientFlash: boolean; stardust: boolean; stardustCount: number };
}
```

Presets = fixed start/end hex tuples resolved at draw time.

## 2. Runtime rewrite — `customScene.ts`

Rewrite `customScene.draw` to consume the new aesthetic block. Behavior is scoped to the `custom` scene only — other 8 engines untouched.

- **Trail decay**: instead of relying on the global canvas clear, draw a `fillRect` with `rgba(0,0,0, 1 - decay)` at scene start when `decay > 0`. Requires a small hook — add optional `Scene.preClear?(ctx,g)` in `sceneTypes.ts` and call it in the render loop in `src/routes/index.tsx` before the normal clear (only when defined; skip default clear that frame).
- **Uniform orbs + living breath**: constant `baseRadiusPx`, per-track phase `sin(t*breathHz*2π + i*0.37)` modulating alpha 0.7..1.0.
- **Palette gradient**: precompute per-track color via linear interp in OKLCH between startHex→endHex across `N` tracks; replace current `HUES[i%..]` per-track color.
- **Path pulse**: on trigger, push `{trackIdx, tSpawn, arcStart}` into a ring buffer. Each frame walk buffer and draw a bright segment along the sampled polyline that advances by `pulseSpeed` and fades over ~600ms.
- **Particle burst**: reuse `src/lib/visuals/burstField.ts` if API fits — otherwise add a local particle system inside `customScene` (state array, per-particle vx/vy/life/size, drag integration, additive draw).
- **Macro-cycle climax**: replace the existing 0.35s ripple with:
  - Ambient flash: full-canvas gradient fill decaying over ~1.2s tinted to palette midpoint.
  - Stardust: spawn N particles at center on cycle boundary; slow outward drift, long lifespan, tiny size, twinkling alpha.

State lives in a mutable `CustomSceneState` (arrays for pulses, particles, stardust). Cleared only on scene init — never on blueprint swap, so hot-loading a preset never resets the musical clock.

## 3. Live subscription — no clock reset on preset load

`setActiveBlueprint` already notifies subscribers. Confirm `customScene.draw` reads `getActiveBlueprint()` every frame (it does). Preset load = mutate blueprint only, never re-init scene, never touch scheduler.

## 4. Studio route rewrite — `/studio/builder`

Rewrite `src/routes/studio.builder.tsx` as a premium split-screen:

**Layout**
- Desktop: `grid-cols-[380px_1fr]` — left rack, right live preview.
- Mobile: stacked, preview on top.
- Dark surface with subtle vertical rack accent, matches existing studio aesthetic.

**Left control rack** — shadcn `Tabs` with sections:
1. **Geometry** — existing path type + layout + trigger + voice controls (keep current impl).
2. **Background** — media kind toggle, URL input, opacity slider (0–1), blur slider (0–30px).
3. **Notes** — base radius, breath rate, breath depth.
4. **Trails** — decay slider (0–0.98) with live label ("Off" / "Ribbon" / "Long exposure").
5. **Palette** — mode toggle, two color pickers (native `<input type="color">`), preset dropdown, live 12-swatch preview strip.
6. **Burst FX** — particle count, base speed, lifespan, drag, size variance.
7. **Path Pulse** — enable toggle, speed, width.
8. **Climax** — ambient flash toggle, stardust toggle, stardust count.
9. **Cycle** — existing base laps / macro seconds / note count.

**Preset rack (persistent footer of left column)**
- "Save as Preset" (prompt for name)
- "Load Preset" dropdown (LocalStorage-scanned; selecting swaps blueprint via `setActiveBlueprint` — no scheduler touch)
- "Export JSON" (download `.json`)
- "Import JSON" (file picker, validate, apply)
- "Publish to app" (existing behavior — sets active blueprint)

**Right preview**
- Full-height canvas rendering the SAME `customScene.draw` used in production, driven by a local scene-time clock so the preview keeps running even when the app isn't focused.
- Background media layer rendered as an absolutely-positioned `<img>`/`<video>` behind the canvas, styled from blueprint (opacity, blur). This is the ONLY place background media renders — main app view already has `SceneBackground` for admin-published themes; we don't overload that.
- **Theater mode**: expand icon (top-right corner). Toggles `document.fullscreenElement` + local `theater` state that repositions the preview into a fixed inset-0 overlay. Floating close button + ESC handler. Smooth `transition-all` on the container.

## 5. Preset store

`src/lib/studio/sceneBuilderStore.ts` already exists — extend `validateBlueprint` to fill aesthetic defaults for old presets. Add `exportBlueprintFile(bp)` + `importBlueprintFile(file)` helpers.

## 6. Files touched

**Edit**
- `src/lib/engine/pathTransformer.ts` — extend blueprint type + `DEFAULT_BLUEPRINT` + `validateBlueprint`.
- `src/lib/scenes/customScene.ts` — full aesthetic runtime.
- `src/lib/engine/sceneTypes.ts` — add optional `preClear` hook.
- `src/routes/index.tsx` — respect `preClear` in render loop.
- `src/routes/studio.builder.tsx` — full UI rewrite.
- `src/lib/studio/sceneBuilderStore.ts` — import/export helpers.

**Create**
- `src/lib/studio/palettes.ts` — preset palette table + `paletteAt(i, N, cfg)` OKLCH interp.

**Not touched**
- Other 8 scenes, dock, scheduler, audio, phaseAlign, migrations, DB.

## Non-goals

- No new audio synthesis, no new packs.
- No changes to the 8 built-in engines or their alignment math.
- No cloud persistence — LocalStorage only (per user).
- No multi-path composition (still single path per blueprint).

## Risks

- Trail decay via `fillRect` interacts with other scenes if the `preClear` hook is misapplied — gate it strictly on `scene.id === "custom"` in the render loop.
- Background video autoplay: mute + `playsInline`, honor browser autoplay rules.
- Large particle counts on high-DPI canvases — cap counts (burst ≤ 120, stardust ≤ 80) in the slider max.
