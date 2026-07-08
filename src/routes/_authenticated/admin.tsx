import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getReviewerAccess } from "@/lib/reviews.functions";
import { AjrasakhaWordmark } from "@/components/ajrasakha/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LayoutDashboard, ShieldCheck, Sprout, ArrowLeft, ClipboardCheck, CloudSun, Leaf } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  ssr: false,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { isAdmin, isReviewer } = await getReviewerAccess();
    if (!isAdmin && !isReviewer) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin/reviews" as const, label: "Reviews", icon: ClipboardCheck, exact: false, adminOnly: false },
  { to: "/admin/diagnosis" as const, label: "Diagnosis", icon: Leaf, exact: false, adminOnly: false },
  { to: "/admin" as const, label: "Overview", icon: LayoutDashboard, exact: true, adminOnly: true },
  { to: "/admin/golden" as const, label: "Golden Dataset", icon: ShieldCheck, exact: false, adminOnly: true },
  { to: "/admin/pop" as const, label: "Package of Practices", icon: Sprout, exact: false, adminOnly: true },
  { to: "/admin/weather" as const, label: "Weather", icon: CloudSun, exact: false, adminOnly: true },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [isAdmin, setIsAdmin] = useState(true);
  useEffect(() => {
    getReviewerAccess()
      .then((r) => setIsAdmin(r.isAdmin))
      .catch(() => setIsAdmin(false));
  }, []);
  const nav = NAV.filter((n) => !n.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <AjrasakhaWordmark />
            <span className="hidden rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary sm:inline-block">
              Admin
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Back to app</span>
            </Link>
          </Button>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-[220px_1fr]">
        <aside>
          <nav className="sticky top-20 flex flex-row gap-1 overflow-x-auto md:flex-col">
            {nav.map((n) => {
              const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}