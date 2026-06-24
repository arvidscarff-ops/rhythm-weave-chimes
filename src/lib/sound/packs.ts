/* ============================================================
 * Sound Packs — pure Web Audio voice presets (stereo, layered)
 * Each pack ships 6 voices, mapped to ring index (mod 6).
 * Phase 1 engine: per-voice layered partials, per-layer pan,
 * proper ADSR, Haas micro-delay widening, light vibrato.
 * ============================================================ */

export type PackId = "moss" | "prism" | "obsidian";

export type VoiceKindEx =
  | "chime"
  | "pluck"
  | "bell"
  | "pad"
  | "bass"
  | "fm"
  | "droplet"
  | "noiseHit"
  | "sub";

export type VoiceSpec = {
  id: string;
  name: string;
  kind: VoiceKindEx;
  params?: {
    ratio?: number;       // FM modulator ratio
    modIndex?: number;    // FM mod depth
    attack?: number;
    decay?: number;
    sustain?: number;     // 0..1 of peak
    release?: number;
    peak?: number;
    detune?: number;      // cents
    cutoff?: number;      // Hz
    q?: number;
    pitchDip?: number;    // semitones (for droplets/subs)
    partials?: number[];  // harmonic multipliers
    partialGains?: number[];
    octave?: number;      // global pitch shift (octaves)
    lfoRate?: number;
    lfoDepth?: number;
    width?: number;       // 0..1 stereo spread of layers
    vibrato?: number;     // Hz
    vibratoDepth?: number;// cents
    shimmer?: number;     // 0..1 add octave-up layer
  };
};

export type Pack = {
  id: PackId;
  name: string;
  blurb: string;
  voices: VoiceSpec[]; // length 6
};

