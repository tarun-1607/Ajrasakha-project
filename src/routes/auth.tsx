import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { AjrasakhaLogo, AjrasakhaWordmark } from "@/components/ajrasakha/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Leaf } from "lucide-react";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

const LANGUAGES = ["English", "Hindi", "Kannada", "Tamil", "Telugu", "Marathi", "Bengali", "Gujarati", "Punjabi", "Malayalam"];
const CROPS = ["Rice", "Wheat", "Maize", "Cotton", "Sugarcane", "Pulses", "Vegetables", "Fruits", "Coffee", "Tea", "Other"];

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const redirectTarget = search.redirect ?? "/dashboard";
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(search.mode ?? "signin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <AjrasakhaLogo size={56} />
          <AjrasakhaWordmark />
          <p className="text-sm text-muted-foreground max-w-xs">
            Trusted farming answers in your language — by text or voice, 24/7.
          </p>
        </div>
        <Card className="rounded-2xl shadow-xl border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Leaf className="size-5 text-primary" />
              {tab === "signup" ? "Create your account" : tab === "forgot" ? "Reset password" : "Welcome back"}
            </CardTitle>
            <CardDescription>
              {tab === "signup"
                ? "Tell us a bit about your farm to get personalized answers."
                : tab === "forgot"
                  ? "We'll email you a link to set a new password."
                  : "Sign in to continue to your Ajrasakha chats."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid w-full grid-cols-3 rounded-xl">
                <TabsTrigger value="signin" className="rounded-lg">Sign in</TabsTrigger>
                <TabsTrigger value="signup" className="rounded-lg">Sign up</TabsTrigger>
                <TabsTrigger value="forgot" className="rounded-lg">Forgot</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="mt-4">
                <SignInForm redirectTarget={redirectTarget} />
              </TabsContent>
              <TabsContent value="signup" className="mt-4">
                <SignUpForm redirectTarget={redirectTarget} onDone={() => setTab("signin")} />
              </TabsContent>
              <TabsContent value="forgot" className="mt-4">
                <ForgotForm onDone={() => setTab("signin")} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to receive account and farming update emails.
        </p>
        <div className="mt-2 text-center">
          <Link to="/" className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

function SignInForm({ redirectTarget }: { redirectTarget: string }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(error.message || "Could not sign in");
      return;
    }
    toast.success("Welcome back!");
    navigate({ to: redirectTarget.startsWith("/") ? redirectTarget : "/dashboard", replace: true });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="farmer@example.com" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-password">Password</Label>
        <Input id="si-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
        {loading ? <Spinner /> : "Sign in"}
      </Button>
    </form>
  );
}

const signUpSchema = z.object({
  fullName: z.string().trim().min(2, "Full name required").max(80),
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
  state: z.string().trim().min(2, "State required").max(60),
  district: z.string().trim().min(2, "District required").max(60),
  preferredLanguage: z.string().min(1),
  primaryCrop: z.string().min(1, "Primary crop required"),
  block: z.string().trim().max(60).optional().default(""),
  village: z.string().trim().max(60).optional().default(""),
  soilType: z.string().trim().max(40).optional().default(""),
  farmSize: z.string().trim().max(40).optional().default(""),
  irrigationType: z.string().trim().max(40).optional().default(""),
});

function SignUpForm({ redirectTarget, onDone }: { redirectTarget: string; onDone: () => void }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    state: "",
    district: "",
    preferredLanguage: "English",
    primaryCrop: "",
    block: "",
    village: "",
    soilType: "",
    farmSize: "",
    irrigationType: "",
  });

  function upd<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: parsed.data.fullName,
          state: parsed.data.state,
          district: parsed.data.district,
          preferred_language: parsed.data.preferredLanguage,
          primary_crop: parsed.data.primaryCrop,
          block: parsed.data.block,
          village: parsed.data.village,
          soil_type: parsed.data.soilType,
          farm_size: parsed.data.farmSize,
          irrigation_type: parsed.data.irrigationType,
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Account created — welcome to Ajrasakha!");
      navigate({ to: redirectTarget.startsWith("/") ? redirectTarget : "/dashboard", replace: true });
    } else {
      toast.success("Check your inbox to confirm your email, then sign in.");
      onDone();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Full name</Label>
        <Input id="su-name" required value={form.fullName} onChange={(e) => upd("fullName", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" required value={form.email} onChange={(e) => upd("email", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Password</Label>
        <Input id="su-password" type="password" autoComplete="new-password" required value={form.password} onChange={(e) => upd("password", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="su-state">State</Label>
          <Input id="su-state" required value={form.state} onChange={(e) => upd("state", e.target.value)} placeholder="e.g. Karnataka" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-district">District</Label>
          <Input id="su-district" required value={form.district} onChange={(e) => upd("district", e.target.value)} placeholder="e.g. Mysuru" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="su-block">Block / Taluka <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input id="su-block" value={form.block} onChange={(e) => upd("block", e.target.value)} placeholder="e.g. Nanjangud" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-village">Village <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input id="su-village" value={form.village} onChange={(e) => upd("village", e.target.value)} placeholder="e.g. Hadinaru" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="su-soil">Soil type <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input id="su-soil" value={form.soilType} onChange={(e) => upd("soilType", e.target.value)} placeholder="e.g. black cotton" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="su-farm">Farm size <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Input id="su-farm" value={form.farmSize} onChange={(e) => upd("farmSize", e.target.value)} placeholder="e.g. 2 acres" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-irrig">Irrigation type <span className="text-xs text-muted-foreground">(optional)</span></Label>
        <Input id="su-irrig" value={form.irrigationType} onChange={(e) => upd("irrigationType", e.target.value)} placeholder="e.g. drip, canal, rain-fed" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Preferred language</Label>
          <Select value={form.preferredLanguage} onValueChange={(v) => upd("preferredLanguage", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Primary crop</Label>
          <Select value={form.primaryCrop} onValueChange={(v) => upd("primaryCrop", v)}>
            <SelectTrigger><SelectValue placeholder="Select crop" /></SelectTrigger>
            <SelectContent>
              {CROPS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" className="w-full rounded-xl mt-2" size="lg" disabled={loading}>
        {loading ? <Spinner /> : "Create account"}
      </Button>
    </form>
  );
}

function ForgotForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password reset email sent. Check your inbox.");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fp-email">Email</Label>
        <Input id="fp-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
        {loading ? <Spinner /> : "Send reset link"}
      </Button>
    </form>
  );
}