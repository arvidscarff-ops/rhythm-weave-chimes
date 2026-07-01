## Goal

Replace the hardcoded scale library with an admin-authored scale + chord-progression engine. Users still pick a root key from the dock; the harmony (which scale + which chord tones are currently active) is driven by admin content and advances on the global clock.

## 1. Database (Lovable Cloud)

Two new tables, RLS-protected. Old `SCALES` code deleted from client.

**`custom_scales`**
- `id uuid pk`, `name text`, `pool_size int` (max notes in scale pool, default 7)
- `intervals int[]` (semitone offsets from root, length = pool_size — this is the scale pool the progressions index into)
- `is_published bool`, `created_at`, `updated_at`
- RLS: public read when `is_published`; admin full write. Grants per house rules.

**`scale_progressions`**
- `id uuid pk`, `scale_id uuid fk cascade`
- `step_order int`, `chord_tones int[]`, `accent_tones int[]`, `duration_bars int default 4`
- Unique `(scale_id, step_order)`
- RLS: public read when parent scale is published; admin full write.

Migration also drops any dead scale-related columns/refs if present and grants `EXECUTE` on `has_role` (already done).

## 2. Chord Progression Engine (Web Audio)

Rewrite `src/lib/music/scales.ts` + `composer.ts`:

- New type `ActiveScale = { intervals: number[]; steps: { chord_tones:number[]; accent_tones:number[]; duration_bars:number }[] }`.
- New module `src/lib/music/progression.ts`:
  - Loads published scales from Cloud (public anon SELECT) into an in-memory registry.
  - `getActiveStep(globalBar, scale)` → `Math.floor(bar / step.duration) % totalSteps`, walking variable-length steps.
  - Exposes `activeChordTones()` / `activeAccentTones()` for the current bar.
- Composer changes:
  - `ComposerSettings` now stores `scaleId: uuid` (published scale) instead of the old `ScaleId` union.
  - `pickDegree` no longer picks a raw pool index. It picks from `chord_tones` (primary) with a **15% gate** switching to `accent_tones`. Existing `sequential/random/arpeggio/brownian` modes operate over the active chord-tone set rather than the whole scale.
  - `degreeToFreq` becomes `toneToFreq(root, scale.intervals, tone, octave)` — quantizes the selected scale-pool index against the user's root key from the dock. Root selector in the dock is unchanged.
- Global clock: read `currentBar` from `src/lib/engine/clock.ts` (already exposes tempo/time) so ignition triggers resolve harmony at trigger time. No new clock — just a small helper `barFromTime(globalTime, bpm)`.

## 3. Admin Panel: `/admin/scales`

Gated by the existing admin passcode + `has_role('admin')`, same pattern as `/admin/packs`.

- **Scale list**: cards showing name, pool size, step count, published toggle, edit/delete.
- **Scale editor**:
  - Name, pool size (2–12), intervals editor (chips 0–11 semitones with a small piano visualizer).
  - **Progression timeline**: horizontal strip of step cards in `step_order`. Each card shows: step #, `duration_bars` (number input), chord-tones multi-select over the current scale pool, accent-tones multi-select, drag-to-reorder, add/remove step.
  - Preview: press a root key → hear the current step's chord tones played through the existing sample engine (uses `composerAdvance` in a preview mode).
- Server functions in `src/lib/admin/scales.functions.ts` for list/upsert/publish/delete, all `.middleware([requireSupabaseAuth])` + `has_role('admin')` check. Public read for the runtime uses a server publishable client (matches packs pattern).

## 4. Dock UI

- Remove the hardcoded scale dropdown in `PhaseDock.tsx`. Replace with a dropdown populated from published `custom_scales` (fetched via TanStack Query from a public server fn).
- Root key selector stays.
- Session URL (`sessionUrl.ts`) migrates `sc` from `ScaleId` string to scale UUID; add a small back-compat shim that falls back to the first published scale if the stored id no longer exists.

## 5. Cleanup

- Delete the old `SCALES` table and `ScaleId` union.
- Update `src/routes/index.tsx`, `PhaseDock.tsx`, `sessionUrl.ts`, and any composer callers to the new API.
- Seed migration inserts one starter scale ("Neo-Ambient Pentatonic", intervals `[0,3,5,7,10]`, one 4-bar step with chord tones `[0,2,4]`, accents `[1,3]`) so the app has content on first load.

## Technical notes (for devs)

- Progression state is derived, not stored — pure function of `(globalTime, bpm, activeScale)`. No new persisted runtime state.
- Accent gate uses `Math.random() < 0.15`; extract to `ACCENT_PROBABILITY` constant for future tuning.
- Runtime scale registry cached in-memory with a `router.invalidate()`-friendly query key; admin publish invalidates it.
- All new public tables include the required `GRANT` block; `has_role` already granted to `anon, authenticated`.

## Open question

Should the accent probability (currently 15%) be a per-scale or per-progression-step field in the admin, or a global constant for now? I'll default to a global constant unless you want it exposed.
