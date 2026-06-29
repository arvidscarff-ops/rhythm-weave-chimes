
-- Shared touch trigger already exists as public.touch_updated_at()

-- =============== user_composer_presets ===============
CREATE TABLE public.user_composer_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  preset_json jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_composer_presets TO authenticated;
GRANT SELECT ON public.user_composer_presets TO anon;
GRANT ALL ON public.user_composer_presets TO service_role;
ALTER TABLE public.user_composer_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or builtin presets"
  ON public.user_composer_presets FOR SELECT
  USING (is_builtin = true OR owner_id = auth.uid());

CREATE POLICY "Insert own presets"
  ON public.user_composer_presets FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Update own presets"
  ON public.user_composer_presets FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false)
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Delete own presets"
  ON public.user_composer_presets FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false);

CREATE TRIGGER touch_user_composer_presets
  BEFORE UPDATE ON public.user_composer_presets
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX user_composer_presets_owner_idx
  ON public.user_composer_presets(owner_id, updated_at DESC);

-- =============== user_packs ===============
CREATE TABLE public.user_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  pack_json jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_packs TO authenticated;
GRANT SELECT ON public.user_packs TO anon;
GRANT ALL ON public.user_packs TO service_role;
ALTER TABLE public.user_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or builtin user_packs"
  ON public.user_packs FOR SELECT
  USING (is_builtin = true OR owner_id = auth.uid());

CREATE POLICY "Insert own user_packs"
  ON public.user_packs FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Update own user_packs"
  ON public.user_packs FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false)
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Delete own user_packs"
  ON public.user_packs FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false);

CREATE TRIGGER touch_user_packs
  BEFORE UPDATE ON public.user_packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX user_packs_owner_idx
  ON public.user_packs(owner_id, updated_at DESC);

-- =============== user_scenes ===============
CREATE TABLE public.user_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  graph_json jsonb NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_scenes TO authenticated;
GRANT SELECT ON public.user_scenes TO anon;
GRANT ALL ON public.user_scenes TO service_role;
ALTER TABLE public.user_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read own or builtin user_scenes"
  ON public.user_scenes FOR SELECT
  USING (is_builtin = true OR owner_id = auth.uid());

CREATE POLICY "Insert own user_scenes"
  ON public.user_scenes FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Update own user_scenes"
  ON public.user_scenes FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false)
  WITH CHECK (owner_id = auth.uid() AND is_builtin = false);

CREATE POLICY "Delete own user_scenes"
  ON public.user_scenes FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid() AND is_builtin = false);

CREATE TRIGGER touch_user_scenes
  BEFORE UPDATE ON public.user_scenes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX user_scenes_owner_idx
  ON public.user_scenes(owner_id, updated_at DESC);
