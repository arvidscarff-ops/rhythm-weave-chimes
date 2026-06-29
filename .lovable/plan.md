
## Goal

Ship the **Scenes** tab of My Studio so any signed-in user can craft and save their own scenes, audition them live on the wheel, and pick them from the dock — without writing code. Same UX language as Presets + Packs.

## The core question (pick one)

The 8 in-tree scenes (String Network, Pendulum Fan, Spiral Arp, Radial Sweep, Mandala Matrix, Metatron Lattice, Fractal Nebula, Radial Resonator) are each ~300–500 lines of bespoke physics. "Creative freedom" can mean two very different products:

**A. Scene Remixer (1 build pass).** Take any built-in scene as a *template*, expose its tunable knobs (node count, ratios, palette, voice slot mapping, refractory, geometry seed, ink-bleed amount, audio pack lock), tweak in real time, save as your own scene. You can create dozens of distinct-feeling scenes from each template. Ships now, fits today's `user_scenes.graph_json` model trivially.

**B. Primitive Graph Builder (4–6 build passes).** A node-graph canvas where you place *primitives* (orbits, lines, particles, trigger zones, modulators) and wire them together — think Pure Data / TouchDesigner-lite. Maximum freedom, but requires a runtime interpreter, a graph editor UI, and a primitive library before *anything* renders. No usable output until pass 4+.

I recommend **A first**, then layer B on top later (A's saved scenes become "templates" the graph builder can extend). It also matches the rest of the studio — Presets and Packs are both "configure within a fixed shape".

## What A looks like (if you pick it)

```text
┌────────────────────────────────────────────────────────────────┐
│ My Studio                  [Presets] [Packs] [Scenes]          │
├──────────────┬─────────────────────────────────┬───────────────┤
│ MY SCENES    │ EDIT: "Slow Aurora"             │ TEMPLATE      │
│ + new        │ ─────────────────────────       │ ● String Net  │
│ • Aurora ▸   │ Geometry                        │ ○ Pendulum    │
│ • Choral     │   Anchors      [— 7 —]          │ ○ Spiral Arp  │
│ • Drift      │   Strings/anchor [— 3 —]        │ ○ Radial      │
│              │   Seed         [1428] [🎲]      │ ○ Mandala     │
│              │ Motion                          │ ○ Metatron    │
│              │   Speed bias   [— 0.7 —]        │ ○ Nebula      │
│              │   Drift        [— 0.2 —]        │ ○ Resonator   │
│              │ Audio                           │               │
│              │   Pack lock    [Moss ▾]         │ Each template │
│              │   Slot map     [1→A 2→B …]      │ exposes its   │
│              │   Refractory   [— 0.18s —]      │ own knob set. │
│              │ Visuals                         │               │
│              │   Palette      [aurora ▾]       │               │
│              │   Trail        [— 0.45 —]       │               │
│              │   Ink bleed    [— 0.3 —]        │               │
│              │ [▶ Audition on wheel] [Save]    │               │
└──────────────┴─────────────────────────────────┴───────────────┘
```

### Build A — phases

1. **Knob extraction.** Each scene file declares a typed `params` schema + a pure `applyParams(state, params)` so the existing physics reads from the schema instead of constants. No behavior change for built-ins (defaults reproduce today's look).
2. **Scene definition DTO.** A `SceneDefinition` JSON shape stored in `user_scenes.graph_json` — `{ templateId, params, voiceMap, palette, schemaVersion }`. Versioned so future schema migrations are safe.
3. **Runtime resolver.** `resolveScene(definitionOrBuiltinId)` returns a live `Scene` instance for the render loop. Dock pack/scene menu reads from this resolver, so user scenes appear alongside built-ins.
4. **Server functions** (`src/lib/studio/scenes.functions.ts`, RLS-scoped to `owner_id`): `listMyScenes`, `createScene`, `updateScene`, `renameScene`, `deleteScene`, `duplicateScene`, `exportSceneJson`.
5. **Studio Scenes tab UI.** Three-column layout matching Packs. Template picker on the right; live knobs in the middle with 250 ms debounce; "Audition on wheel" deep-links back to `/` with a temporary session override (no save until you click Save).
6. **Dock integration.** Scene picker grows a "My Scenes" group; "Manage scenes" → `/studio?tab=scenes`.
7. **Promotion to built-in.** Same flow as Packs: Export JSON → I drop it into `src/lib/scenes/built-in-curated.ts` and it ships for everyone.

### What's not in A
- Hand-drawn geometry / SVG import.
- Custom trigger-zone authoring.
- Per-scene shader / WebGL effects.
- Multi-template composition (one template per scene).

These all land naturally in B.

## What B would add later
- A `primitives/` library (Orbit, LineSegment, ParticleStream, TriggerZone, LFO, RatioGrid, Palette).
- A graph editor (react-flow or similar) with typed sockets.
- A pure interpreter that compiles a graph into a `Scene` at runtime.
- Migration: every A-scene serialises to an equivalent graph automatically.

## Out of scope (later passes either way)
- Sharing user scenes between users.
- Public scene gallery.
- AI scene generation from a text prompt.
- Recording/exporting scene videos.

## Question for you

Pick A or B (or "A now, B later" — my recommendation). I won't start coding until you confirm, because the answer changes file #1.
