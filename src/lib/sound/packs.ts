/* ============================================================
 * Sound Packs — pure Web Audio voice presets
 * Each pack ships 6 voices, mapped to ring index (mod 6).
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
  // Generic tunables; not every kind reads every field.
  params?: {
    ratio?: number;       // FM modulator ratio
    modIndex?: number;    // FM mod depth
    attack?: number;
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
        params: { partials: [1, 2.01, 3.0], partialGains: [0.25, 0.08, 0.035],
          attack: 0.005, release: 3.4, peak: 0.12, detune: 6 } },
      { id: "moss-2", name: "Moss Pluck", kind: "pluck",
        params: { attack: 0.003, release: 1.4, peak: 0.16, cutoff: 2200, q: 1.2, detune: 4 } },
      { id: "moss-3", name: "Droplet", kind: "droplet",
        params: { attack: 0.002, release: 0.45, peak: 0.18, pitchDip: 14 } },
      { id: "moss-4", name: "Reed Pad", kind: "pad",
        params: { attack: 0.55, release: 3.2, peak: 0.09, cutoff: 1400, q: 4, detune: 8 } },
      { id: "moss-5", name: "Air Chime", kind: "chime",
        params: { partials: [2, 4.02, 6], partialGains: [0.18, 0.07, 0.025],
          attack: 0.006, release: 2.6, peak: 0.1, detune: 5 } },
      { id: "moss-6", name: "Sub Hum", kind: "sub",
        params: { attack: 0.6, release: 3.0, peak: 0.12, lfoRate: 0.5, lfoDepth: 0.25, octave: -1 } },
    ],
  },
  prism: {
    id: "prism",
    name: "PRISM",
    blurb: "Bright · crystalline · sharp",
    voices: [
      { id: "prism-1", name: "Crystal", kind: "fm",
        params: { ratio: 3, modIndex: 180, attack: 0.004, release: 2.2, peak: 0.13 } },
      { id: "prism-2", name: "Spark Pluck", kind: "pluck",
        params: { attack: 0.002, release: 0.7, peak: 0.14, cutoff: 3200, q: 5, detune: 2 } },
      { id: "prism-3", name: "Glass Ping", kind: "bell",
        params: { partials: [1, 1.5], partialGains: [0.22, 0.16],
          attack: 0.003, release: 1.6, peak: 0.12, detune: 3, octave: 1 } },
      { id: "prism-4", name: "Shimmer", kind: "chime",
        params: { partials: [1, 2], partialGains: [0.18, 0.16],
          attack: 0.01, release: 2.8, peak: 0.1, detune: 4,
          lfoRate: 4.5, lfoDepth: 0.06 } },
      { id: "prism-5", name: "Coin", kind: "noiseHit",
        params: { attack: 0.001, release: 0.25, peak: 0.16, cutoff: 4200, q: 12 } },
      { id: "prism-6", name: "Ribbon Bass", kind: "bass",
        params: { attack: 0.008, release: 2.0, peak: 0.14, detune: 6, octave: -1 } },
    ],
  },
  obsidian: {
    id: "obsidian",
    name: "OBSIDIAN",
    blurb: "Dark · metallic · deep",
    voices: [
      { id: "obs-1", name: "Mallet", kind: "fm",
        params: { ratio: 1.41, modIndex: 240, attack: 0.003, release: 1.8, peak: 0.12 } },
      { id: "obs-2", name: "Dub Pluck", kind: "pluck",
        params: { attack: 0.004, release: 1.6, peak: 0.16, cutoff: 1200, q: 3, detune: 4 } },
      { id: "obs-3", name: "Stone", kind: "noiseHit",
        params: { attack: 0.001, release: 0.4, peak: 0.14, cutoff: 1600, q: 6 } },
      { id: "obs-4", name: "Drone Pad", kind: "pad",
        params: { attack: 0.7, release: 4.0, peak: 0.09, cutoff: 900, q: 1.4, detune: 12, octave: -1 } },
      { id: "obs-5", name: "Iron Bell", kind: "bell",
        params: { partials: [1, 2.76, 5.4], partialGains: [0.22, 0.1, 0.04],
          attack: 0.005, release: 3.6, peak: 0.11, detune: 0 } },
      { id: "obs-6", name: "Cavern Sub", kind: "sub",
        params: { attack: 0.05, release: 2.4, peak: 0.14, pitchDip: 7, octave: -1 } },
    ],
  },
};

export const PACK_IDS: PackId[] = ["moss", "prism", "obsidian"];

/* ---------- voice playback dispatcher ---------- */

