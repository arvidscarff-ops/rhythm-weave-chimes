/**
 * Bass / mid / high register split for a pitch.
 * Bass < C3 (midi < 48), Mid C3–B4 (48–71), High >= C5 (midi >= 72).
 */
import { pitchToMidi } from "./pitch";

export type Register = "bass" | "mid" | "high";

export function pitchRegister(pitch: string): Register {
  let midi = 60;
  try {
    midi = pitchToMidi(pitch);
  } catch {
    /* fall through to mid */
  }
  if (midi < 48) return "bass";
  if (midi >= 72) return "high";
  return "mid";
}