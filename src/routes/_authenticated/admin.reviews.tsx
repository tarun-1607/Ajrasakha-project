import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  approveReview,
  listPendingReviews,
  rejectReview,
  saveReviewEdit,
} from "@/lib/reviews.functions";
import type {
  ReviewItem,
  ReviewListResult,
  ReviewStatus,
} from "@/lib/repositories/review-repository";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  X,
  Pencil,
  Flag,
  ThumbsUp,
  ThumbsDown,
  Search,
  Sprout,
  Languages,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/reviews")({
  ssr: false,
  component: ReviewerDashboard,
});

type Counts = Record<ReviewStatus, number>;

function ReviewerDashboard() {
  const listFn = useServerFn(listPendingReviews);
  const [status, setStatus] = useState<ReviewStatus>("pending");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [data, setData] = useState<(ReviewListResult & { counts: Counts }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, debounced]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listFn({ data: { status, page, pageSize, search: debounced } })
      .then((res) => {
        if (alive) setData(res);
      })
      .catch((err) => {
        console.error(err);
        toast.error(err instanceof Error ? err.message : "Couldn't load queue");
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [listFn, status, page, pageSize, debounced, refreshTick]);

  const refresh = useCallback(() => setRefreshTick((n) => n + 1), []);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <ClipboardCheck className="size-6 text-primary" />
            Reviewer Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Every AI-generated answer lands here. Approve to promote to the
            Golden Dataset with a "Verified Expert Answer" tag.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search question, answer, crop…"
            className="pl-9"
          />
        </div>
      </header>

      <Tabs value={status} onValueChange={(v) => setStatus(v as ReviewStatus)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            Pending
            <Badge variant="secondary" className="tabular-nums">
              {data?.counts.pending ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1.5">
            Approved
            <Badge variant="secondary" className="tabular-nums">
              {data?.counts.approved ?? 0}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            Rejected
            <Badge variant="secondary" className="tabular-nums">
              {data?.counts.rejected ?? 0}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <EmptyState status={status} />
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => (
            <ReviewCard key={item.id} item={item} onChanged={refresh} />
          ))}
        </div>
      )}

      {data && data.total > pageSize && (
        <div className="flex items-center justify-between border-t border-border/60 pt-4">
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {data.total} total
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="size-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ status }: { status: ReviewStatus }) {
  const label =
    status === "pending"
      ? "No answers waiting for review — the queue is clear."
      : status === "approved"
        ? "No approved answers yet."
        : "No rejected answers.";
  return (
    <Card className="rounded-2xl border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <ClipboardCheck className="size-6" />
        </div>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  if (status === "approved")
    return (
      <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 border-emerald-500/30">
        <ShieldCheck className="size-3" /> Verified
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge variant="outline" className="gap-1 border-destructive/40 text-destructive">
        <X className="size-3" /> Rejected
      </Badge>
    );
  return (
    <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700">
      Pending review
    </Badge>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ReviewCard({ item, onChanged }: { item: ReviewItem; onChanged: () => void }) {
  const approveFn = useServerFn(approveReview);
  const rejectFn = useServerFn(rejectReview);
  const saveEditFn = useServerFn(saveReviewEdit);

  const [editOpen, setEditOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState(
    item.editedAnswer ?? item.answer,
  );
  const [rejectNotes, setRejectNotes] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | "save" | null>(null);

  const currentAnswer = item.editedAnswer ?? item.answer;
  const wasEdited = useMemo(
    () => !!item.editedAnswer && item.editedAnswer !== item.answer,
    [item.editedAnswer, item.answer],
  );

  const doApprove = async (payload?: { editedAnswer?: string }) => {
    if (busy) return;
    setBusy("approve");
    try {
      const res = await approveFn({ data: { id: item.id, ...payload } });
      if (res.embeddingIndexed) {
        toast.success("Approved — added to Golden Dataset with embedding.");
      } else {
        toast.success("Approved — added to Golden Dataset (embedding retry queued).");
      }
      setEditOpen(false);
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(null);
    }
  };

  const doReject = async () => {
    if (busy) return;
    setBusy("reject");
    try {
      await rejectFn({ data: { id: item.id, notes: rejectNotes || undefined } });
      toast.success("Rejected.");
      setRejectOpen(false);
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  };

  const doSaveEdit = async () => {
    if (busy) return;
    setBusy("save");
    try {
      await saveEditFn({ data: { id: item.id, editedAnswer } });
      toast.success("Edit saved.");
      setEditOpen(false);
      onChanged();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-2xl border-border/70">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base font-semibold leading-snug">
              {item.question}
            </CardTitle>
            <CardDescription className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span>{formatDate(item.createdAt)}</span>
              {item.language && (
                <span className="inline-flex items-center gap-1">
                  <Languages className="size-3" /> {item.language}
                </span>
              )}
              {item.crop && (
                <span className="inline-flex items-center gap-1">
                  <Sprout className="size-3" /> {item.crop}
                </span>
              )}
            </CardDescription>
          </div>
          <StatusBadge status={item.status} />
        </div>

        <FeedbackChips
          helpful={item.feedback.helpful}
          notHelpful={item.feedback.notHelpful}
          reports={item.feedback.reports.length}
        />
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
          <div className="mb-1 flex items-center justify-between">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              AI answer{wasEdited ? " (edited by reviewer)" : ""}
            </div>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {currentAnswer}
          </p>
        </div>

        {item.feedback.reports.length > 0 && (
          <details className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            <summary className="cursor-pointer font-medium text-destructive">
              <Flag className="mr-1 inline size-3" />
              {item.feedback.reports.length} farmer report(s)
            </summary>
            <ul className="mt-2 space-y-2">
              {item.feedback.reports.map((r, i) => (
                <li key={i} className="border-l-2 border-destructive/40 pl-2">
                  <div className="font-medium">{r.reason}</div>
                  {r.details && <div className="text-muted-foreground">{r.details}</div>}
                </li>
              ))}
            </ul>
          </details>
        )}

        {item.reviewerNotes && (
          <div className="rounded-lg border border-border/60 bg-background p-3 text-xs">
            <div className="font-medium text-muted-foreground">Reviewer notes</div>
            <div className="mt-1 whitespace-pre-wrap">{item.reviewerNotes}</div>
          </div>
        )}

        {item.status === "pending" && (
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => doApprove()}
              disabled={!!busy}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-600/90"
            >
              {busy === "approve" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditedAnswer(currentAnswer);
                setEditOpen(true);
              }}
              disabled={!!busy}
              className="gap-1.5"
            >
              <Pencil className="size-4" /> Edit
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setRejectNotes("");
                setRejectOpen(true);
              }}
              disabled={!!busy}
              className={cn("gap-1.5 text-destructive border-destructive/40 hover:bg-destructive/10")}
            >
              <X className="size-4" /> Reject
            </Button>
          </div>
        )}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit answer before approving</DialogTitle>
            <DialogDescription>
              Refine the AI's response. Approving stores this edited version as
              a Verified Expert Answer in the Golden Dataset.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="rounded-md border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="font-medium text-muted-foreground">Question</div>
              <div className="mt-1">{item.question}</div>
            </div>
            <Textarea
              value={editedAnswer}
              onChange={(e) => setEditedAnswer(e.target.value)}
              rows={10}
              maxLength={8000}
              className="font-mono text-sm"
            />
            <div className="text-right text-[11px] text-muted-foreground">
              {editedAnswer.length}/8000
            </div>
          </div>
          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row">
            <Button variant="ghost" onClick={() => setEditOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button variant="outline" onClick={doSaveEdit} disabled={!!busy || !editedAnswer.trim()}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : "Save draft"}
            </Button>
            <Button
              onClick={() => doApprove({ editedAnswer })}
              disabled={!!busy || !editedAnswer.trim()}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-600/90"
            >
              {busy === "approve" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Approve edited
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject this answer</DialogTitle>
            <DialogDescription>
              Optional notes for the audit trail — helps improve future AI
              responses on the same topic.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Why is this answer wrong or unsafe?"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)} disabled={!!busy}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={doReject} disabled={!!busy}>
              {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FeedbackChips({
  helpful,
  notHelpful,
  reports,
}: {
  helpful: number;
  notHelpful: number;
  reports: number;
}) {
  if (helpful === 0 && notHelpful === 0 && reports === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {helpful > 0 && (
        <Badge variant="outline" className="gap-1 text-xs">
          <ThumbsUp className="size-3 text-emerald-600" /> {helpful}
        </Badge>
      )}
      {notHelpful > 0 && (
        <Badge variant="outline" className="gap-1 text-xs">
          <ThumbsDown className="size-3 text-amber-600" /> {notHelpful}
        </Badge>
      )}
      {reports > 0 && (
        <Badge variant="outline" className="gap-1 border-destructive/40 text-xs text-destructive">
          <Flag className="size-3" /> {reports}
        </Badge>
      )}
    </div>
  );
}