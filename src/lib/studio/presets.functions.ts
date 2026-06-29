import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SCHEMA_VERSION = 1;

/** Shape mirrors SessionState["composer"] — { e, r, sc, slots }. We do not
 *  re-validate the inner shape here; the client converts via
 *  composerFromSession on load. */
const presetJsonSchema = z.object({}).passthrough();

export type PresetRow = {
  id: string;
  name: string;
  preset_json: unknown;
  schema_version: number;
  is_builtin: boolean;
  updated_at: string;
};

export const listMyPresets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PresetRow[]> => {
    const { data, error } = await context.supabase
      .from("user_composer_presets")
      .select("id, name, preset_json, schema_version, is_builtin, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PresetRow[];
  });

export const savePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; preset_json: unknown }) =>
    z
      .object({ name: z.string().min(1).max(80), preset_json: presetJsonSchema })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PresetRow> => {
    const { data: row, error } = await context.supabase
      .from("user_composer_presets")
      .insert({
        owner_id: context.userId,
        name: data.name,
        preset_json: data.preset_json,
        schema_version: SCHEMA_VERSION,
      })
      .select("id, name, preset_json, schema_version, is_builtin, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Save failed");
    return row as PresetRow;
  });

export const renamePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_composer_presets")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_composer_presets")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicatePreset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<PresetRow> => {
    const { data: src, error: rerr } = await context.supabase
      .from("user_composer_presets")
      .select("name, preset_json, schema_version")
      .eq("id", data.id)
      .single();
    if (rerr || !src) throw new Error(rerr?.message ?? "Not found");
    const { data: row, error } = await context.supabase
      .from("user_composer_presets")
      .insert({
        owner_id: context.userId,
        name: `${src.name} (copy)`,
        preset_json: src.preset_json,
        schema_version: src.schema_version,
      })
      .select("id, name, preset_json, schema_version, is_builtin, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Duplicate failed");
    return row as PresetRow;
  });