const MAX_ACTIVE = 18;
let active = 0;

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

  const env = ctx.createGain();
  env.gain.value = 0;

  // optional per-voice tone shaping filter, then to dest
  let tail: AudioNode = env;
  if (p.cutoff != null && (spec.kind === "pluck" || spec.kind === "pad" || spec.kind === "noiseHit")) {
    const filt = ctx.createBiquadFilter();
    filt.type = spec.kind === "noiseHit" ? "bandpass" : "lowpass";
    filt.frequency.value = p.cutoff;
    filt.Q.value = p.q ?? 1;
    env.connect(filt);
    tail = filt;
  }
  tail.connect(dest);

  const oscs: OscillatorNode[] = [];
  const noises: AudioBufferSourceNode[] = [];

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

  let attack = p.attack ?? 0.008;
  let release = p.release ?? 2.2;
  let peak = p.peak ?? 0.14;

  switch (spec.kind) {
    case "chime": {
      const parts = p.partials ?? [1, 2.01, 3];
      const gains = p.partialGains ?? [0.25, 0.08, 0.035];
      parts.forEach((m, i) => addOsc("sine", f * m, i === 0 ? -det : det, gains[i] ?? 0.04));
      if (p.lfoRate) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = p.lfoRate;
        const lg = ctx.createGain();
        lg.gain.value = (p.lfoDepth ?? 0.05) * peak;
        lfo.connect(lg).connect(env.gain);
        lfo.start(when); lfo.stop(when + attack + release + 0.2);
      }
      break;
    }
    case "bell": {
      const parts = p.partials ?? [1, 3.5, 5.2];
      const gains = p.partialGains ?? [0.28, 0.12, 0.04];
      parts.forEach((m, i) => addOsc("sine", f * m, i === 0 ? -det : det, gains[i] ?? 0.04));
      break;
    }
    case "pluck": {
      addOsc("triangle", f, -det, 0.32);
      addOsc("triangle", f * 1.005, det, 0.18);
      break;
    }
    case "pad": {
      addOsc("sawtooth", f * 0.5, -det, 0.22);
      addOsc("sawtooth", f * 0.5, det, 0.22);
      addOsc("sine", f, 0, 0.1);
      break;
    }
    case "bass": {
      addOsc("sine", f, -det, 0.38);
      addOsc("triangle", f, det, 0.14);
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
      modGain.gain.value = modIndex;
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      const cg = ctx.createGain();
      cg.gain.value = 0.32;
      carrier.connect(cg);
      cg.connect(env);
      oscs.push(carrier, mod);
      break;
    }
    case "droplet": {
      const o = addOsc("sine", f * 1.5, 0, 0.4);
      // pitch dip down
      const dip = p.pitchDip ?? 12;
      o.frequency.setValueAtTime(f * Math.pow(2, dip / 12), when);
      o.frequency.exponentialRampToValueAtTime(Math.max(40, f * 0.8), when + 0.18);
      release = 0.35;
      break;
    }
    case "noiseHit": {
      const dur = attack + release + 0.1;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * 0.6;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(g); g.connect(env);
      noises.push(src);
      break;
    }
    case "sub": {
      const o = addOsc("sine", f, 0, 0.4);
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
        lfo.start(when); lfo.stop(when + attack + release + 0.2);
      }
      break;
    }
  }

  const total = attack + release + 0.1;
  active += 1;
  env.gain.setValueAtTime(0.0001, when);
  env.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), when + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, when + attack + release);

  oscs.forEach((o) => { o.start(when); o.stop(when + total); });
  noises.forEach((n) => { n.start(when); n.stop(when + total); });

  window.setTimeout(() => { active = Math.max(0, active - 1); },
    Math.max(0, (when + total - ctx.currentTime) * 1000));
}