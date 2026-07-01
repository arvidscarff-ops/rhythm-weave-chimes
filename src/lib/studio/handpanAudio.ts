/**
 * Polyphonic click-to-play preview engine for the Studio Handpan editor.
 *
 * Every call to `playPitch` instantiates a NEW AudioBufferSourceNode +
 * NEW GainNode envelope. Nothing is reused — no voice stealing, no
 * choke. Clicking N slots in rapid succession produces N overlapping
 * voices that all ring out to their release tail.
 */

import { pitchToFreq } from "@/lib/music/pitch";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let buffer: AudioBuffer | null = null;
let bufferLoading: Promise<AudioBuffer> | null = null;

// The synthesized fallback is generated at 220 Hz.
const SAMPLE_ROOT_HZ = 220;
const RELEASE_SEC = 2.2;

function ensureCtx(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    const AC = (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return { ctx: ctx!, master: master! };
}

/**
 * Synthesize a soft handpan-ish tone (fundamental + odd harmonic + short
 * inharmonic ping) into an offline buffer. Zero network cost, decent tone,
 * always available.
 */
function synthesizeBuffer(context: BaseAudioContext): AudioBuffer {
  const sr = context.sampleRate;
  const dur = 3.0;
  const len = Math.floor(sr * dur);
  const buf = context.createBuffer(1, len, sr);
  const data = buf.getChannelData(0);
  const f0 = SAMPLE_ROOT_HZ;
  const partials: Array<[number, number, number]> = [
    // [freqMult, amp, decayHz]
    [1.0, 1.0, 1.4],
    [2.01, 0.35, 2.6],
    [3.02, 0.18, 3.8],
    [4.7, 0.08, 6.0],
  ];
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    let s = 0;
    for (const [mult, amp, dec] of partials) {
      s += amp * Math.sin(2 * Math.PI * f0 * mult * t) * Math.exp(-dec * t);
    }
    // Fast attack ping
    if (t < 0.008) s *= t / 0.008;
    data[i] = s * 0.5;
  }
  return buf;
}

async function ensureBuffer(): Promise<AudioBuffer> {
  if (buffer) return buffer;
  if (bufferLoading) return bufferLoading;
  const { ctx: c } = ensureCtx();
  bufferLoading = Promise.resolve(synthesizeBuffer(c)).then((b) => {
    buffer = b;
    return b;
  });
  return bufferLoading;
}

let voiceCounter = 0;

export type VoiceHandle = { id: number; endsAt: number };

export function playPitch(pitch: string): VoiceHandle {
  const { ctx: c, master: m } = ensureCtx();
  const id = ++voiceCounter;
  const now = c.currentTime;
  const endsAt = now + RELEASE_SEC + 0.15;

  const freq = pitchToFreq(pitch);
  const rate = freq / SAMPLE_ROOT_HZ;

  const start = (buf: AudioBuffer) => {
    // Fresh nodes every call — this is the anti-choke contract.
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.max(0.05, Math.min(8, rate));

    const voiceGain = c.createGain();
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(1, now + 0.005);
    voiceGain.gain.setTargetAtTime(0, now + 0.02, RELEASE_SEC / 4);

    src.connect(voiceGain).connect(m);
    src.start(now);
    src.stop(now + RELEASE_SEC + 0.1);
    src.onended = () => {
      try { src.disconnect(); } catch { /* noop */ }
      try { voiceGain.disconnect(); } catch { /* noop */ }
    };
  };

  if (buffer) {
    start(buffer);
  } else {
    void ensureBuffer().then(start);
  }

  return { id, endsAt };
}

export function primeAudio(): void {
  ensureCtx();
  void ensureBuffer();
}