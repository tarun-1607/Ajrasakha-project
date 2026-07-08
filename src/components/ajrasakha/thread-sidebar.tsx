import { AjrasakhaWordmark } from "@/components/ajrasakha/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ThreadSummary } from "@/lib/chat-storage";
import { Link, useNavigate } from "@tanstack/react-router";
import { MessageSquarePlus, Trash2, MessagesSquare, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useState } from "react";

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function ThreadSidebar({
  threads,
  activeId,
  onNewThread,
  onDelete,
}: {
  threads: ThreadSummary[];
  activeId?: string;
  onNewThread: () => void;
  onDelete: (id: string) => void;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error(error.message);
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="border-b border-sidebar-border px-4 py-4">
        <AjrasakhaWordmark />
      </div>

      <div className="p-3">
        <Button
          onClick={onNewThread}
          className="w-full justify-start gap-2 rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
          size="lg"
        >
          <MessageSquarePlus className="size-4" />
          New question
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Recent chats
        </div>
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-xs text-muted-foreground">
            <MessagesSquare className="size-6 opacity-50" />
            <p>Your saved conversations will appear here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {threads.map((t) => {
              const isActive = t.id === activeId;
              return (
                <li key={t.id} className="group relative">
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <span className="line-clamp-2 pr-8 font-medium leading-snug">
                      {t.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatTime(t.updatedAt)}
                    </span>
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (
                        confirm("Delete this conversation? This cannot be undone.")
                      ) {
                        onDelete(t.id);
                        if (isActive) navigate({ to: "/dashboard" });
                      }
                    }}
                    className="absolute right-2 top-2.5 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="border-t border-sidebar-border px-3 py-3 space-y-2">
        {email && (
          <div className="px-1 text-[11px] leading-tight">
            <p className="font-medium text-foreground/80 truncate">{email}</p>
            <p className="text-muted-foreground">Signed in</p>
          </div>
        )}
        <Button
          onClick={handleLogout}
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 rounded-lg"
        >
          <LogOut className="size-4" />
          Log out
        </Button>
      </div>
    </aside>
  );
}