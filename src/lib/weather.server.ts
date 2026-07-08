import { createClient } from "@supabase/supabase-js";

/** Snapshot returned by the weather pipeline (also cached in Supabase). */
export type WeatherSnapshot = {
  latitude: number;
  longitude: number;
  timezone: string;
  current: {
    temperatureC: number;
    feelsLikeC: number;
    humidity: number;
    rainMm: number;
    windSpeedKmh: number;
    windDirectionDeg: number;
    weatherCode: number;
    condition: string;
    isDay: boolean;
    uvIndex: number;
  };
  today: {
    tempMinC: number;
    tempMaxC: number;
    precipitationSumMm: number;
    precipitationProbabilityMax: number;
    windSpeedMaxKmh: number;
    sunrise: string;
    sunset: string;
    uvIndexMax: number;
  };
  hourly: Array<{
    time: string;
    temperatureC: number;
    precipitationProbability: number;
    precipitationMm: number;
    windSpeedKmh: number;
  }>;
  daily: Array<{
    date: string;
    tempMinC: number;
    tempMaxC: number;
    precipitationSumMm: number;
    precipitationProbabilityMax: number;
    windSpeedMaxKmh: number;
    weatherCode: number;
    condition: string;
    sunrise: string;
    sunset: string;
    uvIndexMax: number;
  }>;
  fetchedAt: string;
};

export type WeatherResult = {
  snapshot: WeatherSnapshot;
  location: {
    state: string | null;
    district: string | null;
    block: string | null;
    latitude: number;
    longitude: number;
  };
  cached: boolean;
  stale: boolean;
  cacheAgeMinutes: number;
};

export type WeatherSettings = {
  enabled: boolean;
  cacheMinutes: number;
  heavyRainMm: number;
  heatWaveC: number;
  coldWaveC: number;
  frostC: number;
  strongWindKmh: number;
  sprayRainProbMax: number;
  sprayWindMaxKmh: number;
};

export const DEFAULT_WEATHER_SETTINGS: WeatherSettings = {
  enabled: true,
  cacheMinutes: 30,
  heavyRainMm: 20,
  heatWaveC: 40,
  coldWaveC: 8,
  frostC: 2,
  strongWindKmh: 40,
  sprayRainProbMax: 60,
  sprayWindMaxKmh: 20,
};

/** WMO weather code → human label */
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  56: "Freezing drizzle",
  57: "Freezing dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  66: "Freezing rain",
  67: "Heavy freezing rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Heavy rain showers",
  82: "Violent rain showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Thunderstorm w/ heavy hail",
};

export function wmoLabel(code: number): string {
  return WMO_CODES[code] ?? "Unknown";
}

function makeAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function locationKey(
  state: string | null | undefined,
  district: string | null | undefined,
  block?: string | null,
): string {
  return [state, district, block]
    .map((s) => (s ?? "").trim().toLowerCase())
    .join("|");
}

/** Load admin-configurable weather settings (falls back to defaults). */
export async function loadWeatherSettings(): Promise<WeatherSettings> {
  const client = makeAdminClient();
  if (!client) return DEFAULT_WEATHER_SETTINGS;
  const { data, error } = await client
    .from("weather_settings")
    .select(
      "enabled, cache_minutes, heavy_rain_mm, heat_wave_c, cold_wave_c, frost_c, strong_wind_kmh, spray_rain_prob_max, spray_wind_max_kmh",
    )
    .eq("id", "global")
    .maybeSingle();
  if (error || !data) return DEFAULT_WEATHER_SETTINGS;
  const d = data as Record<string, unknown>;
  return {
    enabled: (d.enabled as boolean) ?? true,
    cacheMinutes: Number(d.cache_minutes ?? 30),
    heavyRainMm: Number(d.heavy_rain_mm ?? 20),
    heatWaveC: Number(d.heat_wave_c ?? 40),
    coldWaveC: Number(d.cold_wave_c ?? 8),
    frostC: Number(d.frost_c ?? 2),
    strongWindKmh: Number(d.strong_wind_kmh ?? 40),
    sprayRainProbMax: Number(d.spray_rain_prob_max ?? 60),
    sprayWindMaxKmh: Number(d.spray_wind_max_kmh ?? 20),
  };
}

