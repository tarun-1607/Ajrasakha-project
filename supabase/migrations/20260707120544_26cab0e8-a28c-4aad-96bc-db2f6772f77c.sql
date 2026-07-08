ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS block TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS village TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS soil_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS farm_size TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS irrigation_type TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS current_season TEXT NOT NULL DEFAULT '';

ALTER TABLE public.golden_answers
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS block TEXT,
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS soil_type TEXT;

ALTER TABLE public.pop_answers
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS block TEXT,
  ADD COLUMN IF NOT EXISTS season TEXT,
  ADD COLUMN IF NOT EXISTS soil_type TEXT;

CREATE INDEX IF NOT EXISTS golden_answers_region_idx
  ON public.golden_answers (state, district, crop, season);
CREATE INDEX IF NOT EXISTS pop_answers_region_idx
  ON public.pop_answers (state, district, crop, season);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, state, district, block, village,
    preferred_language, primary_crop,
    soil_type, farm_size, irrigation_type, current_season
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'state', ''),
    COALESCE(NEW.raw_user_meta_data->>'district', ''),
    COALESCE(NEW.raw_user_meta_data->>'block', ''),
    COALESCE(NEW.raw_user_meta_data->>'village', ''),
    COALESCE(NEW.raw_user_meta_data->>'preferred_language', 'English'),
    COALESCE(NEW.raw_user_meta_data->>'primary_crop', ''),
    COALESCE(NEW.raw_user_meta_data->>'soil_type', ''),
    COALESCE(NEW.raw_user_meta_data->>'farm_size', ''),
    COALESCE(NEW.raw_user_meta_data->>'irrigation_type', ''),
    COALESCE(NEW.raw_user_meta_data->>'current_season', '')
  );
  RETURN NEW;
END;
$$;