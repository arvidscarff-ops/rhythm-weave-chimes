# Generative Composer

Turn each ring from "random pulse on intersection" into a musical voice that plays **in-key notes** following a **Euclidean rhythm pattern**. The polyrhythmic phasing stays exactly as it is — we just decide *which* trigger crossings actually fire, and *which note* they play.

## What you'll get in the UI

A new **Composer** entry in the dock (or nested under Scene → ring config) with, per ring:

- **Scale** dropdown — Major, Minor, Dorian, Mixolydian, Pentatonic Maj/Min, Blues, Hirajoshi (Japanese), Phrygian Dominant, Whole Tone, Chromatic.
- **Root note** — C through B.
- **Octave range** — low/high bounds (e.g. C3–C5) the ring picks from.
- **Pattern (Euclidean)** — two numbers `E(k, n)`: *k* hits spread as evenly as possible across *n* steps. Classic example: `E(3,8)` = the tresillo. A small dot-grid preview shows the pattern.
- **Rotation** — shift the pattern's starting step (0…n-1) so two rings with the same pattern can interlock.
- **Note mode** — Sequential (walk up the scale), Random-in-scale, Arpeggio (1-3-5), or Brownian (small steps).

A **global Key/Scale lock** at the top lets all rings inherit one key with one click.

## How it changes playback

Today a ring fires every time its rotation crosses a trigger line. With the composer:

1. Each ring keeps an internal **step counter** that advances on every crossing.
2. The Euclidean pattern decides whether that step is a **hit** or a **rest**.
3. On a hit, the note picker (sequential/random/arp/brownian) chooses the next scale degree and converts it to a frequency for the existing synth voice.

Result: rings stop sounding like atonal pings and start sounding like interlocking melodic phrases that phase against each other — exactly the appeal of polyrhythmic music (Reich, Aphex, generative ambient).

## Defaults that sound good immediately

- Global key: **A minor pentatonic**
- Ring 1: `E(3,8)` sequential, octave 3-4
- Ring 2: `E(5,8)` random-in-scale, octave 4-5, rotation 2
- Ring 3: `E(2,5)` arpeggio, octave 2-3

So a brand-new session sounds musical without touching anything.

## Technical sketch (for the curious)

- New `src/lib/music/scales.ts` — scale interval tables + `degreeToFreq(root, scale, degree, octave)`.
- New `src/lib/music/euclidean.ts` — Bjorklund's algorithm returning a `boolean[]` of length *n*.
- New `src/lib/music/composer.ts` — per-ring state `{ step, pattern, noteCursor }` with an `advance()` that returns `{ play: boolean, freq?: number }`.
- Extend the existing ring config type with `{ scale, root, octaveLow, octaveHigh, euclid: {k,n,rotation}, noteMode }`; persisted alongside current ring settings.
- In the trigger handler in `src/routes/index.tsx`, call `composer.advance(ringId)` instead of unconditionally firing; pass the returned freq into the existing pack voice function (packs keep working unchanged — they're just told *what pitch* now).
- Dock: new `ComposerMenu` using the same `material-ui-dropdown-menu` drill-down pattern as `FxMenu`, plus a tiny canvas dot-grid for the Euclidean preview.

No audio engine rewrite, no schema changes, no new dependencies.

## Out of scope (can come next)

- Saving/sharing composer presets via URL hash (pairs naturally with option 3 from earlier).
- Chord rings (multiple notes per hit).
- Swing / humanization.
