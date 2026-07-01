## Confirmed

**3-state toggle cycle** on each Handpan note slot (for the currently active step):
`Off → Chord → Accent → Off` (repeat). Slot index `i` maps to a tone number in the step's arrays:
- Off: not present in either array
- Chord: present in `chord_tones`, absent from `accent_tones`
- Accent: present in `accent_tones`, absent from `chord_tones` (mutually exclusive so cycling is unambiguous)

Every click still fires `playPitch(pitches[i])` so the admin hears the chord assemble.

**Filmstrip layout:** horizontal scroll strip above the Handpan. Each block is a glass card whose *width* is derived from `duration_bars` (e.g. `72 + duration*36 px`, clamped 1–32). Active block gets a bright teal ring + glow; inactive blocks are dim glass. Trailing "+ Add step" tile calls `addProgressionStep`.

**Drag-to-resize handles:** each block has a 6px-wide vertical grabber on its left and right edges (`cursor-ew-resize`). On `pointerdown` I capture the pointer, record `startX` and `startDuration`, and on `pointermove` compute `next = clamp(round(startDuration + (dx / PX_PER_BAR) * sign), 1, 32)` where `sign` = +1 for the right handle and −1 for the left. The block's width updates live from local state so the drag feels physical. On `pointerup` (or if the value changed) I call `updateProgressionStep({ duration_bars })` once — no per-pixel network chatter. Pointer capture on the handle element keeps the drag alive even if the cursor leaves the block.

## Component changes (`src/routes/studio.scales.tsx`)

1. **Lift active-step state into `ScaleEditor`:** `const [activeStepId, setActiveStepId] = useState<string | null>(null)`; default to `scale.steps[0]?.id` (and reset when it disappears). Pass `activeStep` down to `HandpanField`.

2. **New `<Filmstrip>` component** — replaces the `ProgressionStepCard` grid.
   - Renders each step as a `FilmstripBlock` with: step number badge, "N BARS" label, small chord/accent count chips, trash icon on hover.
   - Active block: `ring-2 ring-teal-300/70` + outer glow via `boxShadow`.
   - "+ Add step" tile at the end, calls existing `addStepMut` and selects the new step on success.

3. **`FilmstripBlock`** — glass card, width driven by `duration_bars` (local optimistic state during drag), with left/right `<ResizeHandle>` children. Committing calls `updateProgressionStep({ duration_bars })` via the existing pattern.

4. **`HandpanField` — three-state mode.**
   - New optional props: `activeStep`, `onToggleTone(idx)`. When `activeStep` is provided, the ring buttons cycle Off→Chord→Accent instead of just striking.
   - Visual mapping per slot `i`:
     - Off: current dim disc, opacity 0.45, no fill glow.
     - Chord: solid teal fill (`--pr-melo` / teal-400 gradient) with strong inner light.
     - Accent: hollow disc with pulsing purple ring (`--pr-bass` / violet-400 outer glow, transparent fill).
   - Existing pitch color chip beside each Select stays so admins still see which note is which.
   - Ding (`i === 0`) participates in the cycle exactly like ring slots.
   - Audio: every cycle click calls `playPitch(pitches[i])` (unchanged zero-choke path).
   - Pitch selection (the Select dropdown) keeps its current strike-only behavior — it edits the scale pool, not the step arrays.

5. **Toggle handler in `ScaleEditor`:**
   ```
   const next = cycle(activeStep, i)  // Off→Chord→Accent→Off
   updateProgressionStep({ chord_tones, accent_tones })
   ```
   Uses optimistic local state on the active step so the disc flips instantly, then reconciles from the `invalidate()` refetch. `chord_tones` and `accent_tones` stay mutually exclusive.

6. **Remove the old `ProgressionStepCard` + `TonePicker`** (dead once the Filmstrip + Handpan handle everything). The per-step chord/accent arrays are now edited exclusively through the Handpan.

## Out of scope

- No schema / server-function changes — `updateProgressionStep` already accepts `chord_tones`, `accent_tones`, `duration_bars`.
- No audio engine changes.
- No changes to the composer / progression consumers — the data shape stays identical.

## Open question

Confirm the cycle order: **Off → Chord → Accent → Off**. If you'd prefer Off → Chord → Off with Accent toggled by shift-click (or a right-click), say so and I'll wire that instead.
