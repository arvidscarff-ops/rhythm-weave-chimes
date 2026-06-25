/**
 * Scale tables + scale-degree → frequency conversion for the Composer.
 * Frequencies are equal-tempered, A4 = 440 Hz.
 */

export type ScaleId =
  | "major"
  | "minor"
  | "dorian"
  | "mixolydian"
  | "pentaMaj"
  | "pentaMin"
  | "blues"
  | "hirajoshi"
  | "phrygianDom"
  | "wholeTone"
  | "chromatic";

export const SCALES: Record<ScaleId, { label: string; intervals: number[] }> = {
  pentaMin:    { label: "Pentatonic Min", intervals: [0, 3, 5, 7, 10] },
  pentaMaj:    { label: "Pentatonic Maj", intervals: [0, 2, 4, 7, 9] },
  minor:       { label: "Minor",          intervals: [0, 2, 3, 5, 7, 8, 10] },
  major:       { label: "Major",          intervals: [0, 2, 4, 5, 7, 9, 11] },
  dorian:      { label: "Dorian",         intervals: [0, 2, 3, 5, 7, 9, 10] },
  mixolydian:  { label: "Mixolydian",     intervals: [0, 2, 4, 5, 7, 9, 10] },
  blues:       { label: "Blues",          intervals: [0, 3, 5, 6, 7, 10] },
  hirajoshi:   { label: "Hirajoshi",      intervals: [0, 2, 3, 7, 8] },
  phrygianDom: { label: "Phrygian Dom",   intervals: [0, 1, 4, 5, 7, 8, 10] },
  wholeTone:   { label: "Whole Tone",     intervals: [0, 2, 4, 6, 8, 10] },
  chromatic:   { label: "Chromatic",      intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
};

export const ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type RootName = (typeof ROOT_NAMES)[number];

/** Midi pitch for root C0 = 12. Convention: A4 = 69 → 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Resolve scale degree to a midi note within [octaveLow, octaveHigh].
 * degree may exceed scale length — wraps and adds octaves.
 */
export function degreeToMidi(
  root: RootName,
  scale: ScaleId,
  degree: number,
  octave: number,
): number {
  const ivs = SCALES[scale].intervals;
  const rootSemi = ROOT_NAMES.indexOf(root); // 0..11
  // wrap degree across octaves
  const len = ivs.length;
  const octOffset = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  // midi: (octave + 1) * 12 + rootSemi + interval (so root C4 = 60)
  return (octave + 1) * 12 + rootSemi + ivs[idx] + octOffset * 12;
}

export function degreeToFreq(
  root: RootName,
  scale: ScaleId,
  degree: number,
  octave: number,
): number {
  return midiToFreq(degreeToMidi(root, scale, degree, octave));
}