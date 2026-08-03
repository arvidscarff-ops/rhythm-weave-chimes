import { createServerFn } from "@tanstack/react-start";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { requireStudioAdmin } from "@/lib/studio/admin-middleware";
import {
  assertPublicationReady,
  validateScaleForPublication,
} from "@/lib/studio/studioValidation";

export type AdminProgressionStep = {
  id: string;
  step_order: number;
  chord_tones: number[];
  accent_tones: number[];
  duration_bars: number;
};

export type AdminScale = {
  id: string;
  name: string;
  pool_size: number;
  intervals: number[];
  pitches: string[];
  is_published: boolean;
  updated_at: string;
  steps: AdminProgressionStep[];
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function loadScaleForPublication(
  supa: Awaited<ReturnType<typeof admin>>,
  id: string,
): Promise<AdminScale> {
  const { data: scale, error } = await supa
    .from("custom_scales")
    .select(
      "id,name,pool_size,intervals,pitches,is_published,updated_at,scale_progressions(id,step_order,chord_tones,accent_tones,duration_bars)",
    )
    .eq("id", id)
    .single();
  if (error || !scale) throw new Error(error?.message ?? "Scale not found");
  type StepRow = { id: string; step_order: number; chord_tones: number[] | null; accent_tones: number[] | null; duration_bars: number | null };
  return {
    id: scale.id,
    name: scale.name,
    pool_size: scale.pool_size,
    intervals: scale.intervals ?? [],
    pitches: scale.pitches ?? [],
    is_published: scale.is_published,
    updated_at: scale.updated_at,
    steps: ((scale.scale_progressions ?? []) as StepRow[])
      .map((step) => ({
        id: step.id,
        step_order: step.step_order,
        chord_tones: step.chord_tones ?? [],
        accent_tones: step.accent_tones ?? [],
        duration_bars: step.duration_bars ?? 4,
      }))
      .sort((a, b) => a.step_order - b.step_order),
  };
}

export const listAdminScales = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .handler(async (): Promise<AdminScale[]> => {
    const supa = await admin();
    const { data: rows, error } = await supa
      .from("custom_scales")
      .select("id,name,pool_size,intervals,pitches,is_published,updated_at,scale_progressions(id,step_order,chord_tones,accent_tones,duration_bars)")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    type StepRow = { id: string; step_order: number; chord_tones: number[] | null; accent_tones: number[] | null; duration_bars: number | null };
    return (rows ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      pool_size: r.pool_size,
      intervals: r.intervals ?? [],
      pitches: r.pitches ?? [],
      is_published: r.is_published,
      updated_at: r.updated_at,
      steps: ((r.scale_progressions ?? []) as StepRow[])
        .map((s) => ({
          id: s.id,
          step_order: s.step_order,
          chord_tones: s.chord_tones ?? [],
          accent_tones: s.accent_tones ?? [],
          duration_bars: s.duration_bars ?? 4,
        }))
        .sort((a, b) => a.step_order - b.step_order),
    }));
  });

export const createAdminScale = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: row, error } = await supa
      .from("custom_scales")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    // Seed with one empty step.
    await supa.from("scale_progressions").insert({
      scale_id: row.id,
      step_order: 0,
      chord_tones: [0, 2, 4],
      accent_tones: [1, 3],
      duration_bars: 4,
    });
    return { id: row.id as string };
  });

export const updateAdminScale = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      pool_size?: number;
      intervals?: number[];
      pitches?: string[];
      is_published?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    if (data.is_published === true) {
      const current = await loadScaleForPublication(supa, data.id);
      assertPublicationReady(
        "scale",
        validateScaleForPublication({
          ...current,
          name: data.name ?? current.name,
          pool_size: data.pool_size ?? current.pool_size,
          intervals: data.intervals ?? current.intervals,
          pitches: data.pitches ?? current.pitches,
        }),
      );
    }
    const patch: TablesUpdate<"custom_scales"> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.pool_size !== undefined) patch.pool_size = data.pool_size;
    if (data.intervals !== undefined) patch.intervals = data.intervals;
    if (data.pitches !== undefined) patch.pitches = data.pitches;
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    const { error } = await supa.from("custom_scales").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminScale = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { error } = await supa.from("custom_scales").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addProgressionStep = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { scale_id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: existing, error: e1 } = await supa
      .from("scale_progressions")
      .select("step_order")
      .eq("scale_id", data.scale_id)
      .order("step_order", { ascending: false })
      .limit(1);
    if (e1) throw new Error(e1.message);
    const next = (existing?.[0]?.step_order ?? -1) + 1;
    const { data: row, error } = await supa
      .from("scale_progressions")
      .insert({
        scale_id: data.scale_id,
        step_order: next,
        chord_tones: [0, 2, 4],
        accent_tones: [1, 3],
        duration_bars: 4,
      })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id as string };
  });

export const updateProgressionStep = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: {
      id: string;
      chord_tones?: number[];
      accent_tones?: number[];
      duration_bars?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    const patch: TablesUpdate<"scale_progressions"> = {};
    if (data.chord_tones !== undefined) patch.chord_tones = data.chord_tones;
    if (data.accent_tones !== undefined) patch.accent_tones = data.accent_tones;
    if (data.duration_bars !== undefined) patch.duration_bars = data.duration_bars;
    const { error } = await supa.from("scale_progressions").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeProgressionStep = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: step, error: eSel } = await supa
      .from("scale_progressions")
      .select("scale_id")
      .eq("id", data.id)
      .single();
    if (eSel || !step) throw new Error(eSel?.message ?? "not found");
    const { error: eDel } = await supa.from("scale_progressions").delete().eq("id", data.id);
    if (eDel) throw new Error(eDel.message);
    // Repack step_order to stay contiguous.
    const { data: remaining, error: eList } = await supa
      .from("scale_progressions")
      .select("id, step_order")
      .eq("scale_id", step.scale_id)
      .order("step_order", { ascending: true });
    if (eList) throw new Error(eList.message);
    let i = 0;
    for (const r of remaining ?? []) {
      if (r.step_order !== i) {
        // Two-phase avoid unique conflict: use large offset first.
        await supa
          .from("scale_progressions")
          .update({ step_order: 1000 + i })
          .eq("id", r.id);
      }
      i++;
    }
    i = 0;
    for (const r of remaining ?? []) {
      await supa.from("scale_progressions").update({ step_order: i }).eq("id", r.id);
      i++;
    }
    return { ok: true };
  });
