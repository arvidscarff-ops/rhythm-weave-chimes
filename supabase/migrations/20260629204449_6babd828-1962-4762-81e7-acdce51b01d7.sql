
-- Drop unused user_packs table (we standardise on packs/pack_slots/samples)
DROP TABLE IF EXISTS public.user_packs CASCADE;

-- Owner-scoped write policies on packs (read already covered)
CREATE POLICY "Owners insert own packs" ON public.packs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND is_builtin = false);

CREATE POLICY "Owners update own packs" ON public.packs
  FOR UPDATE TO authenticated
  USING (auth.uid() = owner_id AND is_builtin = false)
  WITH CHECK (auth.uid() = owner_id AND is_builtin = false);

CREATE POLICY "Owners delete own packs" ON public.packs
  FOR DELETE TO authenticated
  USING (auth.uid() = owner_id AND is_builtin = false);

-- Owner-scoped write policies on pack_slots (via parent pack ownership)
CREATE POLICY "Owners insert slots of own packs" ON public.pack_slots
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_slots.pack_id AND p.owner_id = auth.uid() AND p.is_builtin = false
  ));

CREATE POLICY "Owners update slots of own packs" ON public.pack_slots
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_slots.pack_id AND p.owner_id = auth.uid() AND p.is_builtin = false
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_slots.pack_id AND p.owner_id = auth.uid() AND p.is_builtin = false
  ));

CREATE POLICY "Owners delete slots of own packs" ON public.pack_slots
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_slots.pack_id AND p.owner_id = auth.uid() AND p.is_builtin = false
  ));

-- Owner-scoped policies on samples
DROP POLICY IF EXISTS "Authenticated can read samples" ON public.samples;
CREATE POLICY "Owners or builtin readable samples" ON public.samples
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR owner_id IS NULL);

CREATE POLICY "Owners insert own samples" ON public.samples
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners update own samples" ON public.samples
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete own samples" ON public.samples
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

-- Storage: owners manage their own folder in the `samples` bucket
CREATE POLICY "Owners read own sample files" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners upload own sample files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'samples' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners delete own sample files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'samples' AND auth.uid()::text = (storage.foldername(name))[1]);

-- updated_at trigger on packs
DROP TRIGGER IF EXISTS touch_packs_updated_at ON public.packs;
CREATE TRIGGER touch_packs_updated_at
  BEFORE UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
