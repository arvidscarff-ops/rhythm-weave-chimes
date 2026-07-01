## Fix: route admin storage uploads through a passcode-gated signed URL

**Root cause.** The passcode unlocks server functions (which use `supabaseAdmin`, bypassing RLS), but `uploadCover` / `uploadSample` in `src/routes/admin.packs.tsx` upload **directly from the browser**. The browser client is `anon` (the admin gate isn't a Supabase sign-in), and every INSERT policy on `storage.objects` for `pack-covers` and `samples` requires `authenticated` → *"new row violates row-level security policy"*.

## Changes

### `src/lib/admin/packs.functions.ts`
Add a new server function:

```ts
createAdminUploadUrl({ passcode, bucket, path, upsert? })
```

- Passcode-gated.
- Whitelists `bucket` to `"pack-covers" | "samples"`.
- Calls `supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path, { upsert })`.
- Returns `{ signedUrl, token, path }`.

### `src/routes/admin.packs.tsx`
Replace both direct `.upload(...)` calls with the signed-URL flow:

```ts
const { path, token } = await createUploadUrl({
  data: { passcode: getPass(), bucket: "pack-covers", path: `${pack.id}/cover-${Date.now()}.${ext}` }
});
const { error } = await supabase.storage
  .from("pack-covers")
  .uploadToSignedUrl(path, token, file, { contentType: file.type });
```

Same pattern for the `samples` bucket in `SlotEditor.uploadSample`. Everything else (`registerAdminSample`, `updateAdminSlot`, `updateAdminPack`) is unchanged — those already go through server functions.

### Not touched
- No storage policy changes.
- No migration.
- No changes to the passcode gate.

### Note on the unrelated security scan findings
The three storage-policy warnings in your Security panel (`pack_covers_delete_update_no_ownership_check`, `samples_bucket_authenticated_read_all`, `pack_covers_insert_no_ownership_check`) are about the *existing* authenticated-user policies. This fix doesn't rely on them at all — admin writes/reads go through the service-role server. Happy to tighten those policies in a separate pass if you want, but it's orthogonal to unblocking uploads.
