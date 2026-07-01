import { createServerFn } from "@tanstack/react-start";
import { assertAdminSession } from "./gate.functions";
import type { Humanization } from "./humanization";

export type AdminSlot = {
  id: string;
  slot_index: number;
  sample_id: string | null;
  label: string | null;
  gain_db: number;
  pan: number;
  pitch_offset_semitones: number;
  humanization: Humanization | null;
  sample: {
    id: string;
    name: string;
    storage_path: string;
  } | null;
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

export const listAdminPacks = createServerFn({ method: "GET" }).handler(
  async (): Promise<AdminPack[]> => {
    await assertAdminSession();
    const supa = await admin();
    const { data, error } = await supa
      .from("packs")
      .select(
        "id,name,slug,description,is_published,cover_image_url,humanization,updated_at,pack_slots(id,slot_index,sample_id,label,gain_db,pan,pitch_offset_semitones,humanization,samples(id,name,storage_path))",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      is_published: p.is_published,
      cover_image_url: p.cover_image_url,
      humanization: p.humanization as Humanization | null,
      updated_at: p.updated_at,
      slots: ((p.pack_slots ?? []) as unknown as AdminSlot[])
        .map((s) => ({
          id: s.id,
          slot_index: s.slot_index,
          sample_id: s.sample_id,
          label: s.label,
          gain_db: Number(s.gain_db),
          pan: Number(s.pan),
          pitch_offset_semitones: Number(s.pitch_offset_semitones),
          humanization: s.humanization as Humanization | null,
          // supabase returns nested relation as `samples` key
          sample:
            (s as unknown as { samples: AdminSlot["sample"] }).samples ?? null,
        }))
        .sort((a, b) => a.slot_index - b.slot_index),
    }));
  },
);

export const createAdminPack = createServerFn({ method: "POST" })
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    await assertAdminSession();
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
    const rows = Array.from({ length: 6 }, (_, i) => ({
      pack_id: pack.id,
      slot_index: i,
    }));
    const { error: sErr } = await supa.from("pack_slots").insert(rows);
    if (sErr) throw new Error(sErr.message);
    return { id: pack.id as string };
  });

export const updateAdminPack = createServerFn({ method: "POST" })
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
    await assertAdminSession();
    const supa = await admin();
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.description !== undefined) patch.description = data.description;
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    if (data.cover_image_url !== undefined) patch.cover_image_url = data.cover_image_url;
    if (data.humanization !== undefined) patch.humanization = data.humanization;
    const { error } = await supa.from("packs").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminPack = createServerFn({ method: "POST" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await assertAdminSession();
    const supa = await admin();
    const { error } = await supa.from("packs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateAdminSlot = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      id: string;
      sample_id?: string | null;
      label?: string | null;
      gain_db?: number;
      pan?: number;
      pitch_offset_semitones?: number;
      humanization?: Humanization | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    await assertAdminSession();
    const supa = await admin();
    const patch: Record<string, unknown> = {};
    if (data.sample_id !== undefined) patch.sample_id = data.sample_id;
    if (data.label !== undefined) patch.label = data.label;
    if (data.gain_db !== undefined) patch.gain_db = data.gain_db;
    if (data.pan !== undefined) patch.pan = data.pan;
    if (data.pitch_offset_semitones !== undefined)
      patch.pitch_offset_semitones = data.pitch_offset_semitones;
    if (data.humanization !== undefined) patch.humanization = data.humanization;
    const { error } = await supa.from("pack_slots").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const registerAdminSample = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { name: string; storage_path: string; mime_type?: string }) => data,
  )
  .handler(async ({ data }) => {
    await assertAdminSession();
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
  .inputValidator((data: { storage_path: string }) => data)
  .handler(async ({ data }): Promise<{ url: string }> => {
    await assertAdminSession();
    const supa = await admin();
    const { data: signed, error } = await supa.storage
      .from("pack-covers")
      .createSignedUrl(data.storage_path, 60 * 60 * 24 * 365);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });