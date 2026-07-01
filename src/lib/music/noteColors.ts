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
  0:  { name: "Teal",    token: "--note-c"  },
  1:  { name: "Cyan",    token: "--note-cs" },
  2:  { name: "Sky",     token: "--note-d"  },
  3:  { name: "Indigo",  token: "--note-ds" },
  4:  { name: "Violet",  token: "--note-e"  },
  5:  { name: "Magenta", token: "--note-f"  },
  6:  { name: "Pink",    token: "--note-fs" },
  7:  { name: "Rose",    token: "--note-g"  },
  8:  { name: "Amber",   token: "--note-gs" },
  9:  { name: "Gold",    token: "--note-a"  },
  10: { name: "Lime",    token: "--note-as" },
  11: { name: "Emerald", token: "--note-b"  },
};

export type NoteColor = { name: string; token: string; cssVar: string };

export function noteColor(pitch: string): NoteColor {
  const m = /^([A-Ga-g][#b]?)/.exec(pitch.trim());
  const key = m ? m[1][0].toUpperCase() + m[1].slice(1) : "C";
  const pc = PITCH_CLASS[key] ?? 0;
  const entry = CLASS_TO_TOKEN[pc];
  return { name: entry.name, token: entry.token, cssVar: `var(${entry.token})` };
}