/** Geocode via OpenStreetMap Nominatim (free, no key). Cached in weather_cache. */
async function geocode(
  state: string | null,
  district: string | null,
  block: string | null,
): Promise<{ lat: number; lon: number } | null> {
  const parts = [block, district, state, "India"].filter(Boolean).join(", ");
  if (!parts) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(parts)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Ajrasakha/1.0 (farmer-advisory)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr.length) return null;
    const first = arr[0];
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch (err) {
    console.error("[weather] geocode failed", err);
    return null;
  }
}

/** Call Open-Meteo forecast API. */
async function fetchOpenMeteo(
  lat: number,
  lon: number,
): Promise<WeatherSnapshot | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    "&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,weather_code,wind_speed_10m,wind_direction_10m,uv_index" +
    "&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m" +
    "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset,uv_index_max" +
    "&timezone=auto&forecast_days=7&wind_speed_unit=kmh";
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j = (await res.json()) as {
      timezone: string;
      current: Record<string, number | string>;
      hourly: Record<string, Array<number | string>>;
      daily: Record<string, Array<number | string>>;
    };
    const c = j.current;
    const daily = j.daily;
    const hourly = j.hourly;
    const nowIso = new Date().toISOString();

    const hourlyOut = (hourly.time as string[]).slice(0, 24).map((t, i) => ({
      time: t,
      temperatureC: Number(hourly.temperature_2m?.[i] ?? 0),
      precipitationProbability: Number(hourly.precipitation_probability?.[i] ?? 0),
      precipitationMm: Number(hourly.precipitation?.[i] ?? 0),
      windSpeedKmh: Number(hourly.wind_speed_10m?.[i] ?? 0),
    }));

    const dailyOut = (daily.time as string[]).map((t, i) => {
      const code = Number(daily.weather_code?.[i] ?? 0);
      return {
        date: t,
        tempMinC: Number(daily.temperature_2m_min?.[i] ?? 0),
        tempMaxC: Number(daily.temperature_2m_max?.[i] ?? 0),
        precipitationSumMm: Number(daily.precipitation_sum?.[i] ?? 0),
        precipitationProbabilityMax: Number(
          daily.precipitation_probability_max?.[i] ?? 0,
        ),
        windSpeedMaxKmh: Number(daily.wind_speed_10m_max?.[i] ?? 0),
        weatherCode: code,
        condition: wmoLabel(code),
        sunrise: String(daily.sunrise?.[i] ?? ""),
        sunset: String(daily.sunset?.[i] ?? ""),
        uvIndexMax: Number(daily.uv_index_max?.[i] ?? 0),
      };
    });

    const code = Number(c.weather_code ?? 0);
    return {
      latitude: lat,
      longitude: lon,
      timezone: j.timezone,
      current: {
        temperatureC: Number(c.temperature_2m ?? 0),
        feelsLikeC: Number(c.apparent_temperature ?? 0),
        humidity: Number(c.relative_humidity_2m ?? 0),
        rainMm: Number(c.rain ?? c.precipitation ?? 0),
        windSpeedKmh: Number(c.wind_speed_10m ?? 0),
        windDirectionDeg: Number(c.wind_direction_10m ?? 0),
        weatherCode: code,
        condition: wmoLabel(code),
        isDay: Number(c.is_day ?? 1) === 1,
        uvIndex: Number(c.uv_index ?? dailyOut[0]?.uvIndexMax ?? 0),
      },
      today: {
        tempMinC: dailyOut[0]?.tempMinC ?? 0,
        tempMaxC: dailyOut[0]?.tempMaxC ?? 0,
        precipitationSumMm: dailyOut[0]?.precipitationSumMm ?? 0,
        precipitationProbabilityMax:
          dailyOut[0]?.precipitationProbabilityMax ?? 0,
        windSpeedMaxKmh: dailyOut[0]?.windSpeedMaxKmh ?? 0,
        sunrise: dailyOut[0]?.sunrise ?? "",
        sunset: dailyOut[0]?.sunset ?? "",
        uvIndexMax: dailyOut[0]?.uvIndexMax ?? 0,
      },
      hourly: hourlyOut,
      daily: dailyOut,
      fetchedAt: nowIso,
    };
  } catch (err) {
    console.error("[weather] open-meteo failed", err);
    return null;
  }
}

