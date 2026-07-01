## Problem

Published packs never show up in the app (home page and Studio). The Supabase query fails at RLS-evaluation time with:

`permission denied for function has_role`

The RLS policies added by the CMS migration reference `public.has_role(auth.uid(), 'admin')` in their `USING` clauses on `packs`, `pack_slots`, and `pack_slot_samples`. When PostgREST evaluates any SELECT as the `anon` or `authenticated` role, Postgres has to call `has_role` — but `EXECUTE` on that function was never granted to those roles, so the query aborts before the permissive "published packs readable by all" branch is even considered.

## Fix

One tiny migration granting execute on the security-definer role checker:

```sql
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
```

This is safe: `has_role` is `SECURITY DEFINER` and only reads `public.user_roles`; granting EXECUTE lets policies call it but does not widen row visibility.

## Verify

- Re-run the published-packs select from the browser (anon) — should return the `OZUM01` pack with its slots and samples.
- Reload the home page — the pack appears in the packs list, samples decode, audition works.
- Admin CMS still functions unchanged.

No app-code, schema, or grant-shape changes beyond that one GRANT.