export const PACKS: Record<PackId, Pack> = {
  moss: {
    id: "moss",
    name: "MOSS",
    blurb: "Ethereal · organic · wet",
    voices: [
      { id: "moss-1", name: "Glass Bell", kind: "bell",
        params: { partials: [1, 2.01, 3.0, 4.78, 6.12], partialGains: [0.32, 0.14, 0.08, 0.04, 0.02],
          attack: 0.004, decay: 0.6, sustain: 0.25, release: 4.2, peak: 0.14, detune: 7, width: 0.85,
          vibrato: 4.2, vibratoDepth: 3, shimmer: 0.18 } },
      { id: "moss-2", name: "Moss Pluck", kind: "pluck",
        params: { attack: 0.002, decay: 0.18, sustain: 0.45, release: 1.8, peak: 0.18,
          cutoff: 2400, q: 1.4, detune: 8, width: 0.75 } },
      { id: "moss-3", name: "Droplet", kind: "droplet",
        params: { attack: 0.001, decay: 0.08, sustain: 0.0, release: 0.55, peak: 0.2,
          pitchDip: 14, width: 0.9 } },
      { id: "moss-4", name: "Reed Pad", kind: "pad",
        params: { attack: 0.7, decay: 0.4, sustain: 0.85, release: 3.6, peak: 0.10,
          cutoff: 1500, q: 3.5, detune: 14, width: 1.0, vibrato: 0.35, vibratoDepth: 8 } },
      { id: "moss-5", name: "Air Chime", kind: "chime",
        params: { partials: [2, 4.02, 6, 8.04, 11.1], partialGains: [0.22, 0.10, 0.05, 0.03, 0.018],
          attack: 0.005, decay: 0.5, sustain: 0.2, release: 3.2, peak: 0.11, detune: 6, width: 0.95,
          shimmer: 0.25 } },
      { id: "moss-6", name: "Sub Hum", kind: "sub",
        params: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 3.4, peak: 0.13,
          lfoRate: 0.45, lfoDepth: 0.3, octave: -1, width: 0.3 } },
    ],
  },
  prism: {
    id: "prism",
    name: "PRISM",
    blurb: "Bright · crystalline · sharp",
    voices: [
      { id: "prism-1", name: "Crystal", kind: "fm",
        params: { ratio: 3.0, modIndex: 220, attack: 0.003, decay: 0.5, sustain: 0.3, release: 2.6,
          peak: 0.14, width: 0.7, shimmer: 0.3 } },
      { id: "prism-2", name: "Spark Pluck", kind: "pluck",
        params: { attack: 0.001, decay: 0.12, sustain: 0.3, release: 1.0, peak: 0.15,
          cutoff: 3600, q: 4, detune: 4, width: 0.8 } },
      { id: "prism-3", name: "Glass Ping", kind: "bell",
        params: { partials: [1, 1.5, 2.76, 4.1], partialGains: [0.28, 0.18, 0.08, 0.04],
          attack: 0.002, decay: 0.3, sustain: 0.2, release: 2.0, peak: 0.13, detune: 5, octave: 1,
          width: 0.85, shimmer: 0.4 } },
      { id: "prism-4", name: "Shimmer", kind: "chime",
        params: { partials: [1, 2, 3.01, 4, 5.98, 8], partialGains: [0.18, 0.16, 0.10, 0.07, 0.04, 0.025],
          attack: 0.012, decay: 0.5, sustain: 0.5, release: 3.4, peak: 0.11, detune: 6,
          lfoRate: 4.5, lfoDepth: 0.06, width: 1.0, shimmer: 0.5 } },
      { id: "prism-5", name: "Coin", kind: "noiseHit",
        params: { attack: 0.001, decay: 0.05, sustain: 0.0, release: 0.35, peak: 0.17,
          cutoff: 4500, q: 14, width: 0.9 } },
      { id: "prism-6", name: "Ribbon Bass", kind: "bass",
        params: { attack: 0.006, decay: 0.4, sustain: 0.55, release: 2.4, peak: 0.15,
          detune: 10, octave: -1, width: 0.35, cutoff: 1800, q: 2 } },
    ],
  },
  obsidian: {
    id: "obsidian",
    name: "OBSIDIAN",
    blurb: "Dark · metallic · deep",
    voices: [
      { id: "obs-1", name: "Mallet", kind: "fm",
        params: { ratio: 1.414, modIndex: 280, attack: 0.002, decay: 0.4, sustain: 0.15, release: 2.2,
          peak: 0.13, width: 0.65 } },
      { id: "obs-2", name: "Dub Pluck", kind: "pluck",
        params: { attack: 0.003, decay: 0.25, sustain: 0.4, release: 2.0, peak: 0.17,
          cutoff: 1300, q: 2.8, detune: 6, width: 0.7 } },
      { id: "obs-3", name: "Stone", kind: "noiseHit",
        params: { attack: 0.001, decay: 0.06, sustain: 0.0, release: 0.55, peak: 0.15,
          cutoff: 1700, q: 7, width: 0.8 } },
      { id: "obs-4", name: "Drone Pad", kind: "pad",
        params: { attack: 0.9, decay: 0.6, sustain: 0.85, release: 4.5, peak: 0.10,
          cutoff: 1000, q: 1.6, detune: 18, octave: -1, width: 1.0, vibrato: 0.3, vibratoDepth: 6 } },
      { id: "obs-5", name: "Iron Bell", kind: "bell",
        params: { partials: [1, 2.76, 5.4, 8.1, 10.4], partialGains: [0.26, 0.14, 0.07, 0.04, 0.02],
          attack: 0.004, decay: 0.5, sustain: 0.2, release: 4.2, peak: 0.12, detune: 4, width: 0.85 } },
      { id: "obs-6", name: "Cavern Sub", kind: "sub",
        params: { attack: 0.04, decay: 0.4, sustain: 0.6, release: 2.8, peak: 0.15,
          pitchDip: 7, octave: -1, width: 0.25, lfoRate: 0.25, lfoDepth: 0.18 } },
    ],
  },
};

export const PACK_IDS: PackId[] = ["moss", "prism", "obsidian"];

/* ---------- voice playback dispatcher ---------- */

const MAX_ACTIVE = 24;
let active = 0;

// Deterministic pseudo-random per call for subtle per-note variation (pan jitter, etc.)
let seed = 0x13579bdf;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0xffffffff;
};

