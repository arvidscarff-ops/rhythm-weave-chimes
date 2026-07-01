## Per-step strum in the filmstrip

Add a small strum button to each step block in the chord-progression filmstrip so the user can audition any step's assigned notes without having to select it, plus a "play all" that walks through every step back-to-back.

### Per-step strum button

- Add a compact play/strum icon-button in the top-right of every `FilmstripBlock` (next to the trash icon area, always visible — not hover-only).
- Clicking it:
  - Calls `primeAudio()` once.
  - Collects that step's assigned tones = union of `step.chord_tones` and `step.accent_tones`, mapped to their pitches via the scale, sorted low-to-high by MIDI (same logic used in `StrumBar`'s `sorted`).
  - Fires `playPitch(pitch)` for each tone spaced by `STRUM_STEP_MS` (60ms), matching the handpan strum feel.
  - Does not change `activeStepId` — the user keeps editing the current step while previewing others.
  - `e.stopPropagation()` so the click doesn't also select the step.
- Visual feedback: a subtle teal sweep line inside the block during playback (reuses the existing `strumFill` keyframe, duration = `tones * STRUM_STEP_MS`), plus a brief press state on the button. Disable the button while its own sweep is running.
- If the step has zero assigned tones, render the button in a dimmed disabled state with tooltip "No chord/accent notes yet".

### Play-all-steps button

- Add a "Play all" button next to the existing "Add step" button in the filmstrip toolbar row.
- Sequentially strums each step in `step_order`. Between steps, wait `stepTones * STRUM_STEP_MS + 200ms` gap so the ear can separate them. Not tempo/bar-aware — this is a working preview, not a full playback engine.
- While running, the button becomes "Stop" and cancels all pending timeouts on click. Steps light up their sweep line as they play (drive by passing an `isPlaying` prop into the currently-playing block, or a shared `playingStepId` state in `Filmstrip`).

### Technical notes

- New helper inside `studio.scales.tsx`:
  ```ts
  function stepPitchesSorted(step, pitches): string[]
  ```
  returning the union of `chord_tones` + `accent_tones` resolved to pitches, sorted by `pitchToMidi` ascending, with a graceful fallback for unparsable pitches.
- Lift audio calls into `Filmstrip`: pass `pitches: string[]` and `onStrikePitch: (pitch: string) => void` props down from the parent (same `primeAudio` + `playPitch` used by the main `StrumBar`). `FilmstripBlock` owns its own timer refs and clears them on unmount.
- No changes to data model, server functions, or persisted state — this is playback-only.
- Files touched: `src/routes/studio.scales.tsx` only.

### Out of scope

- Tempo-aware or bars-aware playback, metronome sync, chord/accent volume differentiation, MIDI export, or a full progression sequencer. Just an ergonomic audition button.