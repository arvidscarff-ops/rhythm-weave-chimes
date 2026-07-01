## Note palette refresh + register elevation cue

Two coordinated changes to make register instantly readable while keeping pitch-class color meaningful.

### 1. New "Aurora Spectrum" palette (12 hues)

Replace the existing Boldest Co. tokens in `src/styles.css` and `src/lib/music/noteColors.ts` with a bright, chromatic set that reads well on the dark studio background. Each pitch class gets its own hue; the sequence walks the color wheel so a chromatic run looks like a rainbow and enharmonic pairs share a hue.

| Pitch | Name       | Hex      |
|-------|------------|----------|
| C     | Teal       | #5eead4  |
| C#/Db | Cyan       | #38bdf8  |
| D     | Sky        | #60a5fa  |
| D#/Eb | Indigo     | #818cf8  |
| E     | Violet     | #a78bfa  |
| F     | Magenta    | #e879f9  |
| F#/Gb | Pink       | #f472b6  |
| G     | Rose       | #fb7185  |
| G#/Ab | Amber      | #fbbf24  |
| A     | Gold       | #facc15  |
| A#/Bb | Lime       | #a3e635  |
| B     | Emerald    | #34d399  |

- Token names: `--note-c, --note-cs, --note-d, --note-ds, --note-e, --note-f, --note-fs, --note-g, --note-gs, --note-a, --note-as, --note-b`. Rename cleanly and drop the old `--note-oat/cream/sage/...` tokens (only used by `noteColors.ts`, verified).
- Update `CLASS_TO_TOKEN` in `noteColors.ts` to the new mapping. `NoteColor.name` becomes the color name from the table (used only in tooltips).

### 2. Register: bass / mid / high via elevation

New helper `src/lib/music/register.ts`:

```ts
export type Register = "bass" | "mid" | "high";
// Bass < C3 (midi < 48), Mid C3–B4 (48–71), High ≥ C5 (midi ≥ 72)
export function pitchRegister(pitch: string): Register { ... }
```

**Handpan disc styling** (`HandpanField` in `src/routes/studio.scales.tsx`) — sizes and shadows scale by register, keeping the ding always slightly larger than a same-register ring slot:

- Bass:  ring 104 px / ding 124 px. Shadow `0 12px 28px rgba(0,0,0,0.55)` + inner top-highlight. Feels grounded.
- Mid:   ring  88 px / ding 108 px. Current shadow (`0 6px 18px rgba(0,0,0,0.35)`). The reference size.
- High:  ring  72 px / ding  92 px. Softer shadow `0 3px 10px rgba(0,0,0,0.25)` + a faint `translateY(-2px)` lift so it visually floats. Font size trims from `text-lg` → `text-base` so labels stay proportional.

The teal/violet chord/accent glows still override the shadow when a step is active — register elevation shows through as size only, so tone-state remains unambiguous.

**Strum-bar ticks** (`StrumBar`) — tick dot radius follows the same tier so the strip reinforces the pan: bass = 12 px, mid = 8 px, high = 5 px. Same colors as before, just sized. Bead stays 14 px.

**Filmstrip / anywhere else** — no changes; register is a property of the tone field only.

### 3. Tiny UX polish that falls out for free

- Tooltip on each disc now reads `A4 · Gold · High` (pitch · color name · register).
- Labels under the pitch selects stay one line by using `text-[10px]` regardless of register.

### Out of scope

- No schema/DB changes. Palette and register are pure client-side derivations from the existing `pitches` array.
- No changes to composer/audio/progression/filmstrip logic.
- No new dependencies.

### Files touched

- `src/styles.css` — swap 12 CSS variables.
- `src/lib/music/noteColors.ts` — new pitch-class → token map + names.
- `src/lib/music/register.ts` — new file, ~15 lines.
- `src/routes/studio.scales.tsx` — `HandpanField` slot sizing/shadow by register; `StrumBar` tick sizing by register; tooltip text.
