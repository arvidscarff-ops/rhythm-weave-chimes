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
  storagePaths: string[]; // 1..6 variations for round-robin
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
      // In-memory round-robin state per slot index (last chosen variation index)
      _rrState?: Record<number, number>;
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
  label: string | null;
  pitch_offset_semitones: number | string;
  gain_db: number | string;
  pan: number | string;
  humanization: unknown;
  pack_slot_samples:
    | Array<{ position: number; samples: { storage_path: string } | null }>
    | null;
};

type PackRowLite = {
  id: string;
  name: string;
  description: string | null;
  is_builtin: boolean;
  cover_image_url: string | null;
  humanization: unknown;
  pack_slots: SlotRow[] | null;
};

function mapPacks(rows: PackRowLite[]): RuntimePack[] {
  return rows.map((p): RuntimePack => {
    // Dynamic slot count: pick the highest slot_index+1, min 1
    const srows = (p.pack_slots ?? []) as SlotRow[];
    const maxIdx = srows.reduce((m, s) => Math.max(m, s.slot_index), -1);
    const slotCount = Math.max(1, maxIdx + 1);
    const slots: (CustomSlot | null)[] = new Array(slotCount).fill(null);
    for (const s of srows) {
      if (s.slot_index < 0 || s.slot_index >= slotCount) continue;
      const paths = ((s.pack_slot_samples ?? []) as NonNullable<SlotRow["pack_slot_samples"]>)
        .filter((r) => !!r.samples?.storage_path)
        .sort((a, b) => a.position - b.position)
        .map((r) => r.samples!.storage_path);
      if (paths.length === 0) continue;
      slots[s.slot_index] = {
        slotIndex: s.slot_index,
        storagePaths: paths,
        label: s.label,
        pitchOffsetSemitones: Number(s.pitch_offset_semitones) || 0,
        gainDb: Number(s.gain_db) || 0,
        pan: Math.max(-1, Math.min(1, Number(s.pan) || 0)),
        humanization: parseHumanization(s.humanization),
      };
    }
    return {
      kind: "custom",
      id: p.id,
      name: p.name,
      blurb: p.description ?? "Custom pack",
      coverUrl: p.cover_image_url ?? null,
      humanization: parseHumanization(p.humanization),
      slots,
      _rrState: {},
    };
  });
}

const PACK_SELECT =
  "id,name,description,is_builtin,cover_image_url,humanization,pack_slots(slot_index,label,pitch_offset_semitones,gain_db,pan,humanization,pack_slot_samples(position,samples(storage_path)))";

export async function fetchCustomPacks(): Promise<RuntimePack[]> {
  const { data, error } = await supabase
    .from("packs")
    .select(PACK_SELECT)
    .eq("is_builtin", false)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[runtimePacks] fetch failed", error.message);
    return [];
  }
  return mapPacks((data ?? []) as unknown as PackRowLite[]);
}

export async function fetchPublishedPacks(): Promise<RuntimePack[]> {
  const { data, error } = await supabase
    .from("packs")
    .select(PACK_SELECT)
    .eq("is_published", true)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[runtimePacks] fetch failed", error.message);
    return [];
  }
  return mapPacks((data ?? []) as unknown as PackRowLite[]);
}

export async function warmCustomPack(ctx: AudioContext, pack: RuntimePack) {
  if (pack.kind !== "custom") return;
  const allPaths = pack.slots
    .filter((s): s is CustomSlot => !!s)
    .flatMap((s) => s.storagePaths);
  await Promise.all(
    allPaths.map((p) => loadSampleBuffer(ctx, p).catch(() => null)),
  );
}

const SAMPLE_ROOT_HZ = 220;

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// Round-robin selector: never repeat the last-played index when >1 variations.
function pickVariation(paths: string[], lastIndex: number | undefined): number {
  if (paths.length <= 1) return 0;
  const n = paths.length;
  let i = Math.floor(Math.random() * (n - 1));
  if (lastIndex !== undefined && i >= lastIndex) i += 1;
  return i;
}

function playSampleSlot(
  ctx: AudioContext,
  dest: AudioNode,
  slot: CustomSlot,
  packHumanization: Humanization | null,
  freq: number,
  when: number,
  pickPath: () => string,
) {
  const path = pickPath();
  loadSampleBuffer(ctx, path)
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
  const slotCount = pack.slots.length || 1;
  const slotIdx = ringIndex % slotCount;
  const slot = pack.slots[slotIdx];
  if (slot) {
    playSampleSlot(ctx, dest, slot, pack.humanization, freq, when, () => {
      const state = pack._rrState ?? (pack._rrState = {});
      const idx = pickVariation(slot.storagePaths, state[slotIdx]);
      state[slotIdx] = idx;
      return slot.storagePaths[idx];
    });
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