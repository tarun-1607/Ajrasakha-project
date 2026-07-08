
-- Weather cache: coordinates + latest snapshot per state/district key
CREATE TABLE public.weather_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_key text NOT NULL UNIQUE,
  state text,
  district text,
  block text,
  latitude double precision,
  longitude double precision,
  weather jsonb NOT NULL DEFAULT '{}'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX weather_cache_fetched_at_idx ON public.weather_cache(fetched_at DESC);

GRANT SELECT ON public.weather_cache TO authenticated;
GRANT ALL ON public.weather_cache TO service_role;

ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users can read weather cache"
  ON public.weather_cache FOR SELECT TO authenticated USING (true);

CREATE TRIGGER weather_cache_updated_at
  BEFORE UPDATE ON public.weather_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Weather settings (singleton row, id='global')
CREATE TABLE public.weather_settings (
  id text PRIMARY KEY DEFAULT 'global',
  enabled boolean NOT NULL DEFAULT true,
  cache_minutes integer NOT NULL DEFAULT 30,
  heavy_rain_mm numeric NOT NULL DEFAULT 20,
  heat_wave_c numeric NOT NULL DEFAULT 40,
  cold_wave_c numeric NOT NULL DEFAULT 8,
  frost_c numeric NOT NULL DEFAULT 2,
  strong_wind_kmh numeric NOT NULL DEFAULT 40,
  spray_rain_prob_max integer NOT NULL DEFAULT 60,
  spray_wind_max_kmh numeric NOT NULL DEFAULT 20,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.weather_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;

GRANT SELECT ON public.weather_settings TO authenticated;
GRANT ALL ON public.weather_settings TO service_role;

ALTER TABLE public.weather_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Signed-in users can read weather settings"
  ON public.weather_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can update weather settings"
  ON public.weather_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER weather_settings_updated_at
  BEFORE UPDATE ON public.weather_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
