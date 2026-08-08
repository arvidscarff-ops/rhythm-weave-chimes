-- 1. Move the role-check helper out of the API-exposed schema so it can't be called directly
CREATE SCHEMA IF NOT EXISTS private;

ALTER FUNCTION public.has_role(uuid, public.app_role) SET SCHEMA private;
ALTER FUNCTION private.has_role(uuid, public.app_role) SET search_path = public, private;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO anon, authenticated, service_role;

-- 2. Tighten read policies to signed-in users only
DROP POLICY IF EXISTS "Read own or builtin presets" ON public.user_composer_presets;
CREATE POLICY "Read own or builtin presets"
  ON public.user_composer_presets
  FOR SELECT TO authenticated
  USING (is_builtin = true OR owner_id = auth.uid());

DROP POLICY IF EXISTS "Read own or builtin user_scenes" ON public.user_scenes;
CREATE POLICY "Read own or builtin user_scenes"
  ON public.user_scenes
  FOR SELECT TO authenticated
  USING (is_builtin = true OR owner_id = auth.uid());

-- 3. Prevent overwriting other users' sample files
DROP POLICY IF EXISTS "Owners update own sample files" ON storage.objects;
CREATE POLICY "Owners update own sample files"
  ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'samples' AND (auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'samples' AND (auth.uid())::text = (storage.foldername(name))[1]);