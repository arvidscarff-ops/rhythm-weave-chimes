
-- 0. Drop the old samples-visibility policy that references pack_slots.sample_id
DROP POLICY IF EXISTS "Samples readable via visible pack slots" ON public.samples;

-- 1. Wipe existing data
TRUNCATE TABLE public.pack_slots RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.packs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.samples RESTART IDENTITY CASCADE;

-- 2. pack_slots: drop sample_id and any unique constraints on (pack_id, slot_index)
ALTER TABLE public.pack_slots DROP COLUMN IF EXISTS sample_id;
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.pack_slots'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.pack_slots DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

-- 3. New join table
CREATE TABLE public.pack_slot_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES public.pack_slots(id) ON DELETE CASCADE,
  sample_id uuid NOT NULL REFERENCES public.samples(id) ON DELETE RESTRICT,
  position int NOT NULL CHECK (position >= 0 AND position <= 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slot_id, position)
);
CREATE INDEX pack_slot_samples_slot_id_idx ON public.pack_slot_samples (slot_id);

GRANT SELECT ON public.pack_slot_samples TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.pack_slot_samples TO authenticated;
GRANT ALL ON public.pack_slot_samples TO service_role;

ALTER TABLE public.pack_slot_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Slot samples follow pack visibility"
  ON public.pack_slot_samples FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_slots s
      JOIN public.packs p ON p.id = s.pack_id
      WHERE s.id = pack_slot_samples.slot_id
        AND (p.is_public = true OR p.is_published = true OR p.owner_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Admins manage slot samples"
  ON public.pack_slot_samples FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners insert slot samples of own packs"
  ON public.pack_slot_samples FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pack_slots s
      JOIN public.packs p ON p.id = s.pack_id
      WHERE s.id = pack_slot_samples.slot_id
        AND p.owner_id = auth.uid()
        AND p.is_builtin = false
    )
  );

CREATE POLICY "Owners update slot samples of own packs"
  ON public.pack_slot_samples FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_slots s
      JOIN public.packs p ON p.id = s.pack_id
      WHERE s.id = pack_slot_samples.slot_id
        AND p.owner_id = auth.uid()
        AND p.is_builtin = false
    )
  );

CREATE POLICY "Owners delete slot samples of own packs"
  ON public.pack_slot_samples FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.pack_slots s
      JOIN public.packs p ON p.id = s.pack_id
      WHERE s.id = pack_slot_samples.slot_id
        AND p.owner_id = auth.uid()
        AND p.is_builtin = false
    )
  );

-- 4. Re-create samples visibility policy using the new join
CREATE POLICY "Samples readable via visible pack slot samples"
  ON public.samples FOR SELECT
  USING (
    owner_id IS NULL
    OR owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.pack_slot_samples pss
      JOIN public.pack_slots ps ON ps.id = pss.slot_id
      JOIN public.packs p ON p.id = ps.pack_id
      WHERE pss.sample_id = samples.id
        AND (p.is_public = true OR p.is_published = true)
    )
  );
