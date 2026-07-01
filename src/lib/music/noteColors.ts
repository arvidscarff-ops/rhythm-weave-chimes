/**
 * Pitch-class → palette color mapping (Boldest Co. palette).
 * Same note gets the same color regardless of octave.
 */

const PITCH_CLASS: Record<string, number> = {
  C: 0, "B#": 0,
  "C#": 1, Db: 1,
  D: 2,
  "D#": 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, "E#": 5,
  "F#": 6, Gb: 6,
  G: 7,
  "G#": 8, Ab: 8,
  A: 9,
  "A#": 10, Bb: 10,
  B: 11, Cb: 11,
};

const CLASS_TO_TOKEN: Record<number, { name: string; token: string }> = {
  0:  { name: "Spicy",   token: "--note-spicy" },
  1:  { name: "Femme",   token: "--note-femme" },
  2:  { name: "Honey",   token: "--note-honey" },
  3:  { name: "Dessert", token: "--note-dessert" },
  4:  { name: "Cream",   token: "--note-cream" },
  5:  { name: "Peach",   token: "--note-peach" },
  6:  { name: "Proud",   token: "--note-proud" },
  7:  { name: "Basil",   token: "--note-basil" },
  8:  { name: "Butch",   token: "--note-butch" },
  9:  { name: "Sage",    token: "--note-sage" },
  10: { name: "Pine",    token: "--note-pine" },
  11: { name: "Oat",     token: "--note-oat" },
};

export type NoteColor = { name: string; token: string; cssVar: string };

export function noteColor(pitch: string): NoteColor {
  const m = /^([A-Ga-g][#b]?)/.exec(pitch.trim());
  const key = m ? m[1][0].toUpperCase() + m[1].slice(1) : "C";
  const pc = PITCH_CLASS[key] ?? 0;
  const entry = CLASS_TO_TOKEN[pc];
  return { name: entry.name, token: entry.token, cssVar: `var(${entry.token})` };
}