export function playPackVoice(
  ctx: AudioContext,
  dest: AudioNode,
  spec: VoiceSpec,
  freq: number,
  when: number,
) {
  if (active >= MAX_ACTIVE) return;
  const p = spec.params ?? {};
  const octave = p.octave ?? 0;
  const f = freq * Math.pow(2, octave);
  const det = p.detune ?? 0;
  const width = Math.max(0, Math.min(1, p.width ?? 0.6));

  const env = ctx.createGain();
  env.gain.value = 0;

  // Per-voice tone shaping filter → stereo panner → Haas widener → dest
  let tail: AudioNode = env;
  if (p.cutoff != null && (spec.kind === "pluck" || spec.kind === "pad" || spec.kind === "noiseHit")) {
    const filt = ctx.createBiquadFilter();
    filt.type = spec.kind === "noiseHit" ? "bandpass" : "lowpass";
    filt.frequency.value = p.cutoff;
    filt.Q.value = p.q ?? 1;
    env.connect(filt);
    tail = filt;
  }

  // Stereo widener: split into L/R with Haas delay on one side, base pan + jitter.
  const basePan = (rand() * 2 - 1) * 0.55 * width;
  const panner = ctx.createStereoPanner();
  panner.pan.value = basePan;
  tail.connect(panner);

  if (width > 0.05) {
    // Haas: tiny 6–18ms delay on opposite channel via splitter/delay/merger
    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    const dL = ctx.createDelay(0.05);
    const dR = ctx.createDelay(0.05);
    const haas = 0.006 + rand() * 0.012 * width;
    if (basePan >= 0) { dL.delayTime.value = haas; dR.delayTime.value = 0; }
    else              { dL.delayTime.value = 0; dR.delayTime.value = haas; }
    panner.connect(splitter);
    splitter.connect(dL, 0); splitter.connect(dR, 1);
    dL.connect(merger, 0, 0); dR.connect(merger, 0, 1);
    merger.connect(dest);
  } else {
    panner.connect(dest);
  }

  const oscs: OscillatorNode[] = [];
  const noises: AudioBufferSourceNode[] = [];
  const lfos: OscillatorNode[] = [];

  const addOsc = (type: OscillatorType, frq: number, detune: number, gain: number) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = frq;
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g);
    g.connect(env);
    oscs.push(o);
    return o;
  };

  const attack  = p.attack  ?? 0.008;
  const decay   = p.decay   ?? 0.2;
  const sustain = Math.max(0, Math.min(1, p.sustain ?? 0.4));
  let   release = p.release ?? 2.2;
  const peak    = p.peak    ?? 0.14;

  // Optional global vibrato (pitch LFO routed to all oscs)
  let vibratoNode: GainNode | null = null;
  if (p.vibrato) {
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = p.vibrato;
    const lg = ctx.createGain();
    lg.gain.value = p.vibratoDepth ?? 4;
    lfo.connect(lg);
    vibratoNode = lg;
    lfos.push(lfo);
  }

  switch (spec.kind) {
    case "chime": {
      const parts = p.partials ?? [1, 2.01, 3];
      const gains = p.partialGains ?? [0.25, 0.08, 0.035];
      parts.forEach((m, i) => {
        const d = (i % 2 === 0 ? -1 : 1) * det * (0.5 + i * 0.2);
        addOsc("sine", f * m, d, gains[i] ?? 0.03);
      });
      if (p.shimmer) addOsc("sine", f * 2, det * 0.5, 0.05 * p.shimmer);
      if (p.lfoRate) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = p.lfoRate;
        const lg = ctx.createGain();
        lg.gain.value = (p.lfoDepth ?? 0.05) * peak;
        lfo.connect(lg).connect(env.gain);
        lfos.push(lfo);
      }
      break;
    }
    case "bell": {
      const parts = p.partials ?? [1, 3.5, 5.2];
      const gains = p.partialGains ?? [0.28, 0.12, 0.04];
      parts.forEach((m, i) => {
        const d = (i % 2 === 0 ? -1 : 1) * det * (0.4 + i * 0.18);
        addOsc("sine", f * m, d, gains[i] ?? 0.03);
      });
      if (p.shimmer) addOsc("sine", f * 2.005, det, 0.05 * p.shimmer);
      // Soft mallet excitation transient
      {
        const dur = 0.04;
        const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) * 0.4;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.frequency.value = Math.min(8000, f * 3); bp.Q.value = 2;
        const g = ctx.createGain(); g.gain.value = 0.06;
        src.connect(bp); bp.connect(g); g.connect(env);
        noises.push(src);
      }
      break;
    }
    case "pluck": {
      addOsc("triangle", f,          -det,        0.30);
      addOsc("triangle", f * 1.004,   det,        0.22);
      addOsc("sine",     f * 2,       det * 0.5,  0.07);
      break;
    }
    case "pad": {
      addOsc("sawtooth", f * 0.5,  -det,        0.18);
      addOsc("sawtooth", f * 0.5,   det,        0.18);
      addOsc("sawtooth", f * 0.501, -det * 1.5, 0.10);
      addOsc("sawtooth", f * 0.499,  det * 1.5, 0.10);
      addOsc("sine",     f,          0,         0.10);
      if (p.shimmer) addOsc("sine", f * 2, 0, 0.05 * p.shimmer);
      break;
    }
    case "bass": {
      addOsc("sine",     f,         -det,       0.34);
      addOsc("triangle", f,          det,       0.16);
      addOsc("sawtooth", f * 0.5,    0,         0.10);
      break;
    }
    case "fm": {
      const ratio = p.ratio ?? 3;
      const modIndex = p.modIndex ?? 180;
      const carrier = ctx.createOscillator();
      carrier.type = "sine";
      carrier.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = f * ratio;
      const modGain = ctx.createGain();
      // Envelope the modulation index for an evolving timbre
      modGain.gain.value = 0.0001;
      modGain.gain.setValueAtTime(0.0001, when);
      modGain.gain.linearRampToValueAtTime(modIndex, when + attack);
      modGain.gain.exponentialRampToValueAtTime(Math.max(0.01, modIndex * 0.15), when + attack + decay);
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      const cg = ctx.createGain();
      cg.gain.value = 0.34;
      carrier.connect(cg);
      cg.connect(env);
      oscs.push(carrier, mod);
      if (p.shimmer) addOsc("sine", f * 2, 0, 0.05 * p.shimmer);
      break;
    }
    case "droplet": {
      const o = addOsc("sine", f * 1.5, 0, 0.4);
      const dip = p.pitchDip ?? 12;
      o.frequency.setValueAtTime(f * Math.pow(2, dip / 12), when);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.8), when + 0.18);
      addOsc("sine", f * 3, 0, 0.05);
      release = 0.55;
      break;
    }
    case "noiseHit": {
      const dur = attack + release + 0.1;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      // Stereo decorrelated noise for natural width
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      const dL = buf.getChannelData(0);
      const dR = buf.getChannelData(1);
      for (let i = 0; i < len; i++) {
        dL[i] = (Math.random() * 2 - 1) * 0.6;
        dR[i] = (Math.random() * 2 - 1) * 0.6;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g); g.connect(env);
      noises.push(src);
      break;
    }
    case "sub": {
      const o = addOsc("sine", f, 0, 0.42);
      addOsc("sine", f * 2, 0, 0.06);
      if (p.pitchDip) {
        o.frequency.setValueAtTime(f * Math.pow(2, p.pitchDip / 12), when);
        o.frequency.exponentialRampToValueAtTime(Math.max(30, f), when + 0.25);
      }
      if (p.lfoRate) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = p.lfoRate;
        const lg = ctx.createGain();
        lg.gain.value = (p.lfoDepth ?? 0.2) * peak;
        lfo.connect(lg).connect(env.gain);
        lfos.push(lfo);
      }
      break;
    }
  }

  // Wire vibrato to all oscs (after they're created)
  if (vibratoNode) oscs.forEach((o) => vibratoNode!.connect(o.detune));

  const total = attack + decay + release + 0.15;
  active += 1;
  // ADSR — linear attack avoids the click of an exponential ramp from ~0.
  env.gain.cancelScheduledValues(when);
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(peak, when + attack);
  const sustainLevel = Math.max(0.0005, peak * sustain);
  env.gain.exponentialRampToValueAtTime(sustainLevel, when + attack + decay);
  env.gain.exponentialRampToValueAtTime(0.0005, when + attack + decay + release);

  oscs.forEach((o) => { o.start(when); o.stop(when + total); });
  noises.forEach((n) => { n.start(when); n.stop(when + total); });
  lfos.forEach((l) => { l.start(when); l.stop(when + total); });

  window.setTimeout(() => { active = Math.max(0, active - 1); },
    Math.max(0, (when + total - ctx.currentTime) * 1000));
}