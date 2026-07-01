## Strummer feature — Handpan Tone Field

Add a small, tactile strummer bar directly beneath the Handpan disc, above the "Tap to cycle" caption. Two controls, one purpose: hear the whole scale fast.

### Layout

```text
┌──────────────────────────────────────────────────────────┐
│  ● ─────────────────●───────────────────  [▶ Strum all] │
│  B2  F#3  G3  B3  D4  E4  F#4  A4        (auto button)  │
└──────────────────────────────────────────────────────────┘
```

- Full-width glass strip, ~64px tall, sitting between the pan and the "Tap to cycle" hint.
- Left ~80%: the **manual strum bar**. Right ~20%: the **auto-strum button**.

### Manual strum bar

- 9 vertical tick marks (one per note), spaced evenly low→high left-to-right. Each tick is colored with its `noteColor()` chip and labeled underneath (`B2`, `F#3`…).
- A glowing **plectrum bead** (12px teal disc, soft outer glow) sits on the bar. Drag it horizontally with pointer events (`setPointerCapture` on the bar). Also draggable by clicking anywhere on the bar and sweeping — the bead jumps to the pointer.
- As the bead **crosses** a tick (moves past its x-position in either direction), fire `playPitch(pitches[i])` exactly once for that crossing. Track the last tick index; only fire when the current index changes. This gives a perfectly linear harp-strum feel — fast sweep = fast roll, slow drag = individual notes.
- The tick that just fired pulses briefly (150ms scale + glow) so the strum is visible as well as audible. The corresponding disc on the pan above also flashes (reuse a lightweight ring pulse on the matching `HandpanField` slot).
- Release the pointer → bead stays where it landed. Double-click the bar → bead resets to the far left.

### Auto-strum button

- Rounded pill button with a "sweep" icon (custom svg: three ascending bars + arrow) and label **"Strum all"**. Sits at the right of the strip.
- On click: sort the current 9 pitches **low → high** (via `pitchToMidi`), then fire them 60ms apart using `setTimeout` chained through the sorted list. Same visual pulse on each tick + pan disc as the manual strum.
- Button becomes disabled + shows a subtle progress fill (teal bar sweeping left→right across the button background) for the ~540ms duration, then re-enables. Prevents overlap-spam.
- Also plays the animation on the manual strum bar's bead — it glides left→right in sync with the auto sweep, reinforcing what the control does.

### Sort + note order

- Sort by MIDI ascending. Ties (unlikely) keep original slot order. The bar labels always reflect the sorted order, so the leftmost tick = lowest pitch on the pan, regardless of physical slot position. This is intentional — the strummer is a **listening tool**, not a slot inspector; the pan itself already shows physical layout.
- When the admin changes a note in the pan (via the Select or `-/+`), the strum bar rebuilds its ticks in the new sort order on the next render.

### State / integration

- New component `StrumBar` inside `src/routes/studio.scales.tsx` (co-located; small enough not to warrant its own file). Props: `pitches: string[]`, `onStrike?: (slotIndex: number) => void`.
- `onStrike` bubbles to `ScaleEditor`, which triggers the existing pan-disc pulse (add a `flashSlot` ref/state on `HandpanField`, keyed by `slotIndex` + timestamp so repeat strikes re-fire the animation).
- Audio uses the existing `playPitch` from `@/lib/studio/handpanAudio` — the polyphonic anti-choke path already handles overlapping strums.
- No schema changes, no server-fn changes, no changes to the composer/progression, no changes to the filmstrip.

### Visual polish

- Bar background: `bg-white/5 backdrop-blur` + inner border `border-white/10`, matching the existing filmstrip glass.
- Tick baseline: 1px `bg-white/15` horizontal rule through the middle.
- Bead: teal radial gradient (`oklch(0.78 0.16 195)`) with `filter: drop-shadow(0 0 8px …)`, `cursor-grab` → `cursor-grabbing` on drag.
- Auto button: same glass surface, teal ring on hover, teal glow while sweeping.
- Ding (slot 0) is included in the strum just like a ring note.

### Out of scope

- No MIDI export, no recording, no tempo-synced strum (fixed 60ms as agreed).
- No changes to the 3-state chord/accent toggle or filmstrip resize handles.
- No changes to composer or runtime audio engine.
