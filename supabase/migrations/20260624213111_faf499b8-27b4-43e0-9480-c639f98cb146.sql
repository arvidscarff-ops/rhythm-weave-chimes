
-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles readable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);

-- ============ AUTO-PROVISION: first user becomes admin ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count int;
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));

  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ PACKS ============
CREATE TABLE public.packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_builtin boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.packs TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.packs TO authenticated;
GRANT ALL ON public.packs TO service_role;
ALTER TABLE public.packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public packs readable by all" ON public.packs
  FOR SELECT TO anon, authenticated USING (is_public = true);
CREATE POLICY "Owners read own packs" ON public.packs
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Admins read all packs" ON public.packs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage packs" ON public.packs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ SAMPLES ============
-- A sample is a single audio asset uploaded to storage and described here.
CREATE TABLE public.samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  storage_path text NOT NULL UNIQUE, -- path in `samples` bucket
  mime_type text NOT NULL DEFAULT 'audio/wav',
  sample_rate_hz int,
  bit_depth int,
  channels int,
  duration_sec numeric,
  root_note text,                    -- e.g. 'C4' for pitch mapping
  loop_start_sec numeric,
  loop_end_sec numeric,
  size_bytes bigint,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.samples TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.samples TO authenticated;
GRANT ALL ON public.samples TO service_role;
ALTER TABLE public.samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage samples" ON public.samples
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can read samples" ON public.samples
  FOR SELECT TO authenticated USING (true);

-- ============ PACK SLOTS ============
-- Each pack has up to 6 slots (slot_index 0..5) that bind a sample to a pack position.
CREATE TABLE public.pack_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.packs(id) ON DELETE CASCADE,
  slot_index int NOT NULL CHECK (slot_index >= 0 AND slot_index < 6),
  sample_id uuid REFERENCES public.samples(id) ON DELETE SET NULL,
  label text,
  gain_db numeric NOT NULL DEFAULT 0,
  pan numeric NOT NULL DEFAULT 0 CHECK (pan >= -1 AND pan <= 1),
  pitch_offset_semitones numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pack_id, slot_index)
);
GRANT SELECT ON public.pack_slots TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pack_slots TO authenticated;
GRANT ALL ON public.pack_slots TO service_role;
ALTER TABLE public.pack_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pack slots follow pack visibility" ON public.pack_slots
  FOR SELECT TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.packs p WHERE p.id = pack_id AND (p.is_public = true OR p.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Admins manage pack slots" ON public.pack_slots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ updated_at trigger ============
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_packs_updated BEFORE UPDATE ON public.packs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ Storage policies (samples bucket created via tool) ============
-- Admins manage all objects; authenticated users can read.
CREATE POLICY "Admins manage samples bucket"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'samples' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'samples' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read samples bucket"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'samples');
