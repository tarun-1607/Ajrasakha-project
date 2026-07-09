import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FarmMap } from "@/components/ajrasakha/farm-map";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Sprout,
  Loader2,
  Save,
  Upload,
  Camera,
  Settings,
  Navigation,
  BookOpen,
  Compass,
} from "lucide-react";
import { useLanguage } from "@/hooks/use-language";

export const Route = createFileRoute("/_authenticated/profile")({
  ssr: false,
  component: ProfilePage,
});

const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi", "Malayalam"];
const CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Pulses", "Vegetables", "Fruits", "Coffee", "Tea", "Mustard", "Soybean", "Millets", "Other"];
const SOIL_TYPES = ["Alluvial", "Black", "Red", "Laterite", "Desert/Sandy", "Clayey", "Loamy", "Other"];
const IRRIGATION_TYPES = ["Rain-fed", "Drip Irrigation", "Sprinkler Irrigation", "Canal Irrigation", "Borewell / Well", "Mixed", "Other"];
const FARMING_METHODS = ["Organic", "Conventional", "Natural Farming", "Precision Farming", "Mixed Farming", "Other"];
const SEASONS = ["Kharif", "Rabi", "Zaid", "Year-round"];
const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

interface ProfileFormState {
  // Database fields
  fullName: string;
  email: string;
  state: string;
  district: string;
  block: string;
  village: string;
  preferredLanguage: string;
  primaryCrop: string;
  farmSize: string;
  soilType: string;
  irrigationType: string;
  currentSeason: string;

  // Local storage (extra fields)
  mobileNumber: string;
  dateOfBirth: string;
  gender: string;
  secondaryCrop: string;
  yearsOfExperience: string;
  farmingMethod: string;
  latitude: number;
  longitude: number;
  bio: string;
  favouriteCrops: string;
  farmPhoto: string;
  weatherAlerts: boolean;
  smsNotifications: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

const defaultState: ProfileFormState = {
  fullName: "",
  email: "",
  state: "",
  district: "",
  block: "",
  village: "",
  preferredLanguage: "English",
  primaryCrop: "Rice",
  farmSize: "",
  soilType: "Alluvial",
  irrigationType: "Rain-fed",
  currentSeason: "Kharif",
  mobileNumber: "",
  dateOfBirth: "",
  gender: "Prefer not to say",
  secondaryCrop: "Wheat",
  yearsOfExperience: "",
  farmingMethod: "Organic",
  latitude: 12.9716,
  longitude: 77.5946,
  bio: "",
  favouriteCrops: "",
  farmPhoto: "",
  weatherAlerts: true,
  smsNotifications: true,
  emailNotifications: false,
  pushNotifications: true,
};

function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ProfileFormState>(defaultState);
  const [userId, setUserId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes.user;
        if (!user) {
          navigate({ to: "/auth" });
          return;
        }
        if (alive) {
          setUserId(user.id);
        }

        // Fetch DB profile
        const { data: dbProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        // Fetch extra fields from local storage
        let extraData: Partial<ProfileFormState> = {};
        try {
          const stored = localStorage.getItem(`profile_extra_${user.id}`);
          if (stored) {
            extraData = JSON.parse(stored);
          }
        } catch (err) {
          console.error("Failed to parse profile extra fields:", err);
        }

        if (alive) {
          setForm({
            fullName: dbProfile?.full_name || "",
            email: dbProfile?.email || user.email || "",
            state: dbProfile?.state || "",
            district: dbProfile?.district || "",
            block: dbProfile?.block || "",
            village: dbProfile?.village || "",
            preferredLanguage: dbProfile?.preferred_language || "English",
            primaryCrop: dbProfile?.primary_crop || "Rice",
            farmSize: dbProfile?.farm_size || "",
            soilType: dbProfile?.soil_type || "Alluvial",
            irrigationType: dbProfile?.irrigation_type || "Rain-fed",
            currentSeason: dbProfile?.current_season || "Kharif",
            
            mobileNumber: extraData.mobileNumber || "",
            dateOfBirth: extraData.dateOfBirth || "",
            gender: extraData.gender || "Prefer not to say",
            secondaryCrop: extraData.secondaryCrop || "Wheat",
            yearsOfExperience: extraData.yearsOfExperience || "",
            farmingMethod: extraData.farmingMethod || "Organic",
            latitude: extraData.latitude !== undefined ? extraData.latitude : 12.9716,
            longitude: extraData.longitude !== undefined ? extraData.longitude : 77.5946,
            bio: extraData.bio || "",
            favouriteCrops: extraData.favouriteCrops || "",
            farmPhoto: extraData.farmPhoto || "",
            weatherAlerts: extraData.weatherAlerts !== undefined ? extraData.weatherAlerts : true,
            smsNotifications: extraData.smsNotifications !== undefined ? extraData.smsNotifications : true,
            emailNotifications: extraData.emailNotifications !== undefined ? extraData.emailNotifications : false,
            pushNotifications: extraData.pushNotifications !== undefined ? extraData.pushNotifications : true,
          });
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        toast.error(t("pf.toast.load.failed"));
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, t]);

  const upd = (key: keyof ProfileFormState, val: any) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      toast.info(t("pf.toast.gps.fetching"));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setForm((prev) => ({ ...prev, latitude: lat, longitude: lng }));
          toast.success(t("pf.toast.gps.success"));
        },
        (err) => {
          console.warn("Geolocation query failed:", err.message);
          toast.error(t("pf.toast.gps.failed", { error: err.message }));
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    } else {
      toast.error(t("pf.toast.gps.unsupported"));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("pf.toast.photo.type"));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error(t("pf.toast.photo.size"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        upd("farmPhoto", reader.result);
        toast.success(t("pf.toast.photo.success"));
      }
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) {
      toast.error(t("pf.toast.session.expired"));
      return;
    }

