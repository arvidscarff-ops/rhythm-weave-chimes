# Scene Creator — `/admin/scenes`

A passcode-gated admin workspace to author "Scenes" (background media + engine + palette + audio-reactivity), preview them live, publish, and have the public app consume them from the database.

## Credit estimate

Rough range: **~25–40 credits**, depending on iteration. Breakdown:
- DB migration + storage bucket + RLS/grants: ~2–3
- Server functions (CRUD + signed URL upload): ~3–5
- Admin dashboard UI (split-screen, dropzone, engine selector, sliders, color pickers): ~10–15
- Audio-reactive wiring into existing canvas engines: ~5–8
- Public dock integration + smooth scene transition: ~4–6
- Polish, typecheck, bug fixes: ~3

Actual cost depends on how many revision passes you request on the visual design and how deep the audio-reactive integration needs to go into each existing engine.

## 1. Data layer

New table `public.app_scenes`:
- `id uuid pk`, `name text`, `owner_id uuid` (nullable for built-ins)
- `background_type text check in ('image','video')`
- `background_path text` (storage key; resolve to signed/public URL client-side)
- `trigger_engine_id text` (matches existing `SceneKind`: `stringNet | pendulumFan | spiralArp | radialSweep | mandalaMatrix | metatronLattice | fractalNebula | radialResonator`)
- `ui_theme_colors jsonb` — `{ nodeGlow, wireframe, dockAccent, textAccent }`
- `visual_fx jsonb` — `{ backgroundBlur, backgroundGlow, trailPersistence }`
- `audio_reactive jsonb` — `{ amplitude, scalePulse, opacityPulse, blurPulse, threshold }`
- `is_published bool default false`
- `created_at`, `updated_at` + trigger

GRANTs: `authenticated` full; `anon` SELECT only where `is_published = true` (via policy) so the public dock can read without auth. `service_role` all.

New storage bucket `scene-assets` (private). Uploads via signed upload URL from a server fn; reads via signed URL (short-lived) or public bucket if you prefer — I'll default to private + signed reads to keep it consistent with `samples`/`pack-covers`.

## 2. Server functions (`src/lib/admin/scenes.functions.ts`)

- `listScenes`, `listPublishedScenes` (public, no auth)
- `createScene`, `updateScene`, `renameScene`, `deleteScene`, `duplicateScene`
- `publishScene(id, is_published)`
- `createSceneAssetUploadUrl({ ext, mime })` → returns `{ path, token }` for direct browser upload
- `getSceneAssetUrl(path)` → signed URL

All admin mutations gated by existing `verifyAdminPasscode` pattern (mirrors `packs.functions.ts` / `scales.functions.ts`).

## 3. Admin UI — `/admin/scenes`

Split-screen layout using existing `ResizablePanelGroup`:

```text
┌─────────────────────────┬─────────────────────────┐
│  Scene list + editor    │   Live preview canvas   │
│  ─ Name                 │   (background media +   │
│  ─ Media dropzone       │    selected engine +    │
│  ─ Engine dropdown      │    palette + audio-fx   │
│  ─ Palette pickers      │    applied in realtime) │
│  ─ FX sliders           │                         │
│  ─ Audio-reactive       │   [Play test tone] to   │
│  ─ Publish toggle       │    exercise reactivity  │
└─────────────────────────┴─────────────────────────┘
```

Components:
- `SceneList` — sidebar of scenes with create/duplicate/delete.
- `SceneEditorForm` — all controls; local draft state; debounced `updateScene`.
- `MediaDropzone` — drag/drop, validates type + size (≤ ~15 MB video, ~5 MB image), uploads via signed URL, stores `background_path` + `background_type`.
- `EngineSelector` — dropdown of the 8 existing `SceneKind`s.
- `PaletteEditor` — 4 color inputs (native `<input type="color">` + hex text).
- `FxSliders` — background blur (0–40px), background glow (0–1), trail persistence (0–0.5 clear-alpha).
- `AudioReactivePanel` — amplitude 0–2×, plus per-channel toggles (scale/opacity/blur) and threshold.
- `PreviewCanvas` — renders the selected background under a `<canvas>` that mounts the chosen engine via existing `sceneOverlay` + `sceneTypes` wiring, subscribing to `triggerBus` for reactive pulses.

## 4. Audio-reactive plumbing

- Extend `triggerBus` (or subscribe to existing note callbacks) to emit a normalized `intensity` per hit.
- New helper `applyReactive(el, settings, intensity)` that mutates CSS custom properties `--scene-scale`, `--scene-opacity`, `--scene-blur` on the background wrapper via `requestAnimationFrame`, with exponential decay.
- Preview canvas subscribes locally; public dock uses the same helper against the app-level background wrapper.

## 5. Public sync

- New `useActiveScene()` hook fetches `listPublishedScenes` (React Query) and reads/writes the selection to `sessionUrl` state (same pattern as `pack`).
- Update `PhaseDock`'s Scenes menu to list published scenes from DB alongside/instead of hardcoded ones (kept as fallback).
- Add `<SceneBackground />` in `__root.tsx` (or `routes/index.tsx`) rendering the media element + palette CSS vars scoped to a wrapper; engine canvas reads the same vars.
- Palette applied by setting `--node-glow`, `--wire-color`, `--dock-accent`, `--text-accent` on the wrapper; existing engines updated minimally to read these vars where they currently use hardcoded colors.
- Transition: cross-fade background (`opacity` + `filter`) over ~600ms when scene changes.

## 6. Build order

1. Migration + `scene-assets` bucket + RLS/grants.
2. Server functions + signed upload flow.
3. Admin route shell + list/create/delete.
4. Editor form (metadata, engine, palette, FX).
5. Media dropzone + upload.
6. Live preview canvas (background + engine mount).
7. Audio-reactive module + preview test-tone.
8. Public dock integration + `<SceneBackground />` + palette CSS var wiring.
9. Typecheck, polish transitions, verify publish→appears-in-app loop.

## Open questions (answer before build, or I'll take the defaults noted)

1. **Storage privacy**: private bucket + signed URLs (default) or public bucket for simpler `<video>` playback?
2. **Video size cap**: default ≤ 15 MB, ≤ 20s loop. OK?
3. **Should published scenes replace the current hardcoded scene list in the dock, or appear as an additional "Custom" group?** Default: additional group, hardcoded stays as fallback.
4. **Palette scope**: apply to all 8 engines uniformly (default), or per-engine overrides later?