/**
 * Get weather for a location, using cache first. If cache is fresh
 * (< cacheMinutes) returns immediately. Otherwise fetches Open-Meteo,
 * updates cache, and returns fresh data. On upstream failure returns
 * the last cached snapshot (marked `stale: true`) so chat never breaks.
 */
export async function getWeatherForLocation(opts: {
  state: string | null;
  district: string | null;
  block?: string | null;
  forceRefresh?: boolean;
}): Promise<WeatherResult | null> {
  const { state, district, block = null, forceRefresh = false } = opts;
  if (!district && !state) return null;

  const settings = await loadWeatherSettings();
  if (!settings.enabled) return null;

  const key = locationKey(state, district, block);
  const admin = makeAdminClient();
  if (!admin) {
    const geo = await geocode(state, district, block);
    if (!geo) return null;
    const snapshot = await fetchOpenMeteo(geo.lat, geo.lon);
    if (!snapshot) return null;
    return {
      snapshot,
      location: {
        state,
        district,
        block,
        latitude: geo.lat,
        longitude: geo.lon,
      },
      cached: false,
      stale: false,
      cacheAgeMinutes: 0,
    };
  }

  const { data: cachedRow } = await admin
    .from("weather_cache")
    .select("latitude, longitude, weather, fetched_at")
    .eq("location_key", key)
    .maybeSingle();

  const cached = cachedRow as
    | {
        latitude: number | null;
        longitude: number | null;
        weather: WeatherSnapshot | Record<string, never>;
        fetched_at: string;
      }
    | null;

  const cacheAgeMinutes = cached
    ? Math.floor((Date.now() - new Date(cached.fetched_at).getTime()) / 60000)
    : Infinity;
  const fresh = cacheAgeMinutes < settings.cacheMinutes;

  if (
    !forceRefresh &&
    fresh &&
    cached?.weather &&
    typeof cached.weather === "object" &&
    "current" in cached.weather
  ) {
    return {
      snapshot: cached.weather as WeatherSnapshot,
      location: {
        state,
        district,
        block,
        latitude: cached.latitude ?? 0,
        longitude: cached.longitude ?? 0,
      },
      cached: true,
      stale: false,
      cacheAgeMinutes,
    };
  }

  // Resolve coordinates (reuse cached lat/lon if present).
  let lat = cached?.latitude ?? null;
  let lon = cached?.longitude ?? null;
  if (lat == null || lon == null) {
    const geo = await geocode(state, district, block);
    if (!geo) {
      // Cannot geocode — return stale cache if any, else null.
      if (cached?.weather && "current" in cached.weather) {
        return {
          snapshot: cached.weather as WeatherSnapshot,
          location: {
            state,
            district,
            block,
            latitude: 0,
            longitude: 0,
          },
          cached: true,
          stale: true,
          cacheAgeMinutes,
        };
      }
      return null;
    }
    lat = geo.lat;
    lon = geo.lon;
  }

  const snapshot = await fetchOpenMeteo(lat, lon);
  if (!snapshot) {
    // Upstream down — serve stale cache.
    if (cached?.weather && "current" in cached.weather) {
      return {
        snapshot: cached.weather as WeatherSnapshot,
        location: {
          state,
          district,
          block,
          latitude: lat,
          longitude: lon,
        },
        cached: true,
        stale: true,
        cacheAgeMinutes,
      };
    }
    return null;
  }

  // Upsert cache (fire-and-forget shouldn't block, but await for consistency).
  await admin.from("weather_cache").upsert(
    {
      location_key: key,
      state,
      district,
      block,
      latitude: lat,
      longitude: lon,
      weather: snapshot as unknown as Record<string, unknown>,
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "location_key" },
  );

  return {
    snapshot,
    location: { state, district, block, latitude: lat, longitude: lon },
    cached: false,
    stale: false,
    cacheAgeMinutes: 0,
  };
}

