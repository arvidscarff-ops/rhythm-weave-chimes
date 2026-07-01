/**
 * Scientific pitch notation helpers.
 * Accepts sharps (C#) and flats (Db, Bb). A4 = 69 → 440 Hz.
 */

const NAME_TO_SEMI: Record<string, number> = {
  C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8,
  A: 9, "A#": 10, Bb: 10, B: 11, Cb: 11, "B#": 0,
};

const SHARP_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"] as const;

export function pitchToMidi(pitch: string): number {
  const m = /^([A-Ga-g])([#b]?)(-?\d+)$/.exec(pitch.trim());
  if (!m) throw new Error(`Invalid pitch: ${pitch}`);
  const letter = m[1].toUpperCase();
  const accidental = m[2];
  const octave = parseInt(m[3], 10);
  const key = letter + accidental;
  const semi = NAME_TO_SEMI[key];
  if (semi === undefined) throw new Error(`Invalid pitch: ${pitch}`);
  return (octave + 1) * 12 + semi;
}

export function midiToPitch(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const semi = ((midi % 12) + 12) % 12;
  return `${SHARP_NAMES[semi]}${octave}`;
}

export function pitchToFreq(pitch: string): number {
  const midi = pitchToMidi(pitch);
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** All pitches from C1..C7 for dropdown menus (sharps preferred). */
export function allPitchOptions(low = "C1", high = "C7"): string[] {
  const lo = pitchToMidi(low);
  const hi = pitchToMidi(high);
  const out: string[] = [];
  for (let m = lo; m <= hi; m++) out.push(midiToPitch(m));
  return out;
}

export const DEFAULT_PITCH = "A3";