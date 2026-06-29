## Goal

Ship the **Packs** tab of My Studio with full functionality for every signed-in user. The existing admin-only `/dev` already proves the model works end-to-end (upload sample → assign to slot → audition → live in the wheel). This plan lifts that flow into `/studio`, scoped to each user, with a UI consistent with the Presets tab — and keeps the door open to promote any user pack to a built-in later.

## What you'll be able to do

In **My Studio → Packs**:

- **Create** a new sound pack (named, private by default).
- **Upload your own audio** (WAV/MP3/FLAC/AIFF) into your personal sample library.
- **Drop a sample into any of 6 slots** of a pack, with **label**, **pitch (semitones)**, **gain (dB)**, and **pan**.
- **Audition** a sample or a configured slot with a single click.
- **Rename**, **duplicate**, **delete**, **export to JSON** any of your packs.
- **Pick your pack live** from the dock's Packs menu — it plays immediately on the wheel.
- **Manage samples** (rename/delete) from a side panel; deleting a sample frees storage.

## Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ My Studio                       [Presets] [Packs] [Scenes]   │
├──────────────┬───────────────────────────┬───────────────────┤
│ MY PACKS     │  PACK: "Forest"           │  MY SAMPLES       │
│ + new        │  ─────────────────────    │  + upload         │
│ • Forest  ▸  │  Slot 1  [sample ▾]       │  • kick.wav  ▸ ×  │
│ • Drum kit   │   label / pitch / gain    │  • bell.wav  ▸ ×  │
│ • Strings    │   / pan          ▸ play   │  • pad.flac  ▸ ×  │
│              │  Slot 2 …                 │                   │
│              │  …                        │                   │
│              │  [Rename] [Duplicate]     │                   │
│              │  [Export] [Delete]        │                   │
└──────────────┴───────────────────────────┴───────────────────┘
```

Same header, typography, and chrome as the Presets tab so the two studios feel like one product.

## What we'll build

### 1. Database (one small migration)

The relational model already exists (`packs`, `pack_slots`, `samples`) and is what `runtimePacks.fetchCustomPacks` reads from. We only need to:

- **Confirm/tighten RLS** on `packs`, `pack_slots`, `samples` so every row is scoped to `owner_id = auth.uid()` (read/write).
- **Drop the unused `user_packs` table** created in the earlier phase — we're standardising on the relational model so promotion to built-in stays trivial.
- Add an `updated_at` trigger on `packs` if it isn't already present.

### 2. Server functions (`src/lib/studio/packs.functions.ts`)

All protected by `requireSupabaseAuth`, all scoped by RLS to the caller:

- `listMyPacks()` → packs + slots + sample metadata
- `createPack(name)` → inserts pack + 6 empty slots, returns the new row
- `renamePack(id, name)`, `deletePack(id)`, `duplicatePack(id)` (with slot copy)
- `updateSlot(slotId, { sample_id?, label?, pitch?, gain?, pan? })`
- `listMySamples()`, `deleteSample(id)` (also removes from storage)
- `exportPackJson(id)` → serialisable DTO usable for promotion to built-in

Sample upload stays client-side (Supabase Storage browser SDK already handles signed PUTs against the `samples` bucket — same path the admin `/dev` uses today).

### 3. Studio Packs tab UI (`src/routes/_authenticated.studio.tsx`)

- Add `packs` tab content using a three-column responsive grid (single column on mobile).
- Reuse the small slider/label primitives from the existing `/dev` page, ported to the Studio look (Tailwind, lucide icons, ghost buttons — match the Presets tab).
- Debounce slider writes (250 ms) so dragging doesn't spam the database.
- Deep-link via `?tab=packs` so the dock "Manage" item lands directly on it.
- Audition uses the existing `auditionSample(storagePath, { pitch, gain, pan })` helper — no audio engine changes.

### 4. Dock integration

- Pack selector already lists your custom packs (via `fetchCustomPacks`); no change needed there.
- Switch the **"Manage custom packs"** link from `/dev` → `/studio?tab=packs`.
- Empty-state copy when you have no packs yet: "Create one in My Studio".

### 5. /dev page

Kept as-is for admins (it doubles as a backstage tool). Not surfaced to regular users.

### 6. Promotion to built-in (documented, no UI yet)

For any user pack you want to ship as a permanent pack:
1. Click **Export JSON** in the studio.
2. Hand it to me in chat — I drop the voices/sample paths into `src/lib/sound/packs.ts` (or a new built-in slug) and they appear in everyone's Packs menu on the next deploy.

This keeps the relational store as the **source of truth for personal packs** and the JS catalogue as the **source of truth for shipped built-ins** — same split as today.

## Out of scope (handled in later passes)

- Public/shared packs between users.
- In-app "Submit for inclusion as built-in".
- Audio post-FX per slot (filter/ADSR/reverb send). Pitch/gain/pan only for v1, matching what's already wired into the audio path.
- The **Scenes** tab — next build pass, as you noted.

## Build order

1. Migration: RLS tighten + drop `user_packs` + trigger.
2. `packs.functions.ts` server functions.
3. Studio "Packs" tab UI + sample library panel.
4. Dock "Manage" link redirect + empty-state copy.
5. Smoke test: create pack → upload sample → assign → audition → select in dock → hear it on the wheel.
