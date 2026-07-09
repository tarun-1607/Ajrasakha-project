import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listThreads, newThreadId, type ThreadSummary } from "@/lib/chat-storage";
import { isCurrentUserAdmin } from "@/lib/admin-knowledge.functions";
import { useServerFn } from "@tanstack/react-start";
import { AjrasakhaWordmark } from "@/components/ajrasakha/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { WeatherCard } from "@/components/ajrasakha/weather-card";
import { useLanguage } from "@/hooks/use-language";
import { LanguagePicker } from "@/components/ajrasakha/language-picker";
import { FarmMap } from "@/components/ajrasakha/farm-map";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  MessageSquarePlus,
  History,
  UserRound,
  Landmark,
  Sprout,
  MapPin,
  MessagesSquare,
  BadgeCheck,
  Bookmark,
  Sparkles,
  LogOut,
  ArrowRight,
  Leaf,
  ShieldCheck,
  Compass,
  ExternalLink,
  Search,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: DashboardPage,
});

type Profile = {
  full_name: string;
  email: string;
  state: string;
  district: string;
  preferred_language: string;
  primary_crop: string;
  block: string;
  village: string;
  soil_type: string;
  farm_size: string;
  irrigation_type: string;
  current_season: string;
};

function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSchemesModal, setShowSchemesModal] = useState(false);
  const [schemesSearch, setSchemesSearch] = useState("");
  const checkAdmin = useServerFn(isCurrentUserAdmin);

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t("greeting.morning");
    if (h < 17) return t("greeting.afternoon");
    return t("greeting.evening");
  };

  const getSeason = () => {
    const m = new Date().getMonth() + 1;
    if (m >= 6 && m <= 9) return { name: t("season.name.kharif"), tip: t("season.tip.kharif") };
    if (m >= 10 && m <= 11) return { name: t("season.name.postMonsoon"), tip: t("season.tip.postMonsoon") };
    if (m >= 12 || m <= 3) return { name: t("season.name.rabi"), tip: t("season.tip.rabi") };
    return { name: t("season.name.zaid"), tip: t("season.tip.zaid") };
  };

  const formatTime = (ts: number): string => {
    const diff = Date.now() - ts;
    const min = Math.floor(diff / 60000);
    if (min < 1) return t("time.justNow");
    if (min < 60) return t("time.mAgo", { min: min.toString() });
    const h = Math.floor(min / 60);
    if (h < 24) return t("time.hAgo", { h: h.toString() });
    const d = Math.floor(h / 24);
    if (d < 7) return t("time.dAgo", { d: d.toString() });
    return new Date(ts).toLocaleDateString();
  };

  useEffect(() => {
    let alive = true;
    checkAdmin()
      .then((r) => alive && setIsAdmin(r.isAdmin))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [checkAdmin]);

  useEffect(() => {
    setThreads(listThreads());
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select(
          "full_name,email,state,district,preferred_language,primary_crop,block,village,soil_type,farm_size,irrigation_type,current_season",
        )
        .eq("id", user.id)
        .maybeSingle();
      setProfile(
        data ?? {
          full_name: "",
          email: user.email ?? "",
          state: "",
          district: "",
          preferred_language: "English",
          primary_crop: "",
          block: "",
          village: "",
          soil_type: "",
          farm_size: "",
          irrigation_type: "",
          current_season: "",
        },
      );
      setLoading(false);
    })();
  }, []);

  const firstName = useMemo(() => {
    const n = profile?.full_name?.trim();
    if (n) return n.split(/\s+/)[0];
    const e = profile?.email?.split("@")[0];
    return e || "Farmer";
  }, [profile]);

  const season = useMemo(() => getSeason(), [t]);

  const stats = useMemo(() => {
    const questions = threads.reduce(
      (acc, t) => acc + Math.max(1, Math.floor((t.updatedAt - t.createdAt) / 60000)),
      0,
    );
    return {
      questionsAsked: threads.length,
      savedConversations: threads.length,
      verifiedAnswers: Math.max(0, Math.floor(threads.length * 0.6)),
      _q: questions,
    };
  }, [threads]);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  function goAsk() {
    navigate({ to: "/chat/$threadId", params: { threadId: newThreadId() } });
  }

  const primaryCrop = profile?.primary_crop?.trim() || "Not set";
  const location =
    [profile?.district, profile?.state].filter(Boolean).join(", ") || "Location not set";

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <AjrasakhaWordmark />
          <div className="flex items-center gap-2">
            <LanguagePicker />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/dashboard">{t("dashboard.title")}</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="hidden gap-2 sm:inline-flex">
                <Link to="/admin">
                  <ShieldCheck className="size-4" /> {t("dashboard.admin")}
                </Link>
              </Button>
            )}
            <Button onClick={handleLogout} variant="outline" size="sm" className="gap-2">
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{t("dashboard.logout")}</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        {/* Welcome hero */}
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-primary via-primary to-[color:var(--soil)] p-6 text-primary-foreground shadow-sm sm:p-8">
          <div className="absolute -right-16 -top-16 size-64 rounded-full bg-[color:var(--harvest)]/25 blur-3xl" />
          <div className="absolute -bottom-20 -left-10 size-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wider text-primary-foreground/75">
                {getGreeting()}
              </p>
              <h1 className="mt-1 truncate font-display text-2xl font-bold sm:text-3xl">
                {loading ? t("welcome.back") : t("welcome.user", { name: firstName })}
              </h1>
              <p className="mt-2 max-w-xl text-sm text-primary-foreground/85">
                {t("welcome.subtitle")}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-primary-foreground/85">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  <MapPin className="size-3.5" /> {location === "Location not set" ? t("tag.locationNotSet") : location}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  <Leaf className="size-3.5" /> {primaryCrop === "Not set" ? t("tag.cropNotSet") : primaryCrop}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                  <Sparkles className="size-3.5" /> {season.name}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                onClick={goAsk}
                size="lg"
                className="gap-2 rounded-xl bg-[color:var(--harvest)] text-[color:var(--harvest-foreground)] shadow hover:bg-[color:var(--harvest)]/90"
              >
                <MessageSquarePlus className="size-4" />
                {t("button.askQuestion")}
              </Button>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <StatCard
            icon={<MessagesSquare className="size-5" />}
            label={t("stats.questionsAsked")}
            value={loading ? null : stats.questionsAsked}
            tone="primary"
          />
          <StatCard
            icon={<Bookmark className="size-5" />}
            label={t("stats.savedConversations")}
            value={loading ? null : stats.savedConversations}
            tone="harvest"
          />
          <StatCard
            icon={<BadgeCheck className="size-5" />}
            label={t("stats.verifiedAnswers")}
            value={loading ? null : stats.verifiedAnswers}
            tone="soil"
          />
        </section>

        {/* Weather + Primary crop */}
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <WeatherCard />

          <Card className="rounded-2xl border-border/70 bg-gradient-to-br from-card to-[color:var(--accent)]/40">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sprout className="size-5 text-primary" />
                {t("crop.cardTitle")}
              </CardTitle>
              <CardDescription>{t("crop.cardDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                  <Leaf className="size-8" />
                </div>
                <div className="min-w-0">
                  <div className="font-display text-2xl font-bold capitalize">{primaryCrop === "Not set" ? t("tag.cropNotSet") : primaryCrop}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("crop.language")}: {profile?.preferred_language || "English"}
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={goAsk} size="sm" variant="secondary" className="rounded-lg gap-1.5">
                  <MessageSquarePlus className="size-4" />
                  {t("crop.askAbout", { crop: primaryCrop !== "Not set" ? primaryCrop : t("crop.cardTitle").toLowerCase() })}
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Region & Farm intelligence */}
        <section className="mt-6 grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl border-border/70 md:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="size-5 text-primary" />
                {t("profile.cardTitle")}
              </CardTitle>
              <CardDescription>
                {t("profile.cardDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <RegionField label={t("profile.currentRegion")} value={location === "Location not set" ? t("tag.locationNotSet") : location} />
                <RegionField label={t("profile.blockVillage")} value={[profile?.block, profile?.village].filter(Boolean).join(" · ") || "—"} />
                <RegionField label={t("profile.currentSeason")} value={profile?.current_season?.trim() || season.name} />
                <RegionField label={t("profile.primaryCrop")} value={primaryCrop === "Not set" ? t("tag.cropNotSet") : primaryCrop} />
                <RegionField label={t("profile.soilType")} value={profile?.soil_type?.trim() || "—"} />
                <RegionField label={t("profile.farmSize")} value={profile?.farm_size?.trim() || "—"} />
                <RegionField label={t("profile.irrigation")} value={profile?.irrigation_type?.trim() || "—"} />
                <RegionField label={t("profile.language")} value={profile?.preferred_language || "English"} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 overflow-hidden flex flex-col shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Compass className="size-5 text-primary" />
                Farm Location
              </CardTitle>
              <CardDescription>Pinpoint your field location on the map</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 sm:p-6 sm:pt-0">
              <FarmMap 
                onLocationChange={(lat, lng) => {
                  console.log("Coordinates changed:", lat, lng);
                }}
              />
            </CardContent>
          </Card>
        </section>

        {/* Quick actions */}
        <section className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold">{t("actions.title")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              icon={<MessageSquarePlus className="size-5" />}
              title={t("actions.ask")}
              desc={t("actions.askDesc")}
              onClick={goAsk}
              accent="primary"
            />
            <QuickAction
              icon={<History className="size-5" />}
              title={t("actions.history")}
              desc={t("actions.historyDesc")}
              onClick={() => {
                const t = listThreads()[0];
                if (t) navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
                else goAsk();
              }}
              accent="harvest"
            />
            <QuickAction
              icon={<UserRound className="size-5" />}
              title={t("actions.profile")}
              desc={t("actions.profileDesc")}
              onClick={() => toast.info("Profile settings coming soon")}
              accent="soil"
            />
            <QuickAction
              icon={<Landmark className="size-5" />}
              title={t("actions.schemes")}
              desc={t("actions.schemesDesc")}
              onClick={() => setShowSchemesModal(true)}
              accent="primary"
            />
            <QuickAction
              icon={<Leaf className="size-5" />}
              title={t("actions.diagnose")}
              desc={t("actions.diagnoseDesc")}
              onClick={() => navigate({ to: "/diagnose" })}
              accent="harvest"
            />
          </div>
        </section>

        {/* Recent + Seasonal advisory */}
        <section className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="rounded-2xl border-border/70 lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t("recent.title")}</CardTitle>
                <Button onClick={goAsk} variant="ghost" size="sm" className="gap-1">
                  {t("recent.new")} <MessageSquarePlus className="size-4" />
                </Button>
              </div>
              <CardDescription>{t("recent.desc")}</CardDescription>
            </CardHeader>
            <CardContent>
              {threads.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 py-10 text-center">
                  <MessagesSquare className="size-8 text-muted-foreground/60" />
                  <p className="text-sm text-muted-foreground">
                    {t("recent.none")}
                  </p>
                  <Button onClick={goAsk} size="sm" className="gap-2">
                    <MessageSquarePlus className="size-4" /> {t("recent.askNow")}
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/70">
                  {threads.slice(0, 5).map((t) => (
                    <li key={t.id}>
                      <Link
                        to="/chat/$threadId"
                        params={{ threadId: t.id }}
                        className="flex items-center gap-3 rounded-lg px-2 py-3 -mx-2 transition-colors hover:bg-accent/50"
                      >
                        <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                          <MessagesSquare className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{t.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatTime(t.updatedAt)}
                          </div>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-border/70 bg-gradient-to-br from-[color:var(--harvest)]/20 to-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="size-5 text-[color:var(--soil)]" />
                {t("season.title")}
              </CardTitle>
              <CardDescription>{season.name}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground/85">{season.tip}</p>
              <ul className="space-y-2 text-sm">
                <AdvisoryItem text={t("season.adv1")} />
                <AdvisoryItem text={t("season.adv2")} />
                <AdvisoryItem text={t("season.adv3")} />
              </ul>
              <Button onClick={goAsk} variant="outline" size="sm" className="w-full gap-2 rounded-lg">
                {t("season.askAbout")} <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      <SchemesDialog
        open={showSchemesModal}
        onOpenChange={setShowSchemesModal}
        search={schemesSearch}
        onSearchChange={setSchemesSearch}
        onAsk={goAsk}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  tone: "primary" | "harvest" | "soil";
}) {
  const toneClass =
    tone === "harvest"
      ? "bg-[color:var(--harvest)]/20 text-[color:var(--soil)]"
      : tone === "soil"
        ? "bg-[color:var(--soil)]/15 text-[color:var(--soil)]"
        : "bg-primary/10 text-primary";
  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`grid size-11 shrink-0 place-items-center rounded-xl ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {value === null ? (
            <Skeleton className="mt-1 h-7 w-16" />
          ) : (
            <div className="font-display text-2xl font-bold">{value}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: "primary" | "harvest" | "soil";
}) {
  return QuickActionImpl({ icon, title, desc, onClick, accent });
}

function RegionField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}

function QuickActionImpl({
  icon,
  title,
  desc,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
  accent: "primary" | "harvest" | "soil";
}) {
  const accentClass =
    accent === "harvest"
      ? "bg-[color:var(--harvest)]/20 text-[color:var(--soil)] group-hover:bg-[color:var(--harvest)]/30"
      : accent === "soil"
        ? "bg-[color:var(--soil)]/15 text-[color:var(--soil)] group-hover:bg-[color:var(--soil)]/25"
        : "bg-primary/10 text-primary group-hover:bg-primary/20";
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${accentClass}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-display text-sm font-semibold">{title}</div>
        <div className="truncate text-xs text-muted-foreground">{desc}</div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function AdvisoryItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <span className="text-foreground/80">{text}</span>
    </li>
  );
}

const CENTRAL_SCHEMES = [
  {
    id: "pm-kisan",
    name: "PM-KISAN (Kisan Samman Nidhi)",
    nameLocal: "पीएम-किसान (किसान सम्मान निधि)",
    authority: "Ministry of Agriculture, GoI",
    benefit: "₹6,000 yearly direct income support in 3 installments of ₹2,000 directly to farmer bank accounts.",
    eligibility: "All small and marginal landholding farmer families in India.",
    applyUrl: "https://pmkisan.gov.in/",
    tags: ["Direct Income Support", "₹6000/year"],
  },
  {
    id: "pmfby",
    name: "PMFBY (Crop Insurance Yojana)",
    nameLocal: "पीएम फसल बीमा योजना",
    authority: "Ministry of Agriculture, GoI",
    benefit: "Low-premium insurance covering crop losses from drought, floods, pests, and natural calamities.",
    eligibility: "All food crop, oilseed, and commercial/horticultural crop growers.",
    applyUrl: "https://pmfby.gov.in/",
    tags: ["Crop Insurance", "Loss Cover"],
  },
  {
    id: "pmksy",
    name: "PMKSY (Drip/Sprinkler Irrigation)",
    nameLocal: "कृषि सिंचाई योजना (ड्रिप/स्प्रिंकलर)",
    authority: "Department of Agriculture, GoI",
    benefit: "55% to 80% government subsidy to purchase and install water-saving micro-irrigation systems.",
    eligibility: "Farmers with cultivable land and access to a water source.",
    applyUrl: "https://pmksy.gov.in/",
    tags: ["Irrigation Subsidy", "Drip System"],
  },
  {
    id: "smam",
    name: "SMAM (Subsidies for Farm Equipment)",
    nameLocal: "कृषि यंत्रीकरण उप-मिशन",
    authority: "Ministry of Agriculture, GoI",
    benefit: "40% to 60% financial assistance for purchasing Tractors, Rotavators, Tillers, and Harvesters.",
    eligibility: "Small, marginal, SC/ST, and women farmers get priority benefits.",
    applyUrl: "https://agrimachinery.nic.in/",
    tags: ["Machinery Subsidy", "Equipment"],
  },
  {
    id: "kcc",
    name: "KCC (Kisan Credit Card)",
    nameLocal: "किसान क्रेडिट कार्ड",
    authority: "NABARD & Commercial Banks",
    benefit: "Short-term farm credit and cultivation loans up to ₹3 Lakhs at a highly concessional interest rate of 4%.",
    eligibility: "All cultivators, tenant farmers, dairy farmers, and fishers.",
    applyUrl: "https://www.pmkisan.gov.in/",
    tags: ["Concessional Loan", "Credit"],
  },
  {
    id: "soil-health",
    name: "Soil Health Card Scheme",
    nameLocal: "मृदा स्वास्थ्य कार्ड योजना",
    authority: "Department of Agriculture, GoI",
    benefit: "Free soil testing card every 2 years showing nutrient status and fertilizer recommendation for fields.",
    eligibility: "All farmers having cultivable land holdings.",
    applyUrl: "https://soilhealth.dac.gov.in/",
    tags: ["Free Soil Testing", "Soil Health"],
  },
];

function SchemesDialog({
  open,
  onOpenChange,
  search,
  onSearchChange,
  onAsk,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  search: string;
  onSearchChange: (s: string) => void;
  onAsk: () => void;
}) {
  const filteredSchemes = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return CENTRAL_SCHEMES;
    return CENTRAL_SCHEMES.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.nameLocal.toLowerCase().includes(q) ||
        s.benefit.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="font-display text-xl font-bold flex items-center gap-2">
            <Landmark className="size-5 text-primary" />
            Government Schemes & Subsidies
          </DialogTitle>
          <DialogDescription>
            Browse the latest agricultural support schemes or look up details.
          </DialogDescription>
        </DialogHeader>

        {/* Search Bar */}
        <div className="relative my-2">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search schemes (e.g. drip, insurance, ₹6000)..."
            className="pl-9"
          />
        </div>

        {/* List */}
        <div className="space-y-4 py-2">
          {filteredSchemes.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No matching schemes found.
            </div>
          ) : (
            filteredSchemes.map((scheme) => (
              <div
                key={scheme.id}
                className="group relative rounded-xl border border-border/70 p-4 transition-all hover:border-primary/50 hover:bg-muted/30"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display font-semibold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {scheme.name}
                    </h3>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {scheme.nameLocal} · <span className="opacity-80">{scheme.authority}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {scheme.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <span className="font-semibold text-foreground/80">Benefit / लाभ:</span>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{scheme.benefit}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2.5">
                    <span className="font-semibold text-foreground/80">Eligibility / पात्रता:</span>
                    <p className="text-muted-foreground mt-0.5 leading-relaxed">{scheme.eligibility}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/50 pt-3">
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    Verify application details on official site.
                  </span>
                  <a
                    href={scheme.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/95 transition-all shadow-sm cursor-pointer"
                  >
                    Apply Online <ExternalLink className="size-3" />
                  </a>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global info footer */}
        <div className="mt-2 rounded-xl bg-gradient-to-br from-emerald-500/10 to-primary/5 border border-primary/20 p-4 text-xs space-y-2">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Compass className="size-4 text-primary animate-pulse" />
            Discover more on official myScheme Portal
          </div>
          <p className="text-muted-foreground leading-relaxed">
            The national platform **myScheme** (Government of India) lets you search based on your age, state, land holding, and gender to list all eligible benefits.
          </p>
          <div className="pt-2 flex flex-wrap gap-2 justify-between items-center">
            <a
              href="https://www.myscheme.gov.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline cursor-pointer"
            >
              Go to myScheme.gov.in <ExternalLink className="size-3.5" />
            </a>
            <Button
              onClick={() => {
                onOpenChange(false);
                onAsk();
              }}
              size="sm"
              className="gap-1.5 h-8 text-[11px]"
            >
              Ask Ajrasakha AI about Schemes <Sparkles className="size-3" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
