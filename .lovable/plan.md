# No-Code Studio — Full Build Plan (Option B)

Three in-app builders — Composer Presets, Sound Pack Studio, Scene Studio — all backed by Lovable Cloud, private to your account, and **promotable to built-in product features later**.

## The promotion principle (key design constraint)

Every user creation is stored as a **versioned JSON document** matching a stable schema. That same schema is what built-in scenes, packs, and presets use. So promoting "my creation" → "ships with the app" is literally:

```text
1. Export the JSON from your library         (one click in the studio)
2. Drop it into src/lib/builtins/{kind}/      (I do this when you ask)
3. Flip `is_builtin = true`                  (one-line migration)
```

No rewrite, no translation step. To make this work, the studios are built on top of a shared **runtime compiler** (`graphCompiler.ts`, `packCompiler.ts`) that the existing built-in scenes will also migrate to use. After this work lands, "built-in" and "user-made" are the same data shape running through the same runtime.

---

## Phase 1 — Foundation (shared by all three studios)

### 1.1 `My Studio` shell
- New protected route `src/routes/_authenticated/studio.tsx` with three tabs: **Scenes / Packs / Presets**.
- Sidebar entry "My Studio" in the dock (auth-gated; signed-out users see "Sign in to create").
- Each tab: grid of saved items + "New" button + per-item Load / Duplicate / Rename / Delete / Export JSON.

### 1.2 Database
Three new tables (owner-scoped RLS, full GRANTs, `auth.uid()` policies):

```text
user_scenes              user_packs                user_composer_presets
- id                     - id                      - id
- owner_id               - owner_id                - owner_id
- name                   - name                    - name
- graph_json (jsonb)     - pack_json (jsonb)       - preset_json (jsonb)
- schema_version         - schema_version          - schema_version
- is_builtin (default f) - is_builtin (default f)  - is_builtin (default f)
- created_at/updated_at  - created_at/updated_at   - created_at/updated_at
```

`is_builtin = true` + `owner_id IS NULL` = "ships with product"; readable by everyone, writable by no one.

### 1.3 Server functions
`src/lib/studio/*.functions.ts` — `listMine`, `save`, `rename`, `duplicate`, `delete`, `exportJson`. All use `requireSupabaseAuth`.

---

## Phase 2 — Composer Preset Library *(fastest, lowest risk)*

- "Save current Composer settings as preset" button in the existing Composer panel.
- Preset = the JSON you already serialize into the share-URL (`composer` block of `SessionState`).
- Library grid: thumbnail = scale name + slot count badges; click to load into live Composer.
- Schema: `{ root, scale, slots[] }` — already exists, just persist it.

**Why first:** validates the entire save/load/Cloud loop with the least new code, and you immediately get value from it.

---

## Phase 3 — Sound Pack Studio

### Editor UI
- 6 vertical slot strips. Per slot:
  - Source: oscillator (sine/tri/saw/square/FM/noise) **or** uploaded sample
  - ADSR envelope (4 sliders + visual curve)
  - Filter (type, cutoff, resonance)
  - FX sends (reverb / chorus / grain / tone — 0..1 each)
  - Pitch offset (-24..+24 semis), pan, gain
- "Audition slot" tap-pad per strip.
- "Audition pack" plays a short scripted phrase through all 6 slots.

### Sample uploads
- Drag-drop wav/mp3 → uploads to existing `samples` bucket → row in `samples` table → referenced by `sample_id` in slot config.

### Schema (`pack_json`)
```text
{ schemaVersion: 1, slots: [{ source, env, filter, fx, pitch, pan, gain }, ... x6] }
```

### Runtime
`src/lib/sound/packCompiler.ts` turns `pack_json` into a `RuntimePack` consumable by the existing audio engine. Built-in packs (moss/prism/obsidian) are refactored to this same JSON shape during this phase — they become the reference examples.

---

## Phase 4 — Scene Studio (node-graph editor)

### Editor
- Split view: graph canvas left (using `@xyflow/react`), live scene preview right, params panel bottom.
- Node palette (curated, finite — keeps it musical & 60fps):

```text
GEOMETRY (8)        MOTION (6)         TRIGGER (5)         VOICE (1)
- Ring              - Orbit            - Line cross        - Voice out
- Polygon (3..12)   - Rect-sine bounce - Center hit          (slot, pitch,
- Radial rays       - Pendulum         - Vertex arrival      pack, hue,
- Nested polygons   - Brownian drift   - Edge enter          velocity)
- Lattice           - Pulse expand     - Collision
- Grid              - Static
- Spiral
- Free points
```

- Connections: Geometry → Motion → Trigger → Voice. Type-checked in the editor (incompatible ports won't connect).
- Side panel exposes per-node sliders: count, speed, phase spread, hue, blend mode, trail fade, R_max, etc.
- "Test scene" plays it live in the preview; "Save" pushes to your library and makes it selectable in the main dock.

### Schema (`graph_json`)
```text
{
  schemaVersion: 1,
  nodes: [{ id, type, params }],
  edges: [{ from: nodeId, to: nodeId }],
  meta: { name, blendMode, trailAlpha }
}
```

### Runtime compiler
`src/lib/scenes/graphCompiler.ts`:
- Pure function `compile(graph) → Scene` (implements existing `Scene` contract with `sample` + `eventsIn`).
- Big switch over node types — no `eval`, no codegen.
- Built-in scenes (Metatron, Radial Resonator, Fractal Nebula, etc.) get re-expressed as graphs during this phase so the compiler is battle-tested against real cases. Each one becomes a "starter template" users can duplicate.

---

## Phase 5 — Promotion pipeline (the "later use in product" part)

Two one-click operations from any library item:

- **Export JSON** → downloads the document; I can drop it into `src/lib/builtins/{scenes|packs|presets}/` and ship it.
- **"Suggest for product"** (optional, later) → flags the item; admin view lists flagged items; I review and promote.

Promoted items become read-only built-ins available to everyone, no AI prompt required to author them.

---

## Out of scope (per your earlier answers)

- No public gallery, no sharing links, no remix feed.
- No AI-assisted authoring inside the studios.
- No new *node types* without me — the node palette is finite. New shapes/physics still require an engine update.

---

## Build order & rough sequencing

```text
P1 Foundation  ──▶ P2 Presets ──▶ P3 Pack Studio ──▶ P4 Scene Studio ──▶ P5 Promotion
   (small)         (small)         (medium)            (large)             (small)
```

Each phase is independently shippable — we can stop, pause, or reorder at any boundary. You can use the studio after Phase 2 already.

---

## Open call before I start

- Approve this plan to begin **Phase 1 + Phase 2** in the first build pass (foundation + Composer presets — usable end-to-end).
- Phases 3, 4, 5 will each be re-planned in their own pass with concrete UI mocks before building, so you stay in the loop.
