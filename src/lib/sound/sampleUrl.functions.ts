import { createServerFn } from "@tanstack/react-start";

/**
 * Returns a short-lived signed URL for a sample file, but only when the sample
 * is reachable through publicly visible content (built-in samples with no owner,
 * or samples attached to a public/published pack).
 *
 * The `samples` bucket is private and no longer readable by every signed-in
 * user, so visibility is verified server-side before signing.
 */
export const signPublicSampleUrl = createServerFn({ method: "POST" })
  .inputValidator((data: { storagePath: string }) => {
    if (typeof data?.storagePath !== "string" || data.storagePath.length === 0 || data.storagePath.length > 512) {
      throw new Error("Invalid storage path");
    }
    return { storagePath: data.storagePath };
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sample, error } = await supabaseAdmin
      .from("samples")
      .select("id, owner_id, storage_path")
      .eq("storage_path", data.storagePath)
      .maybeSingle();
    if (error) throw new Error("Unable to resolve sample");
    if (!sample) throw new Error("Sample not found");

    let visible = sample.owner_id === null;
    if (!visible) {
      const { data: links } = await supabaseAdmin
        .from("pack_slot_samples")
        .select("pack_slots(packs(is_public, is_published))")
        .eq("sample_id", sample.id);
      type Row = { pack_slots: { packs: { is_public: boolean; is_published: boolean } | null } | null };
      visible = ((links ?? []) as unknown as Row[]).some(
        (r) => r.pack_slots?.packs?.is_public === true || r.pack_slots?.packs?.is_published === true,
      );
    }
    if (!visible) throw new Error("Not found");

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("samples")
      .createSignedUrl(sample.storage_path, 60 * 60);
    if (signErr || !signed) throw new Error("Unable to sign sample URL");
    return { url: signed.signedUrl };
  });
