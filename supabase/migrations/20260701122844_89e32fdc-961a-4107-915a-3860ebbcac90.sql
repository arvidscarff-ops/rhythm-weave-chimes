
-- =====================================================
-- CUSTOM SCALES + PROGRESSIONS
-- =====================================================

CREATE TABLE public.custom_scales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pool_size int NOT NULL DEFAULT 7,
  intervals int[] NOT NULL DEFAULT '{0,2,4,5,7,9,11}',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custom_scales TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_scales TO authenticated;
GRANT ALL ON public.custom_scales TO service_role;

ALTER TABLE public.custom_scales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published scales readable by all"
  ON public.custom_scales FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can view all scales"
  ON public.custom_scales FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert scales"
  ON public.custom_scales FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update scales"
  ON public.custom_scales FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete scales"
  ON public.custom_scales FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_custom_scales
  BEFORE UPDATE ON public.custom_scales
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Progression steps ------------------------------------

CREATE TABLE public.scale_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id uuid NOT NULL REFERENCES public.custom_scales(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  chord_tones int[] NOT NULL DEFAULT '{}',
  accent_tones int[] NOT NULL DEFAULT '{}',
  duration_bars int NOT NULL DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scale_id, step_order)
);

CREATE INDEX scale_progressions_scale_id_idx ON public.scale_progressions(scale_id, step_order);

GRANT SELECT ON public.scale_progressions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scale_progressions TO authenticated;
GRANT ALL ON public.scale_progressions TO service_role;

ALTER TABLE public.scale_progressions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Progressions of published scales readable by all"
  ON public.scale_progressions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.custom_scales cs
    WHERE cs.id = scale_id AND cs.is_published = true
  ));

CREATE POLICY "Admins can view all progressions"
  ON public.scale_progressions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert progressions"
  ON public.scale_progressions FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update progressions"
  ON public.scale_progressions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete progressions"
  ON public.scale_progressions FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER touch_scale_progressions
  BEFORE UPDATE ON public.scale_progressions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed a starter published scale so the runtime engine has content ---------

DO $$
DECLARE
  new_scale_id uuid;
BEGIN
  INSERT INTO public.custom_scales (name, pool_size, intervals, is_published)
  VALUES ('Neo-Ambient Pentatonic', 5, '{0,3,5,7,10}', true)
  RETURNING id INTO new_scale_id;

  INSERT INTO public.scale_progressions (scale_id, step_order, chord_tones, accent_tones, duration_bars)
  VALUES
    (new_scale_id, 0, '{0,2,4}', '{1,3}', 4),
    (new_scale_id, 1, '{0,1,3}', '{2,4}', 4),
    (new_scale_id, 2, '{1,2,4}', '{0,3}', 4),
    (new_scale_id, 3, '{0,2,3}', '{1,4}', 4);
END $$;