/** Build a compact, model-friendly weather context block for the system prompt. */
export function buildWeatherPromptBlock(w: WeatherResult): string {
  const s = w.snapshot;
  const loc = [w.location.district, w.location.state].filter(Boolean).join(", ");
  const next24Rain = Math.max(
    ...s.hourly.slice(0, 24).map((h) => h.precipitationProbability),
  );
  return [
    `LIVE WEATHER (via Open-Meteo, ${w.stale ? "STALE cache" : "fresh"}, ${w.cacheAgeMinutes}m old):`,
    `- Location: ${loc || "(unknown)"}${w.location.latitude ? ` (${w.location.latitude.toFixed(2)}, ${w.location.longitude.toFixed(2)})` : ""}`,
    `- Current: ${s.current.temperatureC.toFixed(1)}°C (feels ${s.current.feelsLikeC.toFixed(1)}°C), ${s.current.condition}, humidity ${s.current.humidity}%, wind ${s.current.windSpeedKmh.toFixed(0)} km/h, UV ${s.current.uvIndex.toFixed(1)}`,
    `- Today: min ${s.today.tempMinC.toFixed(0)}°C / max ${s.today.tempMaxC.toFixed(0)}°C, rain probability max ${s.today.precipitationProbabilityMax}%, rainfall ${s.today.precipitationSumMm.toFixed(1)} mm, max wind ${s.today.windSpeedMaxKmh.toFixed(0)} km/h`,
    `- Sunrise ${s.today.sunrise.slice(11, 16)}, sunset ${s.today.sunset.slice(11, 16)}`,
    `- Next 24h peak rain probability: ${next24Rain}%`,
    `- 3-day outlook: ${s.daily
      .slice(0, 3)
      .map(
        (d) =>
          `${d.date}: ${d.condition}, ${d.tempMinC.toFixed(0)}-${d.tempMaxC.toFixed(0)}°C, rain ${d.precipitationProbabilityMax}%`,
      )
      .join(" | ")}`,
  ].join("\n");
}

/** Exact response requirements for weather-sensitive answers. */
export function buildWeatherAnswerRequirementsBlock(w: WeatherResult): string {
  const s = w.snapshot;
  const loc = [w.location.district, w.location.state].filter(Boolean).join(", ");
  return [
    "WEATHER-AWARE ANSWER REQUIREMENTS (mandatory):",
    `- Start the response by citing: According to today's live weather in ${loc || "the farmer's region"}:`,
    `- Temperature: ${s.current.temperatureC.toFixed(0)}°C`,
    `- Humidity: ${s.current.humidity}%`,
    `- Rain Probability: ${s.today.precipitationProbabilityMax}%`,
    `- Rainfall: ${s.today.precipitationSumMm.toFixed(1)} mm`,
    `- Wind Speed: ${s.current.windSpeedKmh.toFixed(0)} km/h`,
    "- Never say or imply 'check the weather forecast' because the live weather values above are already available.",
    "- The recommendation must be based on these exact live values, not generic weather advice.",
  ].join("\n");
}

/** Deterministic response prefix that guarantees live weather values reach the farmer. */
export function buildWeatherAnswerPrefix(w: WeatherResult): string {
  const s = w.snapshot;
  const loc = [w.location.district, w.location.state].filter(Boolean).join(", ");
  return [
    `According to today's live weather in ${loc || "your region"}:`,
    "",
    `• Temperature: ${s.current.temperatureC.toFixed(0)}°C`,
    `• Humidity: ${s.current.humidity}%`,
    `• Rain Probability: ${s.today.precipitationProbabilityMax}%`,
    `• Rainfall: ${s.today.precipitationSumMm.toFixed(1)} mm`,
    `• Wind Speed: ${s.current.windSpeedKmh.toFixed(0)} km/h`,
    "",
  ].join("\n");
}

/** Deterministic recommendation used as a fallback when the AI response is empty
 *  or the model errors mid-stream (e.g. quota exceeded). Guarantees the farmer
 *  always receives an actionable answer after the live weather values. */
