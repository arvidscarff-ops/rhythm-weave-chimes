import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ActiveScale } from "./progression";

/**
 * Public read-only fetch of all published scales + their progression steps.
 * Anyone can call this; RLS policy `Published scales readable by all` gates
 * visibility.
 */
export const fetchPublishedScales = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveScale[]> => {
    const supa = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supa
      .from("custom_scales")
      .select("id,name,pool_size,intervals,pitches,scale_progressions(step_order,chord_tones,accent_tones,duration_bars)")
      .eq("is_published", true)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      pool_size: row.pool_size,
      intervals: row.intervals ?? [],
      pitches: row.pitches ?? undefined,
      steps: ((row.scale_progressions ?? []) as Array<{
        step_order: number;
        chord_tones: number[] | null;
        accent_tones: number[] | null;
        duration_bars: number | null;
      }>)
        .map((s) => ({
          step_order: s.step_order,
          chord_tones: s.chord_tones ?? [],
          accent_tones: s.accent_tones ?? [],
          duration_bars: s.duration_bars ?? 4,
        }))
        .sort((a, b) => a.step_order - b.step_order),
    }));
  },
);