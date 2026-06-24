# Plan: Pro-grade sound engine + Owner Dev Mode for sample packs

Two phases. Phase 1 makes the existing app sound dramatically richer with zero backend. Phase 2 adds a private Dev Mode for you to upload, edit, and publish your own sample packs from cloud storage.

---

## Phase 1 — Audio engine upgrade (no backend, ships first)

Replace the current thin synth chain with a true stereo, studio-grade engine. All Web Audio, no files.

**Per-voice synthesis (rewritten `src/lib/sound/packs.ts`)**
- Move from mono "one osc + filter" voices to **layered stereo voices**: 2–4 detuned partials per note with independent pan positions (Haas micro-delay 8–18ms between L/R for width without phase damage).
- Real ADSR per layer (currently we trigger + decay). Slow attacks (200–800ms) for the ambient packs, fast for plucks.
- Add **velocity + ring-index → timbre mapping** (brighter filter, more partials on outer rings) so polyrhythms breathe.
- Per-pack voice recipes redesigned:
  - **MOSS** — soft FM bells, additive choir pads, bowed-glass.
  - **PRISM** — granular shimmer, detuned saw plucks, resonant marimba.
  - **OBSIDIAN** — sub-bell, noise-breath, deep FM bass with sidechain duck.

**Master FX chain (rewritten in `src/routes/index.tsx` AudioGraph)**
- Replace algorithmic "reverb" with **true convolution reverb** using bundled impulse responses (Room, Hall, Plate, Cosmic) as small lossless IRs uploaded via Lovable Assets (CDN-hosted, cached). Stereo IRs → genuine stereo tail.
- True stereo chorus (dual delay lines with LFOs in quadrature).
- Ping-pong delay (separate L/R taps) instead of mono delay.
- Stereo width / mid-side control on the master.
- Keep the 42Hz HPF + brickwall limiter (good, retain).
- Raise `AudioContext` to `{ sampleRate: 48000, latencyHint: "interactive" }`.

**Voice management**
- Pre-allocate a voice pool (24 voices, was 18) with proper stealing.
- Smooth param ramps (`setTargetAtTime`) everywhere — eliminates remaining clicks.

No UI changes needed for Phase 1; the existing FX/Packs drawers keep working and immediately sound better.

---

## Phase 2 — Owner Dev Mode + Cloud sample packs

### Access model
- **Owner-only.** Email/password auth (you) + `user_roles` table with `admin` role using the standard `has_role()` security-definer pattern. Public visitors see no Dev tab and cannot list/upload.
- A new left-rail link **"DEV"** appears only when the signed-in user has `admin`. Opens a full Dev Mode workspace (not just a drawer).

### Storage & format strategy (your "max quality" requirement)
- **Upload lossless masters**: 24-bit WAV or FLAC, stereo, up to ~10MB/sample, sample rate up to 96kHz.
- **Two storage tiers per sample** in a private Cloud Storage bucket `sample-packs`:
  - `master/` — original WAV/FLAC, never touched, used for download/export and re-transcoding.
  - `stream/` — auto-generated **stereo 256kbps Opus** (in an OGG container) for fast in-browser playback. Opus is near-transparent and ~10× smaller than the WAV.
- Transcoding runs server-side via a TanStack server function using a WASM ffmpeg build (no native binaries; works in the Worker runtime). Triggered on upload; status tracked on the sample row.
- Playback in the app uses the Opus stream by default. A Dev Mode toggle "Use lossless master" lets you A/B with the original WAV decoded via `AudioContext.decodeAudioData` for reference listening.
- All audio served through CDN-backed signed URLs; cached in `IndexedDB` after first decode so each session loads instantly.

### Database (Lovable Cloud / Postgres)
- `packs` — id, slug, name, description, owner_id, is_published, created_at.
- `samples` — id, pack_id, name, root_note (midi), loop_start, loop_end, gain_db, pan, attack/decay/sustain/release, master_path, stream_path, sample_rate, channels, duration_ms, status (`uploading|transcoding|ready|failed`).
- `pack_slots` — id, pack_id, slot_index (0–5, the six "ring sounds"), sample_id, pitch_offset, fx_overrides (jsonb). This is what the main app reads to voice rings.
- `user_roles` (standard pattern) + `has_role()` definer fn. RLS:
  - Public can `SELECT` packs/samples/pack_slots WHERE `is_published = true`.
  - Only `admin` can INSERT/UPDATE/DELETE.

### Dev Mode UI (`src/routes/_authenticated/dev.tsx`)
A dedicated workspace, glassmorphic to match Phase aesthetic:
- **Pack list** (left): create / rename / duplicate / publish / unpublish.
- **Slot editor** (center): six slots matching the six ring voices. Drop a sample onto a slot, set pitch offset, per-slot FX overrides, audition button.
- **Sample library** (right): drag-and-drop upload (multi-file), waveform preview (canvas-rendered from decoded PCM, stereo channels stacked), trim handles (loop_start/end), ADSR sliders, gain/pan, root-note picker, tag/rename.
- **A/B "master vs stream"** toggle per audition for quality verification.
- **Live test**: a "Send to main wheel" button that hot-swaps the active pack to your edit without leaving Dev Mode.

### How the main app consumes packs
- The existing `PacksDrawer` is rewritten to fetch packs from the DB (built-in + your published custom ones, merged). Built-in synth packs (Phase 1) remain available as a separate category.
- Switching pack still triggers the existing "re-voice active notes" logic.

### Logistics answer (what you asked)
- Yes — samples live in a **private Cloud Storage bucket** behind Postgres metadata. Every app instance (any device, any visitor) fetches the same published packs via CDN-signed URLs. Built-in synth packs require no network. Your unpublished WIP packs are only visible to you.
- Cost is bounded: Opus streams are ~1–2MB each; a 6-sample pack is ~10MB streamed and ~50MB stored lossless. Plenty of headroom on Cloud's storage allowance.

---

## Deliverables order
1. **Phase 1 ships first as one change set** — you immediately hear the upgrade. No login, no DB.
2. **Phase 2 ships in two parts**:
   - 2a: Enable Cloud, auth, `user_roles`, `packs`/`samples`/`pack_slots` schema, storage bucket, RLS, role grant for your account.
   - 2b: Dev Mode UI, upload + WASM-ffmpeg transcode pipeline, waveform editor, main-app integration.

## Technical notes
- Transcoder uses `@ffmpeg/ffmpeg` WASM inside a `createServerFn` handler — Worker-safe, no native binaries.
- Convolution IRs in Phase 1 stored via `lovable-assets` (CDN), not in the repo.
- `AudioContext` created on first user gesture (already done) at 48kHz.
- All Supabase admin work goes through `client.server` loaded inside handlers, per the import-graph rules.
- `LoadedSample` cache layer uses `IndexedDB` keyed by `stream_path` + version hash so re-transcoded samples invalidate cleanly.

After Phase 1 you'll already have a major fidelity jump; Phase 2 is what unlocks your own packs at studio quality.