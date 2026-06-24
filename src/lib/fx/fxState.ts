export type ReverbType = "room" | "hall" | "plate" | "cosmic";
export type ChorusType = "subtle" | "wide" | "swirl";
export type GrainType = "dust" | "stutter" | "shimmer";
export type ToneType = "dark" | "warm" | "air";

export type FxState = {
  reverb: { type: ReverbType; mix: number; size: number; bypass: boolean };
  chorus: { type: ChorusType; mix: number; rate: number; bypass: boolean };
  grain: { type: GrainType; mix: number; density: number; bypass: boolean };
  tone: { type: ToneType; cutoff: number; tilt: number; bypass: boolean };
};

export const REVERB_PRESETS: Record<ReverbType, { delay: number; feedback: number }> = {
  room: { delay: 0.18, feedback: 0.28 },
  hall: { delay: 0.55, feedback: 0.42 },
  plate: { delay: 0.32, feedback: 0.5 },
  cosmic: { delay: 1.10, feedback: 0.58 },
};

export const CHORUS_PRESETS: Record<ChorusType, { rate: number; depth: number }> = {
  subtle: { rate: 0.35, depth: 0.003 },
  wide: { rate: 0.70, depth: 0.006 },
  swirl: { rate: 1.60, depth: 0.009 },
};

export const GRAIN_PRESETS: Record<GrainType, { delay: number; feedback: number }> = {
  dust: { delay: 0.04, feedback: 0.15 },
  stutter: { delay: 0.12, feedback: 0.4 },
  shimmer: { delay: 0.22, feedback: 0.5 },
};

export const TONE_PRESETS: Record<ToneType, { cutoff: number; tilt: number }> = {
  dark: { cutoff: 900, tilt: -6 },
  warm: { cutoff: 2400, tilt: 0 },
  air: { cutoff: 7000, tilt: 5 },
};

export const DEFAULT_FX_STATE: FxState = {
  reverb: { type: "hall", mix: 0.28, size: 0.55, bypass: false },
  chorus: { type: "subtle", mix: 0.18, rate: 0.35, bypass: false },
  grain: { type: "dust", mix: 0.0, density: 0.5, bypass: true },
  tone: { type: "warm", cutoff: 2400, tilt: 0, bypass: false },
};

// Minimal structural shape we touch — keeps fxState decoupled from full AudioGraph type.
type FxNodes = {
  ctx: AudioContext;
  filter: BiquadFilterNode;
  chorusLFO: OscillatorNode;
  chorusLFOGain: GainNode;
  chorusMix: GainNode;
  delay: DelayNode;
  feedback: GainNode;
  wet: GainNode;
  grainDelay?: DelayNode;
  grainFeedback?: GainNode;
  grainMix?: GainNode;
  shelf?: BiquadFilterNode;
};

export function applyFxState(a: FxNodes, s: FxState) {
  const t = a.ctx.currentTime;
  const R = 0.04;

  // Reverb
  const rv = REVERB_PRESETS[s.reverb.type];
  a.delay.delayTime.setTargetAtTime(s.reverb.size * (rv.delay / 0.55), t, R);
  a.feedback.gain.setTargetAtTime(rv.feedback, t, R);
  a.wet.gain.setTargetAtTime(s.reverb.bypass ? 0 : s.reverb.mix, t, R);

  // Chorus
  const cp = CHORUS_PRESETS[s.chorus.type];
  a.chorusLFO.frequency.setTargetAtTime(s.chorus.rate, t, R);
  a.chorusLFOGain.gain.setTargetAtTime(cp.depth, t, R);
  a.chorusMix.gain.setTargetAtTime(s.chorus.bypass ? 0 : s.chorus.mix, t, R);

  // Grain
  if (a.grainDelay && a.grainFeedback && a.grainMix) {
    const gp = GRAIN_PRESETS[s.grain.type];
    const scale = 0.5 + s.grain.density; // 0.5..1.5
    a.grainDelay.delayTime.setTargetAtTime(Math.min(0.39, gp.delay * scale), t, R);
    a.grainFeedback.gain.setTargetAtTime(Math.min(0.92, gp.feedback * scale), t, R);
    a.grainMix.gain.setTargetAtTime(s.grain.bypass ? 0 : s.grain.mix, t, R);
  }

  // Tone
  a.filter.frequency.setTargetAtTime(s.tone.cutoff, t, R);
  if (a.shelf) {
    a.shelf.gain.setTargetAtTime(s.tone.bypass ? 0 : s.tone.tilt, t, R);
  }
}