# Handpan Scale Creator — Execution Plan

## Philosophy acknowledged
My Studio is the autonomous CMS. Admin authors sounds, scales, and progressions live — no code edits, no redeploys. Scales stop being abstract interval math and become a **tuned instrument** the admin can hear before publishing.

## 1. Data model (Supabase migration)

Add a new column to `custom_scales`:

- `pitches text[]` — ordered scientific pitch notation strings, e.g. `['D3','A3','Bb3','C4','D4','E4','F4','A4']`.

Keep `intervals` / `pool_size` for backward compatibility with existing rows, but the runtime engine will prefer `pitches` when present. No RLS change needed (existing policies cover the new column). New column is nullable so existing rows keep working.

## 2. Handpan UI (`src/routes/studio.scales.tsx`)

Replace the "Intervals (semitones from root)" toggle grid and the "Pool size" number input with a **Handpan Tone Field**:

- Circular arrangement of Note Slots (CSS grid + radial positioning). Center of the circle holds the "ding" (slot 0); remaining slots ring around it, like a real handpan.
- Each slot: a large tappable disc showing its assigned pitch (e.g. `A3`).
- Dropdown (`<Select>`) inside/under each slot with all pitches from `C1` through `C7` (chromatic, sharps preferred; `Bb` accepted via alias). Default new slots to `A3`.
- `+` button (bottom rail) appends a slot; `−` button removes the last. No hard cap — soft guidance in helper text ("Typical handpans: 8–12 notes"). Minimum 1.
- Click a slot → immediate audio playback + visual ripple (see §3, §4).
- "Save scale" writes `pitches[]` to Cloud via `updateAdminScale`.

The intervals/pool_size grid is fully retired from the UI. The chord-progression timeline below stays as-is, but chord/accent tone indices now reference **slot positions** in `pitches[]` instead of interval indices — the `TonePicker` will render up to `pitches.length` buttons.

## 3. Polyphonic audio engine (`src/lib/studio/handpanAudio.ts`, new file)

A dedicated, choke-free preview engine used only inside the Studio scale editor:

- Lazily create **one** shared `AudioContext` + master `GainNode` on first click (resume on user gesture).
- Load a default handpan/pluck sample buffer once (fetched from the `samples` storage bucket, or a bundled sine-decay fallback if none is set). Cache the `AudioBuffer` in-module.
- `playPitch(pitchName: string)`:
  1. Parse `pitchName` → MIDI → frequency; compute `playbackRate = freq / SAMPLE_ROOT_HZ`.
  2. **Instantiate a brand-new `AudioBufferSourceNode` on every call.** Never reuse.
  3. Create a **new `GainNode` per voice** with an ADSR-style envelope: 5 ms attack, sustain at 1.0, ~2.5 s exponential release (`gain.setTargetAtTime(0, now, 0.6)`).
  4. Route `source → voiceGain → masterGain → destination`.
  5. `source.start(now)`; schedule `source.stop(now + release + 0.1)`; on `ended`, disconnect voice nodes so GC can collect them.
- No voice cap, no stealing, no shared oscillator — clicking 8 slots in 100 ms produces 8 fully overlapping voices. This is the core anti-choke directive.
- Returns a small `{ id, endsAt }` handle so the UI can time the ripple animation to the release tail.

## 4. Visual feedback

On click, the slot toggles an `.is-ringing` class for ~600 ms (Tailwind `animate-ping` clone on an absolutely-positioned ring + brightness bump on the disc). Independent per slot — mashing works because each ripple is keyed on a monotonic counter, not a shared boolean.

## 5. Engine integration (`progression.ts` + `composer.ts`)

Extend `ActiveScale` with an optional `pitches?: string[]`. When present:

- `composer.ts` no longer calls `degreeToFreq(root, intervals, degree, octave)` for that scale. Instead it maps `pickToneForStep()` output (a pool index) directly to `pitches[index % pitches.length]` and converts to frequency via `pitchToFreq(pitchName)`.
- Root key + octave-low/high per slot become **no-ops** for pitch-driven scales — the pitches are already absolute. UI in the Composer will note this ("Pitches from scale; root/octave ignored") but no visual overhaul this pass.
- Scales with only `intervals[]` (legacy) continue to work unchanged.

The published-scales fetch (`fetchPublishedScales` + `listAdminScales`) is extended to select the new `pitches` column and propagate it into `ActiveScale`.

## Technical notes

- New file `src/lib/music/pitch.ts`: `pitchToMidi()`, `midiToPitch()`, `pitchToFreq()` — accepts `C`, `C#`, `Db`, `Bb`, etc. Single source of truth.
- Migration adds `pitches text[]` with default `NULL`; no data backfill.
- `SAMPLE_ROOT_HZ = 440` for the default handpan sample (adjust after picking the sample). Preview never touches the live engine's `AudioContext`.
- All new server-fn changes go through the existing passcode gate — no new auth surface.

## Files touched

- **New:** `supabase` migration (add `pitches` column), `src/lib/music/pitch.ts`, `src/lib/studio/handpanAudio.ts`.
- **Edited:** `src/routes/studio.scales.tsx` (Handpan UI), `src/lib/admin/scales.functions.ts` (read/write `pitches`), `src/lib/music/scales.functions.ts` (select `pitches`), `src/lib/music/progression.ts` (add `pitches?`), `src/lib/music/composer.ts` (pitch-aware path).

## Polyphony contract (confirmed)

Every click = **new `AudioBufferSourceNode` + new `GainNode`** with its own envelope, connected to a shared master. No shared source, no `stop()` on prior voices, no note-stealing. This is the Web Audio idiom for polyphonic sample playback and guarantees 4+ rapid clicks all ring out fully.
