import { createServerFn } from "@tanstack/react-start";

import type { Humanization } from "./humanization";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { requireStudioAdmin } from "@/lib/studio/admin-middleware";
import {
  assertPublicationReady,
  validatePackForPublication,
} from "@/lib/studio/studioValidation";
import { validatePackAssetPath } from "@/lib/studio/studioSecurity";

export const MAX_SLOTS_PER_PACK = 12;
export const MAX_SAMPLES_PER_SLOT = 6;

export type AdminSlot = {
  id: string;
  slot_index: number;
  label: string | null;
  gain_db: number;
  pan: number;
  pitch_offset_semitones: number;
  humanization: Humanization | null;
  samples: Array<{ id: string; name: string; storage_path: string; position: number }>;
};

export type AdminPack = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_published: boolean;
  cover_image_url: string | null;
  humanization: Humanization | null;
  updated_at: string;
  slots: AdminSlot[];
};

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pack"
  );
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadPackForPublication(
  supa: Awaited<ReturnType<typeof admin>>,
  id: string,
): Promise<AdminPack> {
  const { data: pack, error } = await supa
    .from("packs")
    .select(
      "id,name,slug,description,is_published,cover_image_url,humanization,updated_at,pack_slots(id,slot_index,label,gain_db,pan,pitch_offset_semitones,humanization,pack_slot_samples(position,samples(id,name,storage_path)))",
    )
    .eq("id", id)
    .single();
  if (error || !pack) throw new Error(error?.message ?? "Pack not found");
  type SlotSampleRow = { position: number; samples: { id: string; name: string; storage_path: string } | null };
  type SlotRawRow = {
    id: string;
    slot_index: number;
    label: string | null;
    gain_db: number | string;
    pan: number | string;
    pitch_offset_semitones: number | string;
    humanization: unknown;
    pack_slot_samples: SlotSampleRow[] | null;
  };
  return {
    id: pack.id,
    name: pack.name,
    slug: pack.slug,
    description: pack.description,
    is_published: pack.is_published,
    cover_image_url: pack.cover_image_url,
    humanization: pack.humanization as Humanization | null,
    updated_at: pack.updated_at,
    slots: ((pack.pack_slots ?? []) as unknown as SlotRawRow[])
      .map((slot): AdminSlot => ({
        id: slot.id,
        slot_index: slot.slot_index,
        label: slot.label,
        gain_db: Number(slot.gain_db),
        pan: Number(slot.pan),
        pitch_offset_semitones: Number(slot.pitch_offset_semitones),
        humanization: slot.humanization as Humanization | null,
        samples: (slot.pack_slot_samples ?? [])
          .filter((row) => !!row.samples)
          .sort((a, b) => a.position - b.position)
          .map((row) => ({
            id: row.samples!.id,
            name: row.samples!.name,
            storage_path: row.samples!.storage_path,
            position: row.position,
          })),
      }))
      .sort((a, b) => a.slot_index - b.slot_index),
  };
}

export const listAdminPacks = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .handler(async (): Promise<AdminPack[]> => {
    const supa = await admin();
    const { data, error } = await supa
      .from("packs")
      .select(
        "id,name,slug,description,is_published,cover_image_url,humanization,updated_at,pack_slots(id,slot_index,label,gain_db,pan,pitch_offset_semitones,humanization,pack_slot_samples(position,samples(id,name,storage_path)))",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    type SlotSampleRow = { position: number; samples: { id: string; name: string; storage_path: string } | null };
    type SlotRawRow = {
      id: string;
      slot_index: number;
      label: string | null;
      gain_db: number | string;
      pan: number | string;
      pitch_offset_semitones: number | string;
      humanization: unknown;
      pack_slot_samples: SlotSampleRow[] | null;
    };
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      is_published: p.is_published,
      cover_image_url: p.cover_image_url,
      humanization: p.humanization as Humanization | null,
      updated_at: p.updated_at,
      slots: ((p.pack_slots ?? []) as unknown as SlotRawRow[])
        .map((s): AdminSlot => ({
          id: s.id,
          slot_index: s.slot_index,
          label: s.label,
          gain_db: Number(s.gain_db),
          pan: Number(s.pan),
          pitch_offset_semitones: Number(s.pitch_offset_semitones),
          humanization: s.humanization as Humanization | null,
          samples: ((s.pack_slot_samples ?? []) as SlotSampleRow[])
            .filter((r) => !!r.samples)
            .sort((a, b) => a.position - b.position)
            .map((r) => ({
              id: r.samples!.id,
              name: r.samples!.name,
              storage_path: r.samples!.storage_path,
              position: r.position,
            })),
        }))
        .sort((a, b) => a.slot_index - b.slot_index),
    }));
  });

export const createAdminPack = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const slug = `${slugify(data.name)}-${Date.now().toString(36).slice(-4)}`;
    const { data: pack, error } = await supa
      .from("packs")
      .insert({
        name: data.name,
        slug,
        is_public: false,
        is_builtin: false,
        is_published: false,
      })
      .select("id")
      .single();
    if (error || !pack) throw new Error(error?.message ?? "insert failed");
    const { error: sErr } = await supa
      .from("pack_slots")
      .insert({ pack_id: pack.id, slot_index: 0 });
    if (sErr) throw new Error(sErr.message);
    return { id: pack.id as string };
  });

