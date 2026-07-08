import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  clearWeatherCache,
  getWeatherAdmin,
  updateWeatherAdmin,
} from "@/lib/weather.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CloudSun, RefreshCw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/weather")({
  ssr: false,
  component: AdminWeatherPage,
});

type Settings = Awaited<ReturnType<typeof getWeatherAdmin>>["settings"];
type CacheRow = Awaited<ReturnType<typeof getWeatherAdmin>>["cache"][number];

function AdminWeatherPage() {
  const load = useServerFn(getWeatherAdmin);
  const save = useServerFn(updateWeatherAdmin);
  const clear = useServerFn(clearWeatherCache);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [cache, setCache] = useState<CacheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await load({});
      setSettings(r.settings);
      setCache(r.cache);
    } catch (err) {
      toast.error("Failed to load weather settings");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = <K extends keyof Settings>(k: K, v: Settings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [k]: v });
  };

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await save({ data: settings });
      toast.success("Weather settings saved");
    } catch (err) {
      toast.error((err as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleClearCache() {
    if (!confirm("Clear all cached weather? Farmers will trigger a fresh fetch.")) return;
    try {
      await clear({});
      toast.success("Cache cleared");
      refresh();
    } catch {
      toast.error("Failed to clear cache");
    }
  }

  if (loading || !settings) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Weather Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure the live weather integration (Open-Meteo, no API key required).
        </p>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CloudSun className="size-5 text-primary" /> Integration
          </CardTitle>
          <CardDescription>Enable or disable weather across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Live weather enabled</div>
              <p className="text-xs text-muted-foreground">
                When off, the dashboard card and AI prompts skip live weather.
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => update("enabled", v)}
            />
          </div>
          <NumberField
            label="Cache duration (minutes)"
            value={settings.cacheMinutes}
            onChange={(v) => update("cacheMinutes", v)}
            min={5}
            max={720}
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Alert thresholds</CardTitle>
          <CardDescription>Trigger banners and prompt warnings when values are met.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Heavy rain (mm/day)" value={settings.heavyRainMm} onChange={(v) => update("heavyRainMm", v)} />
          <NumberField label="Heat wave (°C max)" value={settings.heatWaveC} onChange={(v) => update("heatWaveC", v)} />
          <NumberField label="Cold wave (°C min)" value={settings.coldWaveC} onChange={(v) => update("coldWaveC", v)} />
          <NumberField label="Frost (°C min)" value={settings.frostC} onChange={(v) => update("frostC", v)} />
          <NumberField label="Strong wind (km/h)" value={settings.strongWindKmh} onChange={(v) => update("strongWindKmh", v)} />
          <NumberField label="Spray max rain probability (%)" value={settings.sprayRainProbMax} onChange={(v) => update("sprayRainProbMax", v)} />
          <NumberField label="Spray max wind (km/h)" value={settings.sprayWindMaxKmh} onChange={(v) => update("sprayWindMaxKmh", v)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="size-4 animate-spin" /> : null}
          Save settings
        </Button>
        <Button variant="outline" onClick={handleClearCache} className="gap-2">
          <Trash2 className="size-4" /> Clear weather cache
        </Button>
        <Button variant="outline" onClick={refresh} className="gap-2">
          <RefreshCw className="size-4" /> Reload
        </Button>
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cache status ({cache.length})</CardTitle>
          <CardDescription>Most recent cached districts.</CardDescription>
        </CardHeader>
        <CardContent>
          {cache.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet. As farmers open the dashboard, coordinates and weather are cached here.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">District</th>
                    <th className="py-2 pr-4">State</th>
                    <th className="py-2 pr-4">Last fetched</th>
                    <th className="py-2 pr-4">Age</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cache.map((c) => (
                    <tr key={c.location_key}>
                      <td className="py-2 pr-4 font-medium">{c.district ?? "—"}</td>
                      <td className="py-2 pr-4">{c.state ?? "—"}</td>
                      <td className="py-2 pr-4">{new Date(c.fetched_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{c.ageMinutes}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </div>
  );
}