import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  forceRefreshMyWeather,
  getWeatherForMe,
} from "@/lib/weather.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CloudSun,
  Droplets,
  Wind,
  RefreshCw,
  Sun,
  Sunrise,
  Sunset,
  MapPin,
  Thermometer,
  CloudRain,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type WeatherAlert = {
  kind: string;
  severity: "info" | "warning" | "danger";
  title: string;
  message: string;
};

type WeatherResp = Awaited<ReturnType<typeof getWeatherForMe>>;

function ageLabel(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function WeatherCard() {
  const load = useServerFn(getWeatherForMe);
  const refresh = useServerFn(forceRefreshMyWeather);
  const [data, setData] = useState<WeatherResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNow = useCallback(async () => {
    try {
      const r = await load({});
      setData(r);
    } catch (err) {
      console.error("[weather-card] load failed", err);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    fetchNow();
    // Refresh every 30 minutes while the dashboard is open.
    const id = window.setInterval(fetchNow, 30 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [fetchNow]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh({});
      await fetchNow();
      toast.success("Weather refreshed");
    } catch {
      toast.error("Couldn't refresh weather");
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSun className="size-5 text-[color:var(--harvest)]" />
            Weather today
          </CardTitle>
          <CardDescription>Loading live conditions…</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.ok) {
    const msg =
      data?.reason === "no-location"
        ? "Add your state and district in your profile to see live weather."
        : data?.reason === "disabled"
          ? "Weather integration is currently disabled by the admin."
          : "Live weather is temporarily unavailable. Advisories continue as normal.";
    return (
      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSun className="size-5 text-[color:var(--harvest)]" />
            Weather today
          </CardTitle>
          <CardDescription>{msg}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { result, alerts } = data;
  const s = result.snapshot.current;
  const t = result.snapshot.today;
  const loc =
    [result.location.district, result.location.state]
      .filter(Boolean)
      .join(", ") || "Your area";

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSun className="size-5 text-[color:var(--harvest)]" />
            Weather today
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
        <CardDescription className="flex items-center gap-1.5">
          <MapPin className="size-3.5" /> {loc} · updated{" "}
          {ageLabel(result.cacheAgeMinutes)}
          {result.stale && (
            <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-300">
              Cached
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.length > 0 && <WeatherAlerts alerts={alerts as WeatherAlert[]} />}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="font-display text-4xl font-bold">
              {s.temperatureC.toFixed(0)}°C
            </div>
            <div className="text-sm text-muted-foreground">
              {s.condition} · feels {s.feelsLikeC.toFixed(0)}°C
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Metric icon={<Droplets className="size-4 text-primary" />} label="Humidity" value={`${s.humidity}%`} />
            <Metric icon={<Wind className="size-4 text-primary" />} label="Wind" value={`${s.windSpeedKmh.toFixed(0)} km/h`} />
            <Metric icon={<CloudRain className="size-4 text-primary" />} label="Rain" value={`${t.precipitationProbabilityMax}%`} />
            <Metric icon={<Sun className="size-4 text-primary" />} label="UV" value={s.uvIndex.toFixed(1)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-muted/60 p-3 text-xs sm:grid-cols-4">
          <MiniStat icon={<Thermometer className="size-3.5" />} label="Min/Max" value={`${t.tempMinC.toFixed(0)}° / ${t.tempMaxC.toFixed(0)}°`} />
          <MiniStat icon={<CloudRain className="size-3.5" />} label="Rainfall" value={`${t.precipitationSumMm.toFixed(1)} mm`} />
          <MiniStat icon={<Sunrise className="size-3.5" />} label="Sunrise" value={t.sunrise.slice(11, 16) || "—"} />
          <MiniStat icon={<Sunset className="size-3.5" />} label="Sunset" value={t.sunset.slice(11, 16) || "—"} />
        </div>
        <p className="text-[11px] text-muted-foreground">
          Data · Open-Meteo (free, no API key). Cache updates every 30 min.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium">{value}</span>
    </div>
  );
}

function MiniStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

export function WeatherAlerts({ alerts }: { alerts: WeatherAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="space-y-2">
      {alerts.map((a, i) => {
        const tone =
          a.severity === "danger"
            ? "border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-200"
            : a.severity === "warning"
              ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
              : "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
        return (
          <div
            key={i}
            className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", tone)}
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">{a.title}</div>
              <div className="opacity-90">{a.message}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}