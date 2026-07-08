import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getKnowledgeIndexStatus } from "@/lib/admin-knowledge.functions";
import { getReviewerAccess } from "@/lib/reviews.functions";
import type { IndexStatus } from "@/lib/repositories/knowledge-admin-repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Sprout, Database, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  ssr: false,
  component: AdminOverview,
});

function AdminOverview() {
  const statusFn = useServerFn(getKnowledgeIndexStatus);
  const navigate = useNavigate();
  const [status, setStatus] = useState<{ golden: IndexStatus; pop: IndexStatus } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const access = await getReviewerAccess();
        if (!access.isAdmin) {
          navigate({ to: "/admin/reviews", replace: true });
          return;
        }
        const res = await statusFn();
        if (alive) setStatus(res);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [statusFn, navigate]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Knowledge management</h1>
        <p className="text-sm text-muted-foreground">
          Curate the answers Ajrasakha serves to farmers. Golden entries are checked first, then Package of Practices, then AI.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <TierCard
          tier="golden"
          title="Golden Dataset"
          desc="Expert-verified answers served with the green badge."
          icon={<ShieldCheck className="size-5" />}
          status={status?.golden}
          loading={loading}
          href="/admin/golden"
          accent="from-emerald-500/20 to-emerald-500/5 border-emerald-500/30"
        />
        <TierCard
          tier="pop"
          title="Package of Practices"
          desc="Regional PoP entries served with the blue badge."
          icon={<Sprout className="size-5" />}
          status={status?.pop}
          loading={loading}
          href="/admin/pop"
          accent="from-blue-500/20 to-blue-500/5 border-blue-500/30"
        />
      </div>

      <Card className="rounded-2xl border-border/70">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="size-5 text-primary" /> Vector indexing status
          </CardTitle>
          <CardDescription>
            Semantic search uses a vector embedding on each entry. Rows without an embedding fall back to keyword ranking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !status ? (
            <>
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </>
          ) : (
            <>
              <IndexRow label="Golden Dataset" status={status.golden} />
              <IndexRow label="Package of Practices" status={status.pop} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TierCard({
  title,
  desc,
  icon,
  status,
  loading,
  href,
  accent,
}: {
  tier: "golden" | "pop";
  title: string;
  desc: string;
  icon: React.ReactNode;
  status?: IndexStatus;
  loading: boolean;
  href: "/admin/golden" | "/admin/pop";
  accent: string;
}) {
  return (
    <Card className={`rounded-2xl border bg-gradient-to-br ${accent}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">{icon} {title}</CardTitle>
          {status && (
            <Badge variant="outline" className="bg-background/70">
              {status.total} entries
            </Badge>
          )}
        </div>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading || !status ? (
          <Skeleton className="h-4 w-40" />
        ) : (
          <div className="text-xs text-muted-foreground">
            {status.indexed} indexed · {status.missing} pending embedding
          </div>
        )}
        <Button asChild size="sm" className="gap-2">
          <Link to={href}>
            Manage <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function IndexRow({ label, status }: { label: string; status: IndexStatus }) {
  const pct = status.total > 0 ? Math.round((status.indexed / status.total) * 100) : 0;
  const done = status.total > 0 && status.missing === 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {done ? (
            <><CheckCircle2 className="size-3.5 text-emerald-600" /> Fully indexed</>
          ) : (
            <><AlertCircle className="size-3.5 text-amber-600" /> {status.missing} pending</>
          )}
          <span className="ml-2 tabular-nums">{status.indexed}/{status.total}</span>
        </span>
      </div>
      <Progress value={pct} />
    </div>
  );
}