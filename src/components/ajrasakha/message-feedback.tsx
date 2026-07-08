import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitFeedback, submitReport } from "@/lib/feedback.functions";
import { CheckCircle2, Flag, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

type Reason = "incorrect" | "incomplete" | "unsafe" | "other";

const REASONS: { value: Reason; label: string; hint: string }[] = [
  { value: "incorrect", label: "Incorrect information", hint: "The answer contains factual errors." },
  { value: "incomplete", label: "Incomplete", hint: "The answer is missing key details." },
  { value: "unsafe", label: "Unsafe", hint: "The answer could harm crops, people, or animals." },
  { value: "other", label: "Other", hint: "Something else you'd like a reviewer to see." },
];

export function MessageFeedback({
  threadId,
  messageId,
  question,
  answer,
}: {
  threadId: string;
  messageId: string;
  question: string;
  answer: string;
}) {
  const feedback = useServerFn(submitFeedback);
  const report = useServerFn(submitReport);
  const [rating, setRating] = useState<"helpful" | "not_helpful" | null>(null);
  const [ratingLoading, setRatingLoading] = useState<"helpful" | "not_helpful" | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reason, setReason] = useState<Reason>("incorrect");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [reported, setReported] = useState(false);

  const rate = async (value: "helpful" | "not_helpful") => {
    if (ratingLoading) return;
    setRatingLoading(value);
    try {
      await feedback({ data: { threadId, messageId, question, answer, rating: value } });
      setRating(value);
      toast.success(value === "helpful" ? "Thanks for the feedback!" : "Got it — we'll improve.");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save feedback. Please try again.");
    } finally {
      setRatingLoading(null);
    }
  };

  const sendReport = async () => {
    setSubmitting(true);
    try {
      await report({ data: { threadId, messageId, question, answer, reason, details } });
      setReported(true);
      toast.success("Report submitted for expert review.");
      setTimeout(() => setReportOpen(false), 1400);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-border/40 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => rate("helpful")}
        disabled={!!ratingLoading}
        className={cn(
          "h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground",
          rating === "helpful" && "bg-harvest/20 text-foreground",
        )}
        aria-label="Mark answer helpful"
      >
        <ThumbsUp className="size-3.5" />
        Helpful
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => rate("not_helpful")}
        disabled={!!ratingLoading}
        className={cn(
          "h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground",
          rating === "not_helpful" && "bg-destructive/15 text-foreground",
        )}
        aria-label="Mark answer not helpful"
      >
        <ThumbsDown className="size-3.5" />
        Not helpful
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          setReported(false);
          setDetails("");
          setReason("incorrect");
          setReportOpen(true);
        }}
        className="h-7 gap-1.5 rounded-full px-2 text-xs text-muted-foreground hover:text-foreground"
        aria-label="Report answer"
      >
        <Flag className="size-3.5" />
        Report answer
      </Button>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          {reported ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="rounded-full bg-harvest/20 p-3">
                <CheckCircle2 className="size-7 text-harvest" />
              </div>
              <DialogTitle>Thanks for helping improve Ajrasakha</DialogTitle>
              <DialogDescription>
                Your report has been sent to the reviewer team. An expert will look at this answer soon.
              </DialogDescription>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Report this answer</DialogTitle>
                <DialogDescription>
                  Tell us what's wrong. Reviewers use this to improve verified answers.
                </DialogDescription>
              </DialogHeader>
              <RadioGroup
                value={reason}
                onValueChange={(v) => setReason(v as Reason)}
                className="gap-2"
              >
                {REASONS.map((r) => (
                  <Label
                    key={r.value}
                    htmlFor={`reason-${r.value}`}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 transition-colors",
                      reason === r.value ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                    )}
                  >
                    <RadioGroupItem id={`reason-${r.value}`} value={r.value} className="mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">{r.label}</div>
                      <div className="text-xs text-muted-foreground">{r.hint}</div>
                    </div>
                  </Label>
                ))}
              </RadioGroup>
              <Textarea
                placeholder="Optional details for the reviewer…"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={3}
                maxLength={2000}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setReportOpen(false)} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={sendReport} disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit report"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}