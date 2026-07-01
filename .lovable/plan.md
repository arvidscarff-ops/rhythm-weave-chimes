## Sound Pack CMS + Humanization Engine

Extend the existing `packs`/`pack_slots`/`samples` schema with publishing, cover art, and humanization; add an admin-only CMS at `/admin/packs` gated by a shared passcode; wire humanization into the runtime dispatcher; and expose published packs to everyone (signed in or not) on the wheel.

### Phase 1 — Schema & storage

Migration (extends existing tables, no parallel `sound_packs`):

- `packs`: add `is_published boolean default false`, `cover_image_url text`, `humanization jsonb` (pack-level defaults).
- `pack_slots`: add `humanization jsonb` (nullable override per slot).
- Storage: create public `pack-covers` bucket (cover art needs anonymous read); keep `samples` bucket private (signed URLs already work for anon via server fn).
- RLS additions:
  - `packs`: `SELECT` policy `USING (is_published = true)` granted to `anon` + `authenticated` (keeps existing owner/admin write policies).
  - `pack_slots` + `samples`: allow read when parent pack is published (join check) to `anon` + `authenticated`.
  - `GRANT SELECT` on all three to `anon`.

Humanization JSON shape (shared type, both pack & slot):
```ts
{ velocityPct: number, cutoffHz: [min,max]|null, detuneCents: number, panPct: number }
```
Slot value, when present, overrides pack value field-by-field.

### Phase 2 — Admin gate (shared passcode)

- Server-only env: `ADMIN_PASSCODE`, `ADMIN_SESSION_SECRET` (added via `add_secret`).
- `src/lib/admin/gate.functions.ts`: `unlockAdmin`, `lockAdmin`, `requireAdmin()` helper using `useSession` + `timingSafeEqual` (per shared-password-gate pattern).
- Route `/admin/unlock` (public): passcode form.
- Route `/admin/packs` (public path, gated in loader via `requireAdmin` → redirect to `/admin/unlock`).
- Every admin server fn calls `requireAdmin()` first, then uses `supabaseAdmin` for writes (bypasses RLS cleanly for CMS ops).

### Phase 3 — Admin CMS UI (`/admin/packs`)

Three-pane layout matching the existing Studio look:

- **Left:** pack list (name, published pill, cover thumb). "New Pack" button.
- **Middle — Pack editor:**
  - Name, description, cover upload (drag/drop → `pack-covers` bucket → sets `cover_image_url`).
  - Publish toggle (writes `is_published`).
  - Pack-level Humanizer card (4 sliders): Velocity ±%, Cutoff Hz range (dual slider), Detune ±cents, Pan ±%.
- **Right — Samples:**
  - Drag/drop `.wav` zone → uploads to `samples` bucket, inserts `samples` row + `pack_slots` row (auto-assigns next free 0–5 slot).
  - Per-slot row: label, slot index, gain/pitch/pan (existing), **"Override humanization" toggle** revealing the same 4 sliders (persist to `pack_slots.humanization`; null = inherit).
  - Audition button (reuses `auditionSample`, applies effective humanization).

Server fns (`src/lib/admin/packs.functions.ts`): `listAllPacks`, `upsertPack`, `deletePack`, `uploadCover`, `addSample`, `updateSlot`, `deleteSlot`, `setPublished`. All gated by `requireAdmin`.

### Phase 4 — Humanization engine

Refactor `src/lib/sound/runtimePacks.ts` `playSampleSlot`:

- Resolve effective humanization: `{ ...packHumanization, ...slotHumanization }` (field-wise).
- Insert `BiquadFilterNode` (lowpass) into the chain when `cutoffHz` set; randomize `frequency.value` in range per strike.
- `GainNode`: multiply by `1 + (rand()*2-1) * velocityPct`.
- `AudioBufferSourceNode.detune.value`: base + `(rand()*2-1) * detuneCents`.
- `StereoPannerNode.pan.value`: base + `(rand()*2-1) * panPct`, clamped ±1.
- All randomization computed **at trigger time**, not at load time.
- Extend `CustomSlot` + `RuntimePack.custom` types to carry `humanization` fields loaded from DB.

### Phase 5 — Public integration

- `fetchPublishedPacks()` public server fn (no auth, uses server publishable client) → returns packs where `is_published=true` with slots + signed sample URLs + cover URL.
- `runtimePacks.ts`: replace `fetchCustomPacks` (auth-only) with `fetchPublishedPacks` for the public wheel; keep the auth'd variant for Studio's "my packs".
- Warm cache: `warmCustomPack` already preloads sample buffers on pack selection — extend to also preload on hover in the dock for zero-latency first strike.
- Dock (`PhaseDock.tsx`): pack selector already lists custom packs; swap data source to published + show `cover_image_url` thumbs.

### Technical notes

- Cover bucket is public (workspace policy permitting); if blocked, fall back to signed URLs refreshed server-side.
- Humanization sliders use existing `Slider` component; cutoff uses two thumbs (Radix supports `value=[min,max]`).
- Admin session cookie: httpOnly, 7-day maxAge, separate from Supabase auth cookies.
- No breaking changes to existing Studio Packs tab — it continues to manage user-owned (non-published) packs. Admin CMS is the only surface that toggles `is_published`.

### Out of scope (this pass)

- Pack versioning / drafts beyond the boolean toggle.
- Per-user favorites, ratings, or analytics on published packs.
- Bulk sample import / ZIP upload.
