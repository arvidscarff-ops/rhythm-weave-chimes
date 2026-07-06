ALTER TABLE public.app_scenes
  ADD COLUMN IF NOT EXISTS base_laps integer NOT NULL DEFAULT 10 CHECK (base_laps BETWEEN 1 AND 40),
  ADD COLUMN IF NOT EXISTS macro_cycle_seconds numeric NOT NULL DEFAULT 30 CHECK (macro_cycle_seconds > 0),
  ADD COLUMN IF NOT EXISTS note_count integer NOT NULL DEFAULT 8 CHECK (note_count BETWEEN 4 AND 24);