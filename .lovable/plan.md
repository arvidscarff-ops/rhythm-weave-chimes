## Trigger Engine & Scene Creator (Custom Geometry Authoring)

Adds a new studio module that lets you compose brand-new trigger engines from primitive path types without touching TypeScript. Every custom scene stays fully bound to the Phase-Alignment macro-cycle (progress `0→1` per note, `laps_i = base + i`), so the "Big Bang" unison snap-back is preserved automatically.

### Where it lives
- New dock entry **"Builder"** in `/studio` (sits next to Scenes / Scales / Packs).
- Route: `src/routes/studio.builder.tsx` (passcode-gated like the other studio pages).
- Runtime consumer: same `SceneBackground` / render loop already used by published scenes — a saved "custom scene" is just another `Scene` implementation fed by a JSON blueprint.

### JSON blueprint schema (`CustomSceneBlueprint`)
```ts
{
  version: 1,
  name: string,
  path: {
    type: "circle" | "line" | "polygon" | "lissajous",
    // polygon
    sides?: number,           // 3..12
    // line
    axis?: "x" | "y",
    // lissajous
    freqX?: number, freqY?: number, phase?: number,
  },
  layout: {
    trackCount: number,               // = noteCount, but overridable
    sizing: "linear" | "exponential" | "constant",
    baseSize: number,                 // 0..1 of min(W,H)/2
    step: number,                     // per-track increment / offset
    rotationOffsetDeg: number,        // per-track starting angle offset
  },
  trigger: {
    mode: "boundary" | "axisIntersect",
    // axisIntersect
    axis?: "x" | "y",
    position?: number,                // -1..1 normalized from center
  },
  voice: { slot: 0..5, packOverride?: PackId },
}
```

### Path transformer (core library)
New pure module `src/lib/engine/pathTransformer.ts`:
- `positionOn(path, progress) → {x, y}` in unit space (`-1..1`), one implementation per path type. Polygon evenly distributes progress across N perimeter segments.
- `crossings(path, trigger, i, base, macroSec, t0, t1) → number[]` — scene-times in `(t0, t1]` where the moving dot crosses the trigger predicate. Boundary reuses `phaseAlign.crossings`; axisIntersect solves per path type analytically (circle/line/polygon closed form; Lissajous via bracketed root find over the note's laps in the window).

### Runtime scene adapter
New `src/lib/scenes/customScene.ts` implementing the `Scene` contract:
- `sample()` walks `noteCount` tracks, computes `progress = phaseAlign.progress(t, i, base, D)`, maps through the path transformer using the per-track sizing/rotation rules, stores draw positions.
- `eventsIn()` delegates to `pathTransformer.crossings` — audio stays scheduled through the existing `triggerBus` and pack system, so Big Bang alignment is untouched.
- `draw()` renders tracks (light wireframe) + dots + optional axis-trigger line, themed via existing `ThemeColors`.

### Registry integration
- Extend `SceneId` with `"custom"` and register `customScene` in the render loop's scene table.
- `SceneGlobals` gains an optional `blueprint?: CustomSceneBlueprint` field the loop injects when the active scene is a custom one.
- `activeScene` store gets a companion `activeBlueprint` slot.

### Storage
- **LocalStorage** first-class (as requested): key `sceneBuilder.presets.v1` → `Record<id, CustomSceneBlueprint>`. Save/Load/Rename/Delete/Duplicate/Export-JSON/Import-JSON.
- **Cloud publish (optional)**: reuse `app_scenes` — add nullable `blueprint jsonb` column + set `trigger_engine_id = 'custom'`. Published custom scenes appear in `/studio/scenes` list and the main app's scene picker like any other engine. (One tiny migration.)

### Builder UI (`/studio/builder`)
Two-pane layout mirroring `/studio/scenes`:
- **Sidebar (left)**: preset list from LocalStorage + New / Import buttons.
- **Config panel (center)**: collapsible sections — Path Type, Layout & Spacing, Trigger, Voice, Cycle (base laps / macro seconds / note count sliders, same controls as scene creator), and Save/Publish actions.
- **Live preview (right)**: `<PreviewCanvas>` running the exact `customScene` adapter on the current in-memory blueprint at real cycle timing, so what you see is what plays.

### Build order
1. `pathTransformer.ts` + unit sanity checks in a tiny dev harness.
2. `customScene.ts` + register in scene table; add `blueprint` to `SceneGlobals`.
3. `sceneBuilderStore.ts` (LocalStorage CRUD + Zod validate on load).
4. `studio.builder.tsx` route with sidebar / config panels / live preview.
5. Dock entry in `PhaseDock.tsx`.
6. Optional: migration adding `blueprint jsonb` to `app_scenes` + wire publish path in `studio.scenes.tsx`.
7. `tsgo` + visual verify: create a triangle preset, an axis-intersect Lissajous, confirm Big Bang unison at cycle end.

### Non-goals (this pass)
- No new synth / audio path — reuses existing packs and scheduler.
- No breaking changes to the 8 existing engines.
- No multi-path composition in a single scene (single path type per preset for now; layered blueprints can come later).

### Credit estimate
Roughly **7–10 credits**: 1 migration (optional), 4 new files, 2–3 edits, one geometry-heavy module (Lissajous root-finding is the only tricky bit), plus a visual verification pass. Skipping Cloud publish (LocalStorage-only) drops it to ~6.
