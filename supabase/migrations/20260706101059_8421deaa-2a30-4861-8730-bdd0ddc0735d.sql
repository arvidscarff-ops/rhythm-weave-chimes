
CREATE TABLE public.app_scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  background_type text NOT NULL DEFAULT 'image' CHECK (background_type IN ('image','video')),
  background_path text,
  trigger_engine_id text NOT NULL DEFAULT 'stringNet',
  ui_theme_colors jsonb NOT NULL DEFAULT '{"nodeGlow":"#7dd3fc","wireframe":"#ffffff","dockAccent":"#ffffff","textAccent":"#ffffff"}'::jsonb,
  visual_fx jsonb NOT NULL DEFAULT '{"backgroundBlur":0,"backgroundGlow":0.5,"trailPersistence":0.12}'::jsonb,
  audio_reactive jsonb NOT NULL DEFAULT '{"amplitude":1,"scalePulse":true,"opacityPulse":false,"blurPulse":false,"threshold":0}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_scenes TO anon;
GRANT SELECT ON public.app_scenes TO authenticated;
GRANT ALL ON public.app_scenes TO service_role;

ALTER TABLE public.app_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published scenes are viewable by everyone"
  ON public.app_scenes FOR SELECT
  USING (is_published = true);

CREATE TRIGGER app_scenes_touch_updated_at
  BEFORE UPDATE ON public.app_scenes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage policies for scene-assets bucket: service role handles all writes;
-- reads are performed through signed URLs generated server-side, so no
-- public SELECT policy is needed.
CREATE POLICY "Service role manages scene-assets"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'scene-assets')
  WITH CHECK (bucket_id = 'scene-assets');
