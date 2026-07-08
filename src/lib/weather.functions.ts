import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Weather for the currently signed-in farmer (based on their profile). */
export const getWeatherForMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("state, district, block")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.state && !profile?.district) {
      return { ok: false as const, reason: "no-location" as const };
    }
    const {
      getWeatherForLocation,
      computeAlerts,
      loadWeatherSettings,
    } = await import("./weather.server");
    const settings = await loadWeatherSettings();
    if (!settings.enabled) {
      return { ok: false as const, reason: "disabled" as const };
    }
    const result = await getWeatherForLocation({
      state: profile.state ?? null,
      district: profile.district ?? null,
      block: profile.block ?? null,
    });
    if (!result) return { ok: false as const, reason: "unavailable" as const };
    return {
      ok: true as const,
      result,
      alerts: computeAlerts(result.snapshot, settings),
    };
  });

export const forceRefreshMyWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("state, district, block")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return { ok: false as const };
    const { getWeatherForLocation } = await import("./weather.server");
    const result = await getWeatherForLocation({
      state: profile.state ?? null,
      district: profile.district ?? null,
      block: profile.block ?? null,
      forceRefresh: true,
    });
    return { ok: Boolean(result) };
  });

/** Admin: load current weather settings + cache overview. */
export const getWeatherAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!adminCheck) throw new Error("Forbidden");
    const { loadWeatherSettings, listCacheEntries } = await import(
      "./weather.server"
    );
    const [settings, cache] = await Promise.all([
      loadWeatherSettings(),
      listCacheEntries(),
    ]);
    return { settings, cache };
  });

/** Admin: update weather settings. */
export const updateWeatherAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    enabled: boolean;
    cacheMinutes: number;
    heavyRainMm: number;
    heatWaveC: number;
    coldWaveC: number;
    frostC: number;
    strongWindKmh: number;
    sprayRainProbMax: number;
    sprayWindMaxKmh: number;
  }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!adminCheck) throw new Error("Forbidden");
    const { saveWeatherSettings } = await import("./weather.server");
    await saveWeatherSettings(data);
    return { ok: true };
  });

/** Admin: clear the weather cache. */
export const clearWeatherCache = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: adminCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!adminCheck) throw new Error("Forbidden");
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    await supabaseAdmin.from("weather_cache").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    return { ok: true };
  });