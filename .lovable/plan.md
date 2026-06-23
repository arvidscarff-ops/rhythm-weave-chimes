
# Plan — "Wheel" scene (new primary mode)

## 1. Scene reshuffle

- `scene` dropdown order becomes: **wheel** (default), polygon, sine, lissajous.
- App boots in Wheel mode. The others stay as decorative visualizers (no editing) so nothing is lost.
- A new per-scene state object is added so Wheel state (rings, lines, notes) is independent from the polygon-engine state. The polygon scheduler keeps running only when a non-Wheel scene is selected.

## 2. Wheel data model

```text
project: { bpm: number, swing?: never }   // bpm = master tempo
ring: {
  id, radius (px or % of canvas),
  beats: number,           // beats per full rotation (numerator)
  subdivision: number,     // denominator (e.g. 4 in 4/4) — divides a "beat" into smaller pulses; together they define rotation seconds = (beats/subdivision) * (60/bpm) * 4
  direction: 'cw' | 'ccw',
  phase: number,           // current rotation angle (radians), advanced every frame
  color: string,
  notes: [{ id, angle (rad, fixed on the ring), pitchSemis, voice }],
}
line: { id, angle (rad), length: 'full'|'half', color }   // a chord/diameter across the wheel center; trigger when a note crosses
```

Trigger detection: for each note, compute its world angle = `note.angle + ring.phase * (direction === 'cw' ? 1 : -1)`. Between frames, check if it crossed any line's angle (handle wrap-around). On a crossing, schedule the note via the existing audio engine (`playVoice`) at `audioCtx.currentTime` (the visual frame time, close enough — for tighter sync we sample-accurately schedule using the angular velocity to estimate exact crossing time within the frame).

## 3. Rhythm format → ring period

`bpm` is global. A ring with notation `N/D` rotates once every `(N / D) * 4` beats — i.e. 4/4 = 4 beats per rotation, 3/4 = 3 beats, 11/13 = 11 * 4/13 ≈ 3.385 beats. Period in seconds = `beats_per_rotation * 60 / bpm`. This gives the "11/13" phasing feel against, say, a 4/4 ring at the same BPM.

Direction (cw/ccw) is a per-ring toggle.

## 4. Canvas interaction (Wheel mode only)

- **Add ring:** "+ ring" button → new ring appears at next free radius (cycles through 25/40/55/70/85% of canvas min-dim). Default 4/4 cw.
- **Remove ring:** "×" on the ring's inline label.
- **Add note:** click on an empty arc of a ring (within ~10 px tolerance) → a note dot appears at that angle. Pitch defaults to a pentatonic degree based on radial position (outer = lower, inner = higher) but is overridable in the inline control popup.
- **Remove note:** click an existing note (within ~10 px) → removes it.
- **Add line:** "+ line" button → new line appears at the next of 0°, 90°, 180°, 270°. Each line is a diameter through the center; drag its end handle (small disk on the rim) to rotate it.
- **Remove line:** "×" on the line's handle.
- **Per-ring inline panel:** small floating chip near each ring's label showing `N / D`, direction arrow, voice (melo/bass/atmo), color swatch, ×. Click `N / D` to type a fraction; arrow toggles direction; voice cycles through the existing voice list.

Selection is implicit (hover → reveal controls). No modal inspector.

## 5. New global controls

- **Bottom dock:** slim transport bar with a long BPM slider (40–220), a current-BPM readout, and play/pause mirrored from the top.
- Top header keeps the existing knob row but `speed` and `multiply` are hidden in Wheel mode (they belong to the polygon engine). They reappear when scene = polygon/sine/lissajous.
- The `melo/bass/atmo` voice dropdowns still drive note voice (each note inherits its ring's voice slot).

## 6. Visual design (matches the synth-hardware feel already established)

- Concentric rings: faint stroke when idle, glow when a note on it just fired.
- Notes: small neon dots colored by ring voice; pulse + emit particles when crossed by a line.
- Lines: thin neon chords across the wheel; flash at the crossing point on trigger.
- Outer ring labels (small monospace) sit on the right edge of each ring: `4/4 ▸  melo  ×`. Mouseover brightens; otherwise dimmed.
- Wordmark stays low-opacity in the background.
- Particles + glow reuse the existing particle pool.

## 7. Audio path

No changes to the audio graph. Wheel triggers call the same `playVoice(ctx, preFx, voice, freq, fx2, time)` so the FX bus and existing knobs (rev-mix, rev-size, fx-1, fx-2, main-vol, pitch) Just Work.

## 8. Build order (each step ships something working)

1. Scene reshuffle: add `'wheel'` to scene list, render an empty wheel canvas, bottom BPM slider wired (just stored). Hide speed/multiply knobs when in Wheel.
2. Ring model + rendering + spin loop. Default seed: one 4/4 ring with a few preset notes so play makes sound immediately.
3. Line model + trigger detection + audio firing.
4. Click-to-add/remove notes; +ring / ×ring controls.
5. +line / ×line controls; drag line angle.
6. Inline per-ring chip (notation editor, direction, voice, color, ×).
7. Polish: glow on crossing, particles at crossing point, line flash, easing on ring fade-in/out.

## Technical notes

- All Wheel state in a single `useRef` store (no per-frame React renders); a `bump` state forces a re-render only when topology changes (add/remove ring/line/note) so DOM overlays (chips, line handles) stay in sync. Spin/triggers run purely on the RAF loop.
- Crossing detection uses signed angular delta from previous frame, normalized to `(-π, π]`, accounting for cw/ccw. To avoid double-fires on near-stationary rings at high frame rates, store last-fire time per (note, line) pair with a 30 ms refractory window.
- The existing canvas keeps additive blending and dust background. Wheel layer draws before particles.
- DOM overlays (chips, line handles) are absolutely positioned divs over the canvas, computed from canvas-space → CSS-space using the cached `rect`.
- BPM clamp 40–220. Notation parser accepts `N/D` with N ∈ 1..32, D ∈ 1..32; invalid input reverts to previous value.

## Out of scope for this step (call out before building)

- Saving/loading wheel presets.
- Pitch editing UI (notes auto-assign by ring index; we can add a pitch picker in a follow-up).
- Swing / micro-timing.
- Multiple selected items / multi-edit.
