import { createServerFn } from "@tanstack/react-start";

import type { TablesUpdate } from "@/integrations/supabase/types";
import { requireStudioAdmin } from "@/lib/studio/admin-middleware";
import { validateSceneAssetPath } from "@/lib/studio/studioSecurity";

export const SCENE_ENGINES = [
  "stringNet",
  "pendulumFan",
  "spiralArp",
  "radialSweep",
  "mandalaMatrix",
  "metatronLattice",
  "fractalNebula",
  "radialResonator",
] as const;
export type SceneEngineId = (typeof SCENE_ENGINES)[number];

export type ThemeColors = {
  nodeGlow: string;
  wireframe: string;
  dockAccent: string;
  textAccent: string;
};

export type VisualFx = {
  /** 0..40 px backdrop blur applied to the background wrapper. */
  backgroundBlur: number;
  /** 0..1 brightness/glow of the background wrapper. */
  backgroundGlow: number;
  /** 0..0.5 alpha used to fade prior frames — lower = longer trails. */
  trailPersistence: number;
};

export type AudioReactive = {
  /** 0..2 multiplier applied to all reactive channels. */
  amplitude: number;
  scalePulse: boolean;
  opacityPulse: boolean;
  blurPulse: boolean;
  /** 0..1 minimum velocity to trigger a pulse. */
  threshold: number;
};

export type SceneRow = {
  id: string;
  name: string;
  background_type: "image" | "video";
  background_path: string | null;
  trigger_engine_id: SceneEngineId;
  ui_theme_colors: ThemeColors;
  visual_fx: VisualFx;
  audio_reactive: AudioReactive;
  is_published: boolean;
  updated_at: string;
  /** Phase-Alignment defaults. Live dock overrides may replace these per session. */
  base_laps: number;
  macro_cycle_seconds: number;
  note_count: number;
};

export const DEFAULT_THEME: ThemeColors = {
  nodeGlow: "#7dd3fc",
  wireframe: "#ffffff",
  dockAccent: "#ffffff",
  textAccent: "#ffffff",
};
export const DEFAULT_FX: VisualFx = {
  backgroundBlur: 0,
  backgroundGlow: 0.5,
  trailPersistence: 0.12,
};
export const DEFAULT_REACTIVE: AudioReactive = {
  amplitude: 1,
  scalePulse: true,
  opacityPulse: false,
  blurPulse: false,
  threshold: 0,
};

export const DEFAULT_CYCLE = {
  base_laps: 10,
  macro_cycle_seconds: 30,
  note_count: 8,
} as const;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function normalize(row: {
  id: string;
  name: string;
  background_type: string;
  background_path: string | null;
  trigger_engine_id: string;
  ui_theme_colors: unknown;
  visual_fx: unknown;
  audio_reactive: unknown;
  is_published: boolean;
  updated_at: string;
  base_laps?: number | null;
  macro_cycle_seconds?: number | string | null;
  note_count?: number | null;
}): SceneRow {
  const engine = (SCENE_ENGINES as readonly string[]).includes(row.trigger_engine_id)
    ? (row.trigger_engine_id as SceneEngineId)
    : "stringNet";
  return {
    id: row.id,
    name: row.name,
    background_type: row.background_type === "video" ? "video" : "image",
    background_path: row.background_path,
    trigger_engine_id: engine,
    ui_theme_colors: { ...DEFAULT_THEME, ...(row.ui_theme_colors as Partial<ThemeColors> | null) },
    visual_fx: { ...DEFAULT_FX, ...(row.visual_fx as Partial<VisualFx> | null) },
    audio_reactive: { ...DEFAULT_REACTIVE, ...(row.audio_reactive as Partial<AudioReactive> | null) },
    is_published: row.is_published,
    updated_at: row.updated_at,
    base_laps:
      typeof row.base_laps === "number" ? row.base_laps : DEFAULT_CYCLE.base_laps,
    macro_cycle_seconds:
      row.macro_cycle_seconds != null
        ? Number(row.macro_cycle_seconds)
        : DEFAULT_CYCLE.macro_cycle_seconds,
    note_count:
      typeof row.note_count === "number" ? row.note_count : DEFAULT_CYCLE.note_count,
  };
}

export const listAdminScenes = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .handler(async (): Promise<SceneRow[]> => {
    const supa = await admin();
    const { data: rows, error } = await supa
      .from("app_scenes")
      .select(
        "id,name,background_type,background_path,trigger_engine_id,ui_theme_colors,visual_fx,audio_reactive,is_published,updated_at,base_laps,macro_cycle_seconds,note_count",
      )
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => normalize(r as Parameters<typeof normalize>[0]));
  });