    // Required validation
    if (!form.fullName.trim()) {
      toast.error(t("pf.toast.val.name"));
      return;
    }
    if (!form.state.trim()) {
      toast.error(t("pf.toast.val.state"));
      return;
    }
    if (!form.district.trim()) {
      toast.error(t("pf.toast.val.district"));
      return;
    }

    setSaving(true);

    try {
      // 1. Save to Supabase
      const { error: dbError } = await supabase
        .from("profiles")
        .update({
          full_name: form.fullName.trim(),
          state: form.state.trim(),
          district: form.district.trim(),
          block: form.block.trim(),
          village: form.village.trim(),
          preferred_language: form.preferredLanguage,
          primary_crop: form.primaryCrop,
          farm_size: form.farmSize.trim(),
          soil_type: form.soilType,
          irrigation_type: form.irrigationType,
          current_season: form.currentSeason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (dbError) throw dbError;

      // 2. Save extra fields to localStorage
      const extraFields = {
        mobileNumber: form.mobileNumber.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        secondaryCrop: form.secondaryCrop,
        yearsOfExperience: form.yearsOfExperience.trim(),
        farmingMethod: form.farmingMethod,
        latitude: form.latitude,
        longitude: form.longitude,
        bio: form.bio.trim(),
        favouriteCrops: form.favouriteCrops.trim(),
        farmPhoto: form.farmPhoto,
        weatherAlerts: form.weatherAlerts,
        smsNotifications: form.smsNotifications,
        emailNotifications: form.emailNotifications,
        pushNotifications: form.pushNotifications,
      };

      localStorage.setItem(`profile_extra_${userId}`, JSON.stringify(extraFields));
      
      toast.success(t("pf.toast.save.success"));
    } catch (err) {
      console.error("Error saving profile:", err);
      toast.error(err instanceof Error ? err.message : t("pf.toast.save.failed"));
    } finally {
      setSaving(false);
    }
  };

  // Helper for generating dynamic Crop Calendar values
  const getCropTimelineMonths = (crop: string) => {
    switch (crop.toLowerCase()) {
      case "rice":
        return { sow: "Jun", grow: "Jul - Oct", harvest: "Nov" };
      case "wheat":
        return { sow: "Nov", grow: "Dec - Feb", harvest: "Mar - Apr" };
      case "maize":
        return { sow: "Jun", grow: "Jul - Sep", harvest: "Oct" };
      case "cotton":
        return { sow: "May - Jun", grow: "Jul - Oct", harvest: "Nov - Dec" };
      case "sugarcane":
        return { sow: "Feb - Mar", grow: "Apr - Dec", harvest: "Jan - Mar" };
      case "pulses":
        return { sow: "Oct - Nov", grow: "Dec - Jan", harvest: "Feb" };
      case "mustard":
        return { sow: "Oct", grow: "Nov - Jan", harvest: "Feb - Mar" };
      case "soybean":
        return { sow: "Jun", grow: "Jul - Sep", harvest: "Oct" };
      default:
        return { sow: t("pf.cal.seasonal"), grow: t("pf.cal.varies"), harvest: t("pf.cal.harvestSec") };
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Loader2 className="size-10 animate-spin text-primary" />
        <p className="mt-4 text-sm text-muted-foreground font-display">{t("pf.load.busy")}</p>
      </div>
    );
  }

  const primaryCropTimeline = getCropTimelineMonths(form.primaryCrop);
  const secondaryCropTimeline = getCropTimelineMonths(form.secondaryCrop);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-primary hover:opacity-85 font-semibold text-lg font-display">
              Ajrasakha
            </Link>
            <span className="hidden rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary sm:inline-block">
              {t("pf.title")}
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              <span>{t("pf.back")}</span>
            </Link>
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          
          {/* Left Column: Form Sections */}
          <div className="space-y-6">
            
            {/* Section 1: Personal Information */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <User className="size-4.5 text-primary" />
                  {t("pf.personal.title")}
                </CardTitle>
                <CardDescription>{t("pf.personal.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">{t("pf.personal.name.req")}</Label>
                    <Input
                      id="fullName"
                      required
                      value={form.fullName}
                      onChange={(e) => upd("fullName", e.target.value)}
                      placeholder={t("pf.personal.name.placeholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="mobileNumber">{t("pf.personal.phone")}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="mobileNumber"
                        className="pl-9"
                        value={form.mobileNumber}
                        onChange={(e) => upd("mobileNumber", e.target.value)}
                        placeholder={t("pf.personal.phone.placeholder")}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t("pf.personal.email")}</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        disabled
                        className="pl-9 bg-muted/40 cursor-not-allowed"
                        value={form.email}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dateOfBirth">{t("pf.personal.dob")}</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="dateOfBirth"
                        type="date"
                        className="pl-9"
                        value={form.dateOfBirth}
                        onChange={(e) => upd("dateOfBirth", e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("pf.personal.gender")}</Label>
                    <Select value={form.gender} onValueChange={(v) => upd("gender", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>{t(`gender.${g}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("pf.personal.lang")}</Label>
                    <Select value={form.preferredLanguage} onValueChange={(v) => upd("preferredLanguage", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="border-t border-border/50 my-2 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" /> {t("pf.personal.locTitle")}
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="state">{t("pf.personal.state.req")}</Label>
                      <Input
                        id="state"
                        required
                        value={form.state}
                        onChange={(e) => upd("state", e.target.value)}
                        placeholder={t("pf.personal.state.placeholder")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="district">{t("pf.personal.district.req")}</Label>
                      <Input
                        id="district"
                        required
                        value={form.district}
                        onChange={(e) => upd("district", e.target.value)}
                        placeholder={t("pf.personal.district.placeholder")}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 mt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="block">{t("pf.personal.block")}</Label>
                      <Input
                        id="block"
                        value={form.block}
                        onChange={(e) => upd("block", e.target.value)}
                        placeholder={t("pf.personal.block.placeholder")}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="village">{t("pf.personal.village")}</Label>
                      <Input
                        id="village"
                        value={form.village}
                        onChange={(e) => upd("village", e.target.value)}
                        placeholder={t("pf.personal.village.placeholder")}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Farm Information */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Sprout className="size-4.5 text-primary" />
                  {t("pf.farm.title")}
                </CardTitle>
                <CardDescription>{t("pf.farm.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.primary")}</Label>
                    <Select value={form.primaryCrop} onValueChange={(v) => upd("primaryCrop", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CROPS.map((c) => (
                          <SelectItem key={c} value={c}>{t(`crop.${c}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.secondary")}</Label>
                    <Select value={form.secondaryCrop} onValueChange={(v) => upd("secondaryCrop", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CROPS.map((c) => (
                          <SelectItem key={c} value={c}>{t(`crop.${c}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="farmSize">{t("pf.farm.size")}</Label>
                    <Input
                      id="farmSize"
                      value={form.farmSize}
                      onChange={(e) => upd("farmSize", e.target.value)}
                      placeholder={t("pf.farm.size.placeholder")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="yearsOfExperience">{t("pf.farm.exp")}</Label>
                    <Input
                      id="yearsOfExperience"
                      type="number"
                      value={form.yearsOfExperience}
                      onChange={(e) => upd("yearsOfExperience", e.target.value)}
                      placeholder={t("pf.farm.exp.placeholder")}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.soil")}</Label>
                    <Select value={form.soilType} onValueChange={(v) => upd("soilType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SOIL_TYPES.map((s) => (
                          <SelectItem key={s} value={s}>{t(`soil.${s}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.irrigation")}</Label>
                    <Select value={form.irrigationType} onValueChange={(v) => upd("irrigationType", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IRRIGATION_TYPES.map((i) => (
                          <SelectItem key={i} value={i}>{t(`irrigation.${i}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.method")}</Label>
                    <Select value={form.farmingMethod} onValueChange={(v) => upd("farmingMethod", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FARMING_METHODS.map((f) => (
                          <SelectItem key={f} value={f}>{t(`method.${f}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("pf.farm.season")}</Label>
                    <Select value={form.currentSeason} onValueChange={(v) => upd("currentSeason", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEASONS.map((s) => (
                          <SelectItem key={s} value={s}>{t(`season.${s}`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Preferences */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Settings className="size-4.5 text-primary" />
                  {t("pf.pref.title")}
                </CardTitle>
                <CardDescription>{t("pf.pref.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="weatherAlerts" className="text-sm font-semibold">{t("pf.pref.weather")}</Label>
                    <p className="text-xs text-muted-foreground">{t("pf.pref.weather.desc")}</p>
                  </div>
                  <Switch
                    id="weatherAlerts"
                    checked={form.weatherAlerts}
                    onCheckedChange={(v) => upd("weatherAlerts", v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="smsNotifications" className="text-sm font-semibold">{t("pf.pref.sms")}</Label>
                    <p className="text-xs text-muted-foreground">{t("pf.pref.sms.desc")}</p>
                  </div>
                  <Switch
                    id="smsNotifications"
                    checked={form.smsNotifications}
                    onCheckedChange={(v) => upd("smsNotifications", v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="emailNotifications" className="text-sm font-semibold">{t("pf.pref.email")}</Label>
                    <p className="text-xs text-muted-foreground">{t("pf.pref.email.desc")}</p>
                  </div>
                  <Switch
                    id="emailNotifications"
                    checked={form.emailNotifications}
                    onCheckedChange={(v) => upd("emailNotifications", v)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-border/50 p-3 bg-muted/20">
                  <div className="space-y-0.5">
                    <Label htmlFor="pushNotifications" className="text-sm font-semibold">{t("pf.pref.push")}</Label>
                    <p className="text-xs text-muted-foreground">{t("pf.pref.push.desc")}</p>
                  </div>
                  <Switch
                    id="pushNotifications"
                    checked={form.pushNotifications}
                    onCheckedChange={(v) => upd("pushNotifications", v)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Visual blocks & Photo, Coordinates & Map */}
          <div className="space-y-6">
            
            {/* Farmer Card Summary & Photo Upload */}
            <Card className="border-border/70 overflow-hidden shadow-sm">
              <div className="relative h-28 bg-gradient-to-r from-primary to-[color:var(--soil)]">
                <div className="absolute inset-0 bg-black/10" />
              </div>
              <div className="relative px-6 pb-6">
                <div className="relative -mt-12 mb-4 flex items-end justify-between">
                  {form.farmPhoto ? (
                    <div className="relative group">
                      <img
                        src={form.farmPhoto}
                        alt="Farmer Field"
                        className="size-24 rounded-2xl border-4 border-card object-cover bg-muted shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => upd("farmPhoto", "")}
                        className="absolute -top-1 -right-1 hidden group-hover:grid place-items-center bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
                      >
                        <Camera className="size-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="grid size-24 cursor-pointer place-items-center rounded-2xl border-4 border-card bg-muted text-muted-foreground shadow-md transition-all hover:bg-muted/80"
                    >
                      <Camera className="size-8" />
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg gap-1 text-xs"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5" /> {t("pf.about.upload")}
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-lg font-bold text-foreground">
                    {form.fullName || t("pf.about.namePlaceholder")}
                  </h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="size-3.5 text-primary" />
                    {form.village && form.block
                      ? `${form.village}, ${form.block}, ${form.district}, ${form.state}`
                      : [form.district, form.state].filter(Boolean).join(", ") || t("pf.about.locNotConfig")}
                  </p>
                  
                  <div className="space-y-1.5 pt-2">
                    <Label htmlFor="bio" className="text-xs">{t("pf.about.bio")}</Label>
                    <Textarea
                      id="bio"
                      value={form.bio}
                      onChange={(e) => upd("bio", e.target.value)}
                      placeholder={t("pf.about.bio.placeholder")}
                      className="h-20 text-xs resize-none"
                    />
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="favouriteCrops" className="text-xs">{t("pf.about.fav")}</Label>
                    <Input
                      id="favouriteCrops"
                      value={form.favouriteCrops}
                      onChange={(e) => upd("favouriteCrops", e.target.value)}
                      placeholder={t("pf.about.fav.placeholder")}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Farm Coordinates & Interactive Map */}
            <Card className="border-border/70 overflow-hidden shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base font-semibold">
                  <span className="flex items-center gap-2">
                    <Compass className="size-4.5 text-primary" />
                    {t("pf.coord.title")}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-lg gap-1 text-xs px-2.5 active:scale-95 transition-all"
                    onClick={handleGetCurrentLocation}
                  >
                    <Navigation className="size-3 text-primary animate-pulse" />
                    {t("pf.coord.gps")}
                  </Button>
                </CardTitle>
                <CardDescription>{t("pf.coord.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="latitude" className="text-xs">{t("pf.coord.lat")}</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => upd("latitude", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="longitude" className="text-xs">{t("pf.coord.lng")}</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => upd("longitude", parseFloat(e.target.value) || 0)}
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <FarmMap
                    initialLat={form.latitude}
                    initialLng={form.longitude}
                    onLocationChange={handleLocationChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Dynamic Crop Calendar Card */}
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BookOpen className="size-4.5 text-[color:var(--soil)]" />
                  {t("pf.cal.title")}
                </CardTitle>
                <CardDescription>{t("pf.cal.desc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                
                {/* Primary Crop Timeline */}
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Sprout className="size-3.5 text-primary" /> {t("pf.cal.primary", { crop: t(`crop.${form.primaryCrop}`) })}
                    </span>
                    <span className="text-[10px] rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">{t("pf.cal.active")}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.sow")}</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">{primaryCropTimeline.sow}</span>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.grow")}</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-300">{primaryCropTimeline.grow}</span>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.harvest")}</span>
                      <span className="font-semibold text-amber-800 dark:text-amber-300">{primaryCropTimeline.harvest}</span>
                    </div>
                  </div>
                </div>

                {/* Secondary Crop Timeline */}
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1">
                      <Sprout className="size-3.5 text-[color:var(--soil)]" /> {t("pf.cal.secondary", { crop: t(`crop.${form.secondaryCrop}`) })}
                    </span>
                    <span className="text-[10px] rounded-full bg-muted border px-2 py-0.5 font-semibold text-muted-foreground">{t("pf.cal.planned")}</span>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center text-xs">
                    <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.sow")}</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-300">{secondaryCropTimeline.sow}</span>
                    </div>
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.grow")}</span>
                      <span className="font-semibold text-blue-800 dark:text-blue-300">{secondaryCropTimeline.grow}</span>
                    </div>
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-1.5">
                      <span className="block text-[10px] font-medium text-muted-foreground uppercase">{t("pf.cal.harvest")}</span>
                      <span className="font-semibold text-amber-800 dark:text-amber-300">{secondaryCropTimeline.harvest}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Save Button Container */}
            <div className="rounded-2xl border border-primary/20 bg-emerald-500/5 p-4 flex flex-col gap-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("pf.save.info")}
              </p>
              <Button
                type="submit"
                disabled={saving}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 transition-all shadow active:scale-98 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> {t("pf.save.busy")}
                  </>
                ) : (
                  <>
                    <Save className="size-4.5" /> {t("pf.save.btn")}
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