export function buildSprayRecommendationFallback(
  w: WeatherResult,
  settings: WeatherSettings,
): string {
  const s = w.snapshot;
  const rainProb = s.today.precipitationProbabilityMax;
  const rainfall = s.today.precipitationSumMm;
  const wind = s.current.windSpeedKmh;
  const maxWind = s.today.windSpeedMaxKmh;

  const reasons: string[] = [];
  let verdict: "avoid" | "caution" | "ok" = "ok";
  if (rainProb > settings.sprayRainProbMax) {
    verdict = "avoid";
    reasons.push(
      `heavy rain likely (${rainProb}% probability, ~${rainfall.toFixed(1)} mm expected) — pesticide will wash off before it can act`,
    );
  }
  if (maxWind > settings.sprayWindMaxKmh) {
    if (verdict !== "avoid") verdict = "avoid";
    reasons.push(
      `wind is too strong (up to ${maxWind.toFixed(0)} km/h today) — spray will drift and harm nearby crops`,
    );
  }
  if (verdict === "ok" && rainProb >= 40) {
    verdict = "caution";
    reasons.push(
      `moderate rain chance (${rainProb}%) — spray only if the sky stays clear for 4-6 hours after application`,
    );
  }

  const goodWindow = s.hourly.slice(0, 24).find((h) => {
    const hour = new Date(h.time).getHours();
    return (
      ((hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 19)) &&
      h.precipitationProbability < settings.sprayRainProbMax &&
      h.windSpeedKmh < settings.sprayWindMaxKmh
    );
  });

  const lines: string[] = ["**Recommendation:**", ""];
  if (verdict === "avoid") {
    lines.push("❌ Do NOT spray today.");
  } else if (verdict === "caution") {
    lines.push("⚠️ Spraying is risky today — proceed only with caution.");
  } else {
    lines.push("✅ Conditions are acceptable for spraying today.");
  }
  lines.push("");
  lines.push("**Reason:**");
  if (reasons.length) {
    for (const r of reasons) lines.push(`- ${r}`);
  } else {
    lines.push(
      `- Rain probability ${rainProb}%, wind ${wind.toFixed(0)} km/h — within safe thresholds (rain < ${settings.sprayRainProbMax}%, wind < ${settings.sprayWindMaxKmh} km/h).`,
    );
  }
  lines.push("");
  lines.push("**Best time:**");
  if (goodWindow) {
    const when = new Date(goodWindow.time).toLocaleString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    });
    lines.push(
      `- ${when} — rain ${goodWindow.precipitationProbability}%, wind ${goodWindow.windSpeedKmh.toFixed(0)} km/h. Spray early morning (5-9 AM) or late afternoon (5-7 PM) when wind is calmest.`,
    );
  } else {
    lines.push(
      "- Wait until conditions improve. Prefer early morning (5-9 AM) or late afternoon (5-7 PM) on a dry day with wind under 15 km/h.",
    );
  }
  lines.push("");
  lines.push(
    "_This guidance is based on today's live weather. Confirm chemical choice and dosage with your local agricultural officer._",
  );
  return lines.join("\n");
}

/** Detect if a farmer question is about spraying pesticide/fungicide/fertiliser. */
export function isSprayQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return /(spray|spraying|pesticide|insecticide|fungicide|herbicide|weedicide|छिड़काव|छिड़क|स्प्रे|कीटनाशक|फफूंदनाशक|खरपतवारनाशक)/i.test(
    t,
  );
}

/** Build a spray-specific advisory rule block from live weather + thresholds. */
export function buildSprayAdvisoryBlock(
  w: WeatherResult,
  settings: WeatherSettings,
): string {
  const s = w.snapshot;
  const rainProb = s.today.precipitationProbabilityMax;
  const wind = s.today.windSpeedMaxKmh;
  const bullets: string[] = [];
  if (rainProb > settings.sprayRainProbMax) {
    bullets.push(
      `- Rain probability today is ${rainProb}% (threshold ${settings.sprayRainProbMax}%). STRONGLY advise POSTPONING spraying — rain within a few hours will wash off chemicals.`,
    );
  }
  if (wind > settings.sprayWindMaxKmh) {
    bullets.push(
      `- Max wind today is ${wind.toFixed(0)} km/h (threshold ${settings.sprayWindMaxKmh} km/h). Advise AGAINST spraying — drift will reduce effectiveness and harm nearby crops.`,
    );
  }
  // Recommend a spray window: prefer early morning (5-9) or evening (17-19) with low rain prob & wind.
  const goodWindow = s.hourly
    .slice(0, 24)
    .find((h) => {
      const hour = new Date(h.time).getHours();
      return (
        (hour >= 5 && hour <= 9) || (hour >= 17 && hour <= 19)
      ) &&
        h.precipitationProbability < settings.sprayRainProbMax &&
        h.windSpeedKmh < settings.sprayWindMaxKmh;
    });
  if (goodWindow) {
    bullets.push(
      `- Best spray window in the next 24h: ${new Date(goodWindow.time).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", weekday: "short" })} (rain ${goodWindow.precipitationProbability}%, wind ${goodWindow.windSpeedKmh.toFixed(0)} km/h).`,
    );
  }
  if (bullets.length === 0) {
    bullets.push(
      "- Current conditions look acceptable for spraying. Prefer early morning or late afternoon when wind is calmer.",
    );
  }
  return `SPRAY ADVISORY RULES (apply these strictly, cite the numbers):\n${bullets.join("\n")}`;
}

