import { supabase } from "@/integrations/supabase/client";

const bufferCache = new Map<string, Promise<AudioBuffer>>();
const urlCache = new Map<string, { url: string; exp: number }>();

export async function getSignedUrl(storagePath: string): Promise<string> {
  const now = Date.now();
  const cached = urlCache.get(storagePath);
  if (cached && cached.exp > now + 60_000) return cached.url;
  const { data, error } = await supabase.storage
    .from("samples")
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data) throw error ?? new Error("signed url failed");
  urlCache.set(storagePath, { url: data.signedUrl, exp: now + 60 * 60 * 1000 });
  return data.signedUrl;
}

export async function loadSampleBuffer(
  ctx: AudioContext,
  storagePath: string,
): Promise<AudioBuffer> {
  const key = `${ctx.sampleRate}:${storagePath}`;
  const hit = bufferCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const url = await getSignedUrl(storagePath);
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`fetch sample ${resp.status}`);
    const arr = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  })();
  bufferCache.set(key, p);
  p.catch(() => bufferCache.delete(key));
  return p;
}

export type AuditionOpts = {
  pitchSemitones?: number;
  pan?: number;
  gainDb?: number;
};

export async function auditionSample(storagePath: string, opts: AuditionOpts = {}) {
  const Ctor =
    typeof window !== "undefined"
      ? (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      : null;
  if (!Ctor) return;
  const ctx = new Ctor();
  try {
    const buf = await loadSampleBuffer(ctx, storagePath);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = Math.pow(2, (opts.pitchSemitones ?? 0) / 12);
    const gain = ctx.createGain();
    gain.gain.value = Math.pow(10, (opts.gainDb ?? 0) / 20);
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, opts.pan ?? 0));
    src.connect(gain).connect(panner).connect(ctx.destination);
    src.start();
    src.onended = () => {
      ctx.close().catch(() => {});
    };
  } catch (err) {
    console.error("audition failed", err);
    ctx.close().catch(() => {});
  }
}