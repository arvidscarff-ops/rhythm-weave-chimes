## Goal
Refactor the Sound Pack CMS + audio engine from "1 sample per fixed slot (×6)" to "dynamic slots (1–12) with a round-robin pool of 1–6 samples per slot" for organic, non-repeating playback.

## 1. Database (single migration, wipes current pack/slot/sample data)

- Truncate `packs`, `pack_slots`, `samples` (cascade). Buckets `samples` and `pack-covers` stay; orphaned files are acceptable.
- Drop `pack_slots.slot_index` UNIQUE-per-pack constraint; keep `slot_index` as ordering only (0..11, no hard DB cap, UI enforces 12).
- Drop `pack_slots.sample_id` column.
- New table `public.pack_slot_samples`:
  - `id uuid pk`, `slot_id uuid fk pack_slots on delete cascade`, `sample_id uuid fk samples on delete restrict`, `position int not null` (0..5, order within the pool), `created_at`.
  - Unique `(slot_id, position)`. Index on `slot_id`.
  - GRANT SELECT to `anon, authenticated`; ALL to `service_role`. Enable RLS. Policy: `SELECT` allowed when parent pack is published or built-in (mirrors existing `pack_slots` read policy via join). Writes: service_role only (admin path uses `supabaseAdmin`).
- `pack_slots.humanization` JSONB gains an `override` boolean at the app layer (stored inside the JSON, no schema change). When `override=false`, engine falls back to pack-level humanization; when `true`, slot values fully replace.

## 2. Server functions (`src/lib/admin/packs.functions.ts`)

- `AdminSlot` type: replace `sample`/`sample_id` with `samples: { id, name, storage_path, position }[]` (sorted).
- `listAdminPacks`: update select to `pack_slot_samples(position, samples(id,name,storage_path))`; return sorted arrays.
- `createAdminPack`: seed with **1** empty slot (not 6). Admin adds more via UI.
- New `addAdminSlot({ passcode, pack_id })` → appends slot at `max(slot_index)+1`, cap at 12.
- New `removeAdminSlot({ passcode, id })` → deletes slot (cascade removes join rows); re-packs `slot_index` server-side to keep 0..n contiguous.
- New `setAdminSlotSamples({ passcode, slot_id, sample_ids: string[] })` → validates length 1..6, replaces `pack_slot_samples` rows for that slot in a transaction (delete + insert with positions).
- Extend `updateAdminSlot` to accept `name` (maps to existing `label` column — reuse; no schema change).
- Keep `registerAdminSample`, `createAdminUploadUrl`, `updateAdminPack` as-is.

## 3. Admin UI (`src/routes/admin.packs.tsx`)

- Replace fixed 6-slot grid with a dynamic list of `SlotEditor` cards (1..12).
- Header controls: **Add Slot** (disabled at 12), **Remove Slot** on each card (disabled when only 1 remains, confirm dialog).
- Each slot card:
  - Text input: **Slot name** (Pluck A, Kick, …) → `label`.
  - **Multi-file dropzone** (react-dropzone-free implementation using existing `<input type=file multiple accept="audio/wav">`):
    - Accepts .wav only, min 1 / max 6 files enforced with toast errors.
    - Helper copy: *"Drop 3–4 variations of the same sound for organic round-robin playback. More variations = less machine-gun repetition."*
    - Thumbnails/list of current samples with preview (▶) + remove (×) + drag-reorder (simple up/down buttons — no dnd-kit dep).
    - Upload flow reuses `createAdminUploadUrl` → `uploadToSignedUrl` → `registerAdminSample`, then `setAdminSlotSamples`.
  - Humanizer sliders (Velocity, Cutoff Hz range, Detune, Pan) unchanged.
  - New **"Override pack humanization"** checkbox. When off, sliders are visually disabled and the saved JSON is `null` (engine falls back). When on, JSON persists with `{ override: true, ... }`.

## 4. Audio engine

- `src/lib/admin/humanization.ts`: extend `Humanization` with optional `override?: boolean` (default true when object exists; treat missing/false as "inherit"). Update `parseHumanization` + `resolveHumanization` accordingly.
- `src/lib/sound/runtimePacks.ts`:
  - `CustomSlot.storagePath: string` → `storagePaths: string[]` (1..6).
  - Add `lastIndex: number` per slot (mutable, kept on the `RuntimePack` object) for **round-robin no-repeat**.
  - New selector `pickVariation(paths, state)`:
    - If length 1 → index 0.
    - Else pick `Math.floor(Math.random() * (paths.length - 1))`; if `>= state.lastIndex` add 1 (Fisher-style skip). Store new index.
  - `warmCustomPack`: decode **every** storage path across all slots (parallel `loadSampleBuffer`).
  - `playSampleSlot`: pick path via `pickVariation`, then existing playback pipeline.
  - `PACK_SELECT` updated to fetch `pack_slot_samples(position, samples(storage_path))` ordered by position.

## 5. Read paths for the public app

- `fetchPublishedPacks` / `fetchCustomPacks` mappers updated for new nested shape.
- Slots with 0 samples fall through to the built-in `moss` fallback voice (existing behavior).

## 6. Out of scope

- No changes to composer, scenes, or dock.
- No new deps.
- OG image / SEO metadata unchanged.

## Technical notes

- Round-robin state lives on the in-memory `RuntimePack` object (not persisted). Reloading a pack resets the sequence — acceptable.
- Store `override` inside the existing `humanization` JSONB to avoid a schema migration for a UI-only concept.
- `pack_slot_samples` uses `position` (not array) so we get FK integrity, per-sample RLS join, and easy reorder without rewriting a Postgres array.
- Wiping data means the current admin UI will show 0 packs on first load post-migration — expected.