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
  room: { delay: 0.18, feedback: 0.18 },
  hall: { delay: 0.55, feedback: 0.28 },
  plate: { delay: 0.32, feedback: 0.32 },
  cosmic: { delay: 1.10, feedback: 0.38 },
};

export const CHORUS_PRESETS: Record<ChorusType, { rate: number; depth: number }> = {
  subtle: { rate: 0.35, depth: 0.003 },
  wide: { rate: 0.70, depth: 0.006 },
  swirl: { rate: 1.60, depth: 0.009 },
};

export const GRAIN_PRESETS: Record<GrainType, { delay: number; feedback: number }> = {
  dust: { delay: 0.04, feedback: 0.08 },
  stutter: { delay: 0.12, feedback: 0.22 },
  shimmer: { delay: 0.22, feedback: 0.28 },
};

export const TONE_PRESETS: Record<ToneType, { cutoff: number; tilt: number }> = {
  dark: { cutoff: 900, tilt: -6 },
  warm: { cutoff: 2400, tilt: 0 },
  air: { cutoff: 7000, tilt: 5 },
};

export const DEFAULT_FX_STATE: FxState = {
  reverb: { type: "hall", mix: 0.18, size: 0.55, bypass: false },
  chorus: { type: "subtle", mix: 0.08, rate: 0.35, bypass: false },
  grain: { type: "dust", mix: 0.0, density: 0.5, bypass: true },
  tone: { type: "warm", cutoff: 2400, tilt: 0, bypass: false },
};

// Minimal structural shape we touch — keeps fxState decoupled from full AudioGraph type.
type FxNodes = {
  ctx: AudioContext;
  filter: BiquadFilterNode;
  chorusRate: AudioParam;          // primary LFO frequency
  _chorusRateB: AudioParam;        // quadrature LFO frequency
  _chorusDepthA: GainNode;
  _chorusDepthB: GainNode;
  chorusMix: GainNode;
  delayL: DelayNode;
  delayR: DelayNode;
  delayFeedback: GainNode;
  wet: GainNode;                   // ping-pong wet level
  reverbWet: GainNode;             // convolution reverb wet level
  _reverbDamp: BiquadFilterNode;
  _reverbPredelay: DelayNode;
  irSeconds: number;
  grainDelay?: DelayNode;
  grainFeedback?: GainNode;
  grainMix?: GainNode;
  shelf?: BiquadFilterNode;
};

export function applyFxState(a: FxNodes, s: FxState) {
  const t = a.ctx.currentTime;
  const R = 0.04;

  // Reverb (convolution) — type changes damping + predelay character.
  const rv = REVERB_PRESETS[s.reverb.type];
  // size 0.05..1.2  →  predelay 5..120ms + damping cutoff
  a._reverbPredelay.delayTime.setTargetAtTime(Math.min(0.2, s.reverb.size * 0.18), t, R);
  const dampMap: Record<string, number> = { room: 4200, hall: 5200, plate: 6800, cosmic: 8200 };
  a._reverbDamp.frequency.setTargetAtTime(dampMap[s.reverb.type] ?? 5200, t, R);
  a.reverbWet.gain.setTargetAtTime(s.reverb.bypass ? 0 : s.reverb.mix * 0.55, t, R);

  // Ping-pong delay tracks reverb size/preset for cohesive space.
  a.delayL.delayTime.setTargetAtTime(s.reverb.size * (rv.delay / 0.55), t, R);
  a.delayR.delayTime.setTargetAtTime(s.reverb.size * (rv.delay / 0.55) * 1.5, t, R);
  a.delayFeedback.gain.setTargetAtTime(rv.feedback, t, R);
  a.wet.gain.setTargetAtTime(s.reverb.bypass ? 0 : s.reverb.mix * 0.30, t, R);

  // Stereo chorus
  const cp = CHORUS_PRESETS[s.chorus.type];
  a.chorusRate.setTargetAtTime(s.chorus.rate, t, R);
  a._chorusRateB.setTargetAtTime(s.chorus.rate * 0.93, t, R); // slight detune for width
  a._chorusDepthA.gain.setTargetAtTime(cp.depth, t, R);
  a._chorusDepthB.gain.setTargetAtTime(cp.depth * 1.15, t, R);
  a.chorusMix.gain.setTargetAtTime(s.chorus.bypass ? 0 : s.chorus.mix * 0.55, t, R);

  // Grain
  if (a.grainDelay && a.grainFeedback && a.grainMix) {
    const gp = GRAIN_PRESETS[s.grain.type];
    const scale = 0.5 + s.grain.density; // 0.5..1.5
    a.grainDelay.delayTime.setTargetAtTime(Math.min(0.39, gp.delay * scale), t, R);
    a.grainFeedback.gain.setTargetAtTime(Math.min(0.35, gp.feedback * scale), t, R);
    a.grainMix.gain.setTargetAtTime(s.grain.bypass ? 0 : s.grain.mix * 0.35, t, R);
  }

  // Tone
  a.filter.frequency.setTargetAtTime(s.tone.cutoff, t, R);
  if (a.shelf) {
    a.shelf.gain.setTargetAtTime(s.tone.bypass ? 0 : s.tone.tilt, t, R);
  }
}