export const updateAdminPack = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      description?: string | null;
      is_published?: boolean;
      cover_image_url?: string | null;
      humanization?: Humanization | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    if (data.is_published === true) {
      const current = await loadPackForPublication(supa, data.id);
      assertPublicationReady(
        "pack",
        validatePackForPublication({
          ...current,
          name: data.name ?? current.name,
          description:
            data.description === undefined ? current.description : data.description,
          cover_image_url:
            data.cover_image_url === undefined
              ? current.cover_image_url
              : data.cover_image_url,
          humanization:
            data.humanization === undefined ? current.humanization : data.humanization,
        }),
      );
    }
    const patch: TablesUpdate<"packs"> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    if (data.cover_image_url !== undefined) patch.cover_image_url = data.cover_image_url;
    if (data.humanization !== undefined) patch.humanization = data.humanization as unknown as TablesUpdate<"packs">["humanization"];
    const { error } = await supa.from("packs").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminPack = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { error } = await supa.from("packs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: {
      id: string;
      label?: string | null;
      gain_db?: number;
      pan?: number;
      pitch_offset_semitones?: number;
      humanization?: Humanization | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    const patch: TablesUpdate<"pack_slots"> = {};
    if (data.label !== undefined) patch.label = data.label;
    if (data.gain_db !== undefined) patch.gain_db = data.gain_db;
    if (data.pan !== undefined) patch.pan = data.pan;
    if (data.pitch_offset_semitones !== undefined)
      patch.pitch_offset_semitones = data.pitch_offset_semitones;
    if (data.humanization !== undefined) patch.humanization = data.humanization as unknown as TablesUpdate<"pack_slots">["humanization"];
    const { error } = await supa.from("pack_slots").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { pack_id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: existing, error: e1 } = await supa
      .from("pack_slots")
      .select("slot_index")
      .eq("pack_id", data.pack_id)
      .order("slot_index", { ascending: false })
      .limit(1);
    if (e1) throw new Error(e1.message);
    const nextIndex = (existing?.[0]?.slot_index ?? -1) + 1;
    if (nextIndex >= MAX_SLOTS_PER_PACK) throw new Error(`Max ${MAX_SLOTS_PER_PACK} slots per pack`);
    const { data: row, error } = await supa
      .from("pack_slots")
      .insert({ pack_id: data.pack_id, slot_index: nextIndex })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id as string };
  });

export const removeAdminSlot = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: slot, error: eSel } = await supa
      .from("pack_slots")
      .select("pack_id")
      .eq("id", data.id)
      .single();
    if (eSel || !slot) throw new Error(eSel?.message ?? "not found");
    const { error: eDel } = await supa.from("pack_slots").delete().eq("id", data.id);
    if (eDel) throw new Error(eDel.message);
    // Re-pack slot_index to stay contiguous
    const { data: remaining, error: eList } = await supa
      .from("pack_slots")
      .select("id, slot_index")
      .eq("pack_id", slot.pack_id)
      .order("slot_index", { ascending: true });
    if (eList) throw new Error(eList.message);
    let i = 0;
    for (const r of remaining ?? []) {
      if (r.slot_index !== i) {
        const { error: eUp } = await supa
          .from("pack_slots")
          .update({ slot_index: i })
          .eq("id", r.id);
        if (eUp) throw new Error(eUp.message);
      }
      i++;
    }
    return { ok: true };
  });

export const setAdminSlotSamples = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { slot_id: string; sample_ids: string[] }) => {
    if (data.sample_ids.length > MAX_SAMPLES_PER_SLOT) {
      throw new Error(`Max ${MAX_SAMPLES_PER_SLOT} samples per slot`);
    }
    return data;
  })
  .handler(async ({ data }) => {
    const supa = await admin();
    const { error: eDel } = await supa
      .from("pack_slot_samples")
      .delete()
      .eq("slot_id", data.slot_id);
    if (eDel) throw new Error(eDel.message);
    if (data.sample_ids.length === 0) return { ok: true };
    const rows = data.sample_ids.map((sample_id, position) => ({
      slot_id: data.slot_id,
      sample_id,
      position,
    }));
    const { error: eIns } = await supa.from("pack_slot_samples").insert(rows);
    if (eIns) throw new Error(eIns.message);
    return { ok: true };
  });

export const registerAdminSample = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: { name: string; storage_path: string; mime_type?: string }) => ({
      ...data,
      storage_path: validatePackAssetPath("samples", data.storage_path),
    }),
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: row, error } = await supa
      .from("samples")
      .insert({
        name: data.name,
        storage_path: data.storage_path,
        mime_type: data.mime_type ?? "audio/wav",
        owner_id: null,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "sample insert failed");
    return { id: row.id as string };
  });

export const signedCoverUrl = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { storage_path: string }) => ({
    storage_path: validatePackAssetPath("pack-covers", data.storage_path),
  }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const supa = await admin();
    const { data: signed, error } = await supa.storage
      .from("pack-covers")
      .createSignedUrl(data.storage_path, 60 * 60 * 24 * 365);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });

const ADMIN_BUCKETS = ["pack-covers", "samples"] as const;
export type AdminBucket = (typeof ADMIN_BUCKETS)[number];

export const createAdminUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: { bucket: AdminBucket; path: string; upsert?: boolean }) => {
      if (!ADMIN_BUCKETS.includes(data.bucket)) {
        throw new Error(`Bucket not allowed: ${data.bucket}`);
      }
      return {
        ...data,
        path: validatePackAssetPath(data.bucket, data.path),
      };
    },
  )
  .handler(
    async ({ data }): Promise<{ signedUrl: string; token: string; path: string }> => {
      const supa = await admin();
      const { data: signed, error } = await supa.storage
        .from(data.bucket)
        .createSignedUploadUrl(data.path, { upsert: data.upsert ?? true });
      if (error || !signed) throw new Error(error?.message ?? "sign upload failed");
      return { signedUrl: signed.signedUrl, token: signed.token, path: signed.path };
    },
  );
