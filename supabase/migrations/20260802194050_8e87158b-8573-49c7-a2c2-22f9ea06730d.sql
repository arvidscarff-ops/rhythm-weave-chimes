-- Storage: pack-covers writes restricted to admins
DROP POLICY IF EXISTS "Authenticated write pack covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update pack covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete pack covers" ON storage.objects;

CREATE POLICY "Admins write pack covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins update pack covers" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins delete pack covers" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pack-covers' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Storage: remove broad read of every sample file
DROP POLICY IF EXISTS "Authenticated read samples bucket" ON storage.objects;

-- Trigger-only SECURITY DEFINER functions must not be callable through the API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;