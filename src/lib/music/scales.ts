/**
 * Root-key helpers + degree→frequency conversion for the Composer.
 *
 * Scales are no longer a fixed union — they live in Cloud as admin-authored
 * `custom_scales` rows and are exposed through `progression.ts`. This module
 * only owns the root-key vocabulary and equal-tempered pitch math.
 */

export const ROOT_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
export type RootName = (typeof ROOT_NAMES)[number];

/** Convention: A4 = 69 → 440 Hz. */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Resolve a scale-pool degree (integer index into `intervals`, may exceed
 * length — wraps and adds octaves) against a root key into a midi note.
 */
export function degreeToMidi(
  root: RootName,
  intervals: number[],
  degree: number,
  octave: number,
): number {
  const len = Math.max(1, intervals.length);
  const rootSemi = ROOT_NAMES.indexOf(root);
  const octOffset = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return (octave + 1) * 12 + rootSemi + intervals[idx] + octOffset * 12;
}

export function degreeToFreq(
  root: RootName,
  intervals: number[],
  degree: number,
  octave: number,
): number {
  return midiToFreq(degreeToMidi(root, intervals, degree, octave));
}