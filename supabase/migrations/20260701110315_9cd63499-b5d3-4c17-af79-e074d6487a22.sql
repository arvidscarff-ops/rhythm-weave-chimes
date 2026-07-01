
ALTER TABLE public.packs
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_image_url text,
  ADD COLUMN IF NOT EXISTS humanization jsonb;

ALTER TABLE public.pack_slots
  ADD COLUMN IF NOT EXISTS humanization jsonb;

-- Broaden public read to include published packs
DROP POLICY IF EXISTS "Public packs readable by all" ON public.packs;
CREATE POLICY "Public or published packs readable by all"
  ON public.packs FOR SELECT
  TO anon, authenticated
  USING (is_public = true OR is_published = true);

-- Slots follow pack visibility (already exists but rewrite to include is_published)
DROP POLICY IF EXISTS "Pack slots follow pack visibility" ON public.pack_slots;
CREATE POLICY "Pack slots follow pack visibility"
  ON public.pack_slots FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.packs p
    WHERE p.id = pack_slots.pack_id
      AND (p.is_public = true
           OR p.is_published = true
           OR p.owner_id = auth.uid()
           OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- Samples: allow anon + authenticated read when referenced by a visible pack slot
DROP POLICY IF EXISTS "Samples readable via visible pack slots" ON public.samples;
CREATE POLICY "Samples readable via visible pack slots"
  ON public.samples FOR SELECT
  TO anon, authenticated
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pack_slots ps
      JOIN public.packs p ON p.id = ps.pack_id
      WHERE ps.sample_id = samples.id
        AND (p.is_public = true OR p.is_published = true)
    )
  );

-- Ensure anon has SELECT grants where needed
GRANT SELECT ON public.packs TO anon;
GRANT SELECT ON public.pack_slots TO anon;
GRANT SELECT ON public.samples TO anon;

-- Storage: allow public read of pack cover images from the samples bucket path prefix "covers/"
-- (We'll also allow reading from a dedicated pack-covers bucket if it exists.)
DROP POLICY IF EXISTS "Public read pack covers" ON storage.objects;
CREATE POLICY "Public read pack covers"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'pack-covers');