/** Compute active weather alerts based on thresholds. */
export type WeatherAlert = {
  kind: "heavy_rain" | "heat_wave" | "cold_wave" | "frost" | "thunderstorm" | "strong_wind";
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
};

export function computeAlerts(
  w: WeatherSnapshot,
  s: WeatherSettings,
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const code = w.current.weatherCode;
  if (w.today.precipitationSumMm >= s.heavyRainMm) {
    alerts.push({
      kind: "heavy_rain",
      severity: "warning",
      title: "Heavy rain expected",
      message: `Rainfall today: ${w.today.precipitationSumMm.toFixed(1)} mm. Ensure drainage in fields and avoid spraying.`,
    });
  }
  if (w.today.tempMaxC >= s.heatWaveC) {
    alerts.push({
      kind: "heat_wave",
      severity: "danger",
      title: "Heat wave alert",
      message: `Max temperature ${w.today.tempMaxC.toFixed(0)}°C. Irrigate early morning or evening; watch livestock for heat stress.`,
    });
  }
  if (w.today.tempMinC <= s.coldWaveC) {
    alerts.push({
      kind: "cold_wave",
      severity: "warning",
      title: "Cold wave alert",
      message: `Min temperature ${w.today.tempMinC.toFixed(0)}°C. Protect young plants and irrigate lightly in the evening.`,
    });
  }
  if (w.today.tempMinC <= s.frostC) {
    alerts.push({
      kind: "frost",
      severity: "danger",
      title: "Frost risk",
      message: `Minimum temperature is near ${w.today.tempMinC.toFixed(0)}°C. Cover seedlings; smoke fires help in orchards.`,
    });
  }
  if (w.today.windSpeedMaxKmh >= s.strongWindKmh) {
    alerts.push({
      kind: "strong_wind",
      severity: "warning",
      title: "Strong winds",
      message: `Winds up to ${w.today.windSpeedMaxKmh.toFixed(0)} km/h. Postpone spraying and secure lightweight structures.`,
    });
  }
  if (code >= 95 && code <= 99) {
    alerts.push({
      kind: "thunderstorm",
      severity: "danger",
      title: "Thunderstorm",
      message: "Thunderstorm in the area. Avoid open fields and secure equipment.",
    });
  }
  return alerts;
}

export async function saveWeatherSettings(
  next: WeatherSettings,
): Promise<void> {
  const client = makeAdminClient();
  if (!client) throw new Error("Weather settings unavailable");
  const { error } = await client
    .from("weather_settings")
    .update({
      enabled: next.enabled,
      cache_minutes: next.cacheMinutes,
      heavy_rain_mm: next.heavyRainMm,
      heat_wave_c: next.heatWaveC,
      cold_wave_c: next.coldWaveC,
      frost_c: next.frostC,
      strong_wind_kmh: next.strongWindKmh,
      spray_rain_prob_max: next.sprayRainProbMax,
      spray_wind_max_kmh: next.sprayWindMaxKmh,
    })
    .eq("id", "global");
  if (error) throw error;
}

export async function listCacheEntries(): Promise<
  Array<{
    location_key: string;
    state: string | null;
    district: string | null;
    fetched_at: string;
    ageMinutes: number;
  }>
> {
  const client = makeAdminClient();
  if (!client) return [];
  const { data } = await client
    .from("weather_cache")
    .select("location_key, state, district, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(50);
  return ((data as Array<{
    location_key: string;
    state: string | null;
    district: string | null;
    fetched_at: string;
  }> | null) ?? []).map((r) => ({
    ...r,
    ageMinutes: Math.floor((Date.now() - new Date(r.fetched_at).getTime()) / 60000),
  }));
}