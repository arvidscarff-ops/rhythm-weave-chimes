import { supabase } from "@/integrations/supabase/client";
import { PACKS, PACK_IDS, playPackVoice, type PackId, type Pack } from "./packs";
import { loadSampleBuffer } from "@/lib/dev/samplePlayer";
import {
  parseHumanization,
  resolveHumanization,
  type Humanization,
} from "@/lib/admin/humanization";

export type CustomSlot = {
  slotIndex: number;
  storagePath: string;
  label: string | null;
  pitchOffsetSemitones: number;
  gainDb: number;
  pan: number;
  humanization: Humanization | null;
};

export type RuntimePack =
  | { kind: "builtin"; id: PackId; name: string; blurb: string; pack: Pack }
  | {
      kind: "custom";
      id: string;
      name: string;
      blurb: string;
      coverUrl: string | null;
      humanization: Humanization | null;
      slots: (CustomSlot | null)[];
    };

export const BUILTIN_RUNTIME_PACKS: RuntimePack[] = PACK_IDS.map((id) => ({
  kind: "builtin" as const,
  id,
  name: PACKS[id].name,
  blurb: PACKS[id].blurb,
  pack: PACKS[id],
}));

type SlotRow = {
  slot_index: number;
  sample_id: string | null;
  label: string | null;
  pitch_offset_semitones: number | string;
  gain_db: number | string;
  pan: number | string;
  humanization: unknown;
  samples: { storage_path: string } | null;
};

async function fetchPacksBy(
  filter: (
    q: ReturnType<typeof supabase.from<"packs">>,
  ) => ReturnType<typeof supabase.from<"packs">>,
): Promise<RuntimePack[]> {
  const base = supabase
    .from("packs")
    .select(
      "id,name,description,is_builtin,cover_image_url,humanization,pack_slots(slot_index,sample_id,label,pitch_offset_semitones,gain_db,pan,humanization,samples(storage_path))",
    )
    .order("created_at", { ascending: false });
  const { data: packs, error } = await filter(base as never);
  if (error) {
    console.warn("[runtimePacks] fetch failed", error.message);
    return [];
  }
  return (packs ?? []).map((p): RuntimePack => {
    const slots: (CustomSlot | null)[] = new Array(6).fill(null);
    const rows = (p.pack_slots ?? []) as SlotRow[];
    for (const s of rows) {
      if (!s.sample_id || !s.samples?.storage_path) continue;
      if (s.slot_index < 0 || s.slot_index > 5) continue;
      slots[s.slot_index] = {
        slotIndex: s.slot_index,
        storagePath: s.samples.storage_path,
        label: s.label,
        pitchOffsetSemitones: Number(s.pitch_offset_semitones) || 0,
        gainDb: Number(s.gain_db) || 0,
        pan: Math.max(-1, Math.min(1, Number(s.pan) || 0)),
        humanization: parseHumanization(s.humanization),
      };
    }
    return {
      kind: "custom",
      id: p.id as string,
      name: p.name,
      blurb: p.description ?? "Custom pack",
      coverUrl: (p as { cover_image_url?: string | null }).cover_image_url ?? null,
      humanization: parseHumanization((p as { humanization?: unknown }).humanization),
      slots,
    };
  });
}

export function fetchCustomPacks(): Promise<RuntimePack[]> {
  // My own custom packs (auth'd user in Studio)
  return fetchPacksBy((q) => q.eq("is_builtin", false) as never);
}

export function fetchPublishedPacks(): Promise<RuntimePack[]> {
  return fetchPacksBy((q) => q.eq("is_published", true) as never);
}

export async function warmCustomPack(ctx: AudioContext, pack: RuntimePack) {
  if (pack.kind !== "custom") return;
  await Promise.all(
    pack.slots
      .filter((s): s is CustomSlot => !!s)
      .map((s) => loadSampleBuffer(ctx, s.storagePath).catch(() => null)),
  );
}

const SAMPLE_ROOT_HZ = 220;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function playSampleSlot(
  ctx: AudioContext,
  dest: AudioNode,
  slot: CustomSlot,
  packHumanization: Humanization | null,
  freq: number,
  when: number,
) {
  loadSampleBuffer(ctx, slot.storagePath)
    .then((buf) => {
      const h = resolveHumanization(packHumanization, slot.humanization);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const rate =
        (freq / SAMPLE_ROOT_HZ) * Math.pow(2, slot.pitchOffsetSemitones / 12);
      src.playbackRate.value = Math.max(0.05, Math.min(8, rate));
      // Detune drift (cents)
      if (h.detuneCents > 0) {
        src.detune.value = rand(-h.detuneCents, h.detuneCents);
      }
      const g = ctx.createGain();
      const baseGain = Math.pow(10, slot.gainDb / 20);
      const velJit = h.velocityPct > 0 ? 1 + rand(-h.velocityPct, h.velocityPct) : 1;
      g.gain.value = Math.max(0, baseGain * velJit);
      const pan = ctx.createStereoPanner();
      const panJit = h.panPct > 0 ? rand(-h.panPct, h.panPct) : 0;
      pan.pan.value = Math.max(-1, Math.min(1, slot.pan + panJit));
      let chain: AudioNode = src;
      chain = chain.connect(g);
      if (h.cutoffHz) {
        const filt = ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.Q.value = 0.7;
        filt.frequency.value = rand(h.cutoffHz[0], h.cutoffHz[1]);
        chain = chain.connect(filt);
      }
      chain.connect(pan).connect(dest);
      const startAt = Math.max(ctx.currentTime + 0.001, when);
      src.start(startAt);
      const dur = buf.duration / src.playbackRate.value + 0.25;
      src.stop(startAt + dur);
    })
    .catch((err) => console.warn("[runtimePacks] sample load failed", err));
}

export function triggerPackVoice(
  ctx: AudioContext,
  dest: AudioNode,
  pack: RuntimePack,
  ringIndex: number,
  freq: number,
  when: number,
) {
  if (pack.kind === "builtin") {
    const spec = pack.pack.voices[ringIndex % pack.pack.voices.length];
    playPackVoice(ctx, dest, spec, freq, when);
    return;
  }
  const slot = pack.slots[ringIndex % 6];
  if (slot) {
    playSampleSlot(ctx, dest, slot, pack.humanization, freq, when);
    return;
  }
  const fallback = PACKS.moss.voices[ringIndex % PACKS.moss.voices.length];
  playPackVoice(ctx, dest, fallback, freq, when);
}

export function auditionPack(
  ctx: AudioContext,
  dest: AudioNode,
  pack: RuntimePack,
  slotIndex = 0,
) {
  const when = ctx.currentTime + 0.01;
  triggerPackVoice(ctx, dest, pack, slotIndex, 440, when);
}