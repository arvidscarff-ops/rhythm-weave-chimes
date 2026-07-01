## Goal
Color-code each note in the Handpan tone field using the "Boldest Co." palette from the reference, so notes are visually distinct at a glance.

## Approach

**1. Add palette tokens to `src/styles.css`**
Introduce the 12 palette colors as CSS variables (HSL) so notes map to design tokens, not hardcoded hex:
- `--note-oat` #EBDCC7, `--note-cream` #EBDEA6, `--note-sage` #BBC5AB, `--note-peach` #F09E7D, `--note-honey` #F8991D, `--note-spicy` #FC4024, `--note-femme` #EF4782, `--note-dessert` #8552A0, `--note-butch` #9F8D32, `--note-basil` #00784F, `--note-proud` #00859C, `--note-pine` #004242

**2. Map pitch class → color (12 tones → 12 palette slots)**
Deterministic mapping by pitch class (C..B) so the same note always gets the same color regardless of octave or slot position:
```
C→Spicy   C#→Femme   D→Honey   D#→Dessert
E→Cream   F→Peach    F#→Proud  G→Basil
G#→Butch  A→Sage     A#→Pine   B→Oat
```
New helper `src/lib/music/noteColors.ts` exporting `noteColor(pitch)` returning the CSS variable name + a readable label.

**3. Apply color in `HandpanField` (`src/routes/studio.scales.tsx`)**
- Tint each note disc with its color: a soft radial gradient using the note's color (low alpha for fill, higher alpha for the rim), keeping the current dark handpan look.
- The center "ding" uses its own note's color (replaces the amber-only styling); the ring notes each get their color.
- Ring/glow on strike pulses in the note's color instead of the current amber.
- Small color chip appears next to each dropdown selector so the mapping is legible even before striking.
- The `SelectValue` label stays monospaced white for readability against the tinted disc.

**4. No changes to audio, data model, or progression editor.** Chord/Accent tone pickers stay emerald/amber (they refer to slot indices, not pitches).

## Files touched
- `src/styles.css` — add 12 note color tokens
- `src/lib/music/noteColors.ts` — new, pitch-class → token mapping
- `src/routes/studio.scales.tsx` — thread `noteColor()` into `HandpanField` disc styling and strike glow

## Out of scope
- Recoloring the progression timeline or other Studio surfaces
- Letting the admin re-assign colors per note (fixed mapping for now)