export const listPublishedScenes = createServerFn({ method: "GET" }).handler(
  async (): Promise<SceneRow[]> => {
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: rows, error } = await supa
      .from("app_scenes")
      .select(
        "id,name,background_type,background_path,trigger_engine_id,ui_theme_colors,visual_fx,audio_reactive,is_published,updated_at,base_laps,macro_cycle_seconds,note_count",
      )
      .eq("is_published", true)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => normalize(r as Parameters<typeof normalize>[0]));
  },
);

export const createAdminScene = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { data: row, error } = await supa
      .from("app_scenes")
      .insert({ name: data.name })
      .select("id")
      .single();
    if (error || !row) throw new Error(error?.message ?? "insert failed");
    return { id: row.id as string };
  });

export const updateAdminScene = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator(
    (data: {
      id: string;
      name?: string;
      background_type?: "image" | "video";
      background_path?: string | null;
      trigger_engine_id?: SceneEngineId;
      ui_theme_colors?: ThemeColors;
      visual_fx?: VisualFx;
      audio_reactive?: AudioReactive;
      is_published?: boolean;
      base_laps?: number;
      macro_cycle_seconds?: number;
      note_count?: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supa = await admin();
    const patch: TablesUpdate<"app_scenes"> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.background_type !== undefined) patch.background_type = data.background_type;
    if (data.background_path !== undefined) patch.background_path = data.background_path;
    if (data.trigger_engine_id !== undefined) patch.trigger_engine_id = data.trigger_engine_id;
    if (data.ui_theme_colors !== undefined)
      patch.ui_theme_colors = data.ui_theme_colors as unknown as TablesUpdate<"app_scenes">["ui_theme_colors"];
    if (data.visual_fx !== undefined)
      patch.visual_fx = data.visual_fx as unknown as TablesUpdate<"app_scenes">["visual_fx"];
    if (data.audio_reactive !== undefined)
      patch.audio_reactive = data.audio_reactive as unknown as TablesUpdate<"app_scenes">["audio_reactive"];
    if (data.is_published !== undefined) patch.is_published = data.is_published;
    if (data.base_laps !== undefined) patch.base_laps = data.base_laps;
    if (data.macro_cycle_seconds !== undefined)
      patch.macro_cycle_seconds = data.macro_cycle_seconds;
    if (data.note_count !== undefined) patch.note_count = data.note_count;
    const { error } = await supa.from("app_scenes").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAdminScene = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const supa = await admin();
    const { error } = await supa.from("app_scenes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSceneAssetUploadUrl = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { path: string }) => ({
    path: validateSceneAssetPath(data.path),
  }))
  .handler(
    async ({ data }): Promise<{ signedUrl: string; token: string; path: string }> => {
      const supa = await admin();
      const { data: signed, error } = await supa.storage
        .from("scene-assets")
        .createSignedUploadUrl(data.path, { upsert: true });
      if (error || !signed) throw new Error(error?.message ?? "sign upload failed");
      return { signedUrl: signed.signedUrl, token: signed.token, path: signed.path };
    },
  );

/**
 * Private Studio read for draft and published scene media.
 */
export const signedAdminSceneAssetUrl = createServerFn({ method: "POST" })
  .middleware([requireStudioAdmin])
  .inputValidator((data: { path: string }) => ({
    path: validateSceneAssetPath(data.path),
  }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const supa = await admin();
    const { data: signed, error } = await supa.storage
      .from("scene-assets")
      .createSignedUrl(data.path, 60 * 60 * 6);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });

/**
 * Public read for runtime backgrounds. A path is signable only while a
 * published scene references it; arbitrary private bucket paths are rejected.
 */
export const signedSceneAssetUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { path: string }) => ({
    path: validateSceneAssetPath(data.path),
  }))
  .handler(async ({ data }): Promise<{ url: string }> => {
    const supa = await admin();
    const { data: publishedScene, error: lookupError } = await supa
      .from("app_scenes")
      .select("id")
      .eq("background_path", data.path)
      .eq("is_published", true)
      .limit(1)
      .maybeSingle();

    if (lookupError || !publishedScene) {
      throw new Error("Scene asset is not referenced by published content");
    }

    const { data: signed, error } = await supa.storage
      .from("scene-assets")
      .createSignedUrl(data.path, 60 * 60 * 6);
    if (error || !signed) throw new Error(error?.message ?? "sign failed");
    return { url: signed.signedUrl };
  });
