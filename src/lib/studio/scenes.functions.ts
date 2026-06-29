import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Scene Studio — server functions.
 *
 * A user scene is a JSON definition layered on top of one built-in
 * template (the existing `SceneKind` family). v1 surface:
 *   - templateId: which built-in physics drives the scene
 *   - pack:        optional pack lock (null = follow dock)
 *   - densityOverride / speedMultiplier / pitchOffset
 *   - slotMap[0..5]: remap each original voice slot → 0..5
 *   - ink:         0..1 ink-bleed multiplier (engine wires in phase 2)
 *   - notes:       free-text creative notes
 *
 * Stored in `user_scenes.graph_json` so future graph-builder definitions
 * (Plan B) can land in the same column under a higher schema_version.
 */

const SCHEMA_VERSION = 1;

const sceneDefSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  templateId: z.enum([
    "stringNet",
    "pendulumFan",
    "spiralArp",
    "radialSweep",
    "mandalaMatrix",
    "metatronLattice",
    "fractalNebula",
    "radialResonator",
  ]),
  pack: z.string().nullable().default(null),
  densityOverride: z.number().int().min(2).max(12).nullable().default(null),
  speedMultiplier: z.number().min(0.25).max(2).default(1),
  pitchOffset: z.number().int().min(-24).max(24).default(0),
  slotMap: z.array(z.number().int().min(0).max(5)).length(6).default([0, 1, 2, 3, 4, 5]),
  ink: z.number().min(0).max(1).default(0.5),
  notes: z.string().max(500).default(""),
});

export type SceneDefinition = z.infer<typeof sceneDefSchema>;

export type SceneRow = {
  id: string;
  name: string;
  graph_json: SceneDefinition;
  schema_version: number;
  is_builtin: boolean;
  updated_at: string;
};

export function defaultSceneDefinition(): SceneDefinition {
  return sceneDefSchema.parse({ templateId: "stringNet" });
}

export const listMyScenes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SceneRow[]> => {
    const { data, error } = await context.supabase
      .from("user_scenes")
      .select("id, name, graph_json, schema_version, is_builtin, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as SceneRow[];
  });

export const createScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; graph_json?: unknown }) =>
    z
      .object({
        name: z.string().min(1).max(80),
        graph_json: sceneDefSchema.optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SceneRow> => {
    const { data: row, error } = await context.supabase
      .from("user_scenes")
      .insert({
        owner_id: context.userId,
        name: data.name,
        graph_json: data.graph_json ?? defaultSceneDefinition(),
        schema_version: SCHEMA_VERSION,
      })
      .select("id, name, graph_json, schema_version, is_builtin, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Create failed");
    return row as SceneRow;
  });

export const updateScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; graph_json: unknown }) =>
    z
      .object({ id: z.string().uuid(), graph_json: sceneDefSchema })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_scenes")
      .update({ graph_json: data.graph_json })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const renameScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().min(1).max(80) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_scenes")
      .update({ name: data.name })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("user_scenes")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<SceneRow> => {
    const { data: src, error: rerr } = await context.supabase
      .from("user_scenes")
      .select("name, graph_json, schema_version")
      .eq("id", data.id)
      .single();
    if (rerr || !src) throw new Error(rerr?.message ?? "Not found");
    const { data: row, error } = await context.supabase
      .from("user_scenes")
      .insert({
        owner_id: context.userId,
        name: `${src.name} (copy)`,
        graph_json: src.graph_json,
        schema_version: src.schema_version,
      })
      .select("id, name, graph_json, schema_version, is_builtin, updated_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "Duplicate failed");
    return row as SceneRow;
  });