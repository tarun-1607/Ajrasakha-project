import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AjrasakhaLogo } from "@/components/ajrasakha/logo";

export const Route = createFileRoute("/")({
  ssr: false,
  component: RootRedirect,
});

function RootRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          navigate({ to: "/auth", replace: true });
        } else {
          navigate({ to: "/dashboard", replace: true });
        }
      } catch (err) {
        console.error("Auth query failed, redirecting to login:", err);
        navigate({ to: "/auth", replace: true });
      }
    })();
  }, [navigate]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center">
        <AjrasakhaLogo size={64} />
        <p className="text-sm text-muted-foreground">Loading Ajrasakha…</p>
      </div>
    </div>
  );
}