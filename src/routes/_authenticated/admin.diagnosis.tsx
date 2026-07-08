import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listPendingDiagnoses,
  reviewDiagnosis,
  type DiagnosisRow,
} from "@/lib/diagnosis.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/diagnosis")({
  ssr: false,
  component: AdminDiagnosisPage,
});

function AdminDiagnosisPage() {
  const listFn = useServerFn(listPendingDiagnoses);
  const reviewFn = useServerFn(reviewDiagnosis);
  const [rows, setRows] = useState<DiagnosisRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    listFn({})
      .then((r) => alive && setRows(r))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Failed to load queue");
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, [listFn]);

  async function submit(
    id: string,
    action: "approve" | "reject" | "edit",
    patch: Partial<DiagnosisRow> & { addToGolden?: boolean; notes?: string },
  ) {
    try {
      const res = await reviewFn({
        data: {
          id,
          action,
          disease: patch.disease ?? undefined,
          treatment: patch.treatment ?? undefined,
          organicTreatment: patch.organicTreatment ?? undefined,
          prevention: patch.prevention ?? undefined,
          severity: patch.severity ?? undefined,
          notes: patch.notes,
          addToGolden: patch.addToGolden,
        },
      });
      setRows((r) => r?.filter((x) => x.id !== id) ?? null);
      toast.success(
        res.addedToGolden
          ? "Reviewed and added to Golden Dataset"
          : "Review saved",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis review queue</CardTitle>
          <CardDescription>
            Low-confidence or unknown-disease diagnoses. Approve, reject, or edit
            and optionally promote to the Golden Dataset.
          </CardDescription>
        </CardHeader>
      </Card>

      {rows === null ? (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No pending diagnoses. 🎉
          </CardContent>
        </Card>
      ) : (
        rows.map((r) => <ReviewCard key={r.id} row={r} onSubmit={submit} />)
      )}
    </div>
  );
}

function ReviewCard({
  row,
  onSubmit,
}: {
  row: DiagnosisRow;
  onSubmit: (
    id: string,
    action: "approve" | "reject" | "edit",
    patch: Partial<DiagnosisRow> & { addToGolden?: boolean; notes?: string },
  ) => Promise<void>;
}) {
  const [disease, setDisease] = useState(row.disease ?? "");
  const [treatment, setTreatment] = useState(row.treatment ?? "");
  const [organicTreatment, setOrganicTreatment] = useState(row.organicTreatment ?? "");
  const [prevention, setPrevention] = useState(row.prevention ?? "");
  const [notes, setNotes] = useState("");
  const [addToGolden, setAddToGolden] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">
              {row.disease ?? "Unknown"} · {row.crop ?? "crop"}
            </CardTitle>
            <CardDescription>
              {new Date(row.createdAt).toLocaleString()} · confidence{" "}
              {row.confidence != null ? Math.round(row.confidence * 100) : "?"}%
            </CardDescription>
          </div>
          <Badge variant="outline">{row.severity ?? "unknown"} severity</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-[220px_1fr]">
        {row.imageUrl ? (
          <img
            src={row.imageUrl}
            alt=""
            className="h-56 w-full rounded-md object-cover"
          />
        ) : (
          <div className="h-56 rounded-md bg-muted" />
        )}
        <div className="space-y-3">
          <div className="grid gap-2">
            <Label>Disease</Label>
            <Input value={disease} onChange={(e) => setDisease(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Treatment</Label>
            <Textarea rows={2} value={treatment} onChange={(e) => setTreatment(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Organic option</Label>
            <Textarea rows={2} value={organicTreatment} onChange={(e) => setOrganicTreatment(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Prevention</Label>
            <Textarea rows={2} value={prevention} onChange={(e) => setPrevention(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Reviewer notes</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id={`golden-${row.id}`}
              checked={addToGolden}
              onCheckedChange={(v) => setAddToGolden(!!v)}
            />
            <Label htmlFor={`golden-${row.id}`} className="font-normal">
              Also add to Golden Dataset
            </Label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              onClick={() =>
                onSubmit(row.id, "approve", {
                  disease,
                  treatment,
                  organicTreatment,
                  prevention,
                  notes,
                  addToGolden,
                })
              }
              className="gap-2"
            >
              <CheckCircle2 className="size-4" /> Approve
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                onSubmit(row.id, "edit", {
                  disease,
                  treatment,
                  organicTreatment,
                  prevention,
                  notes,
                  addToGolden,
                })
              }
              className="gap-2"
            >
              <Sparkles className="size-4" /> Save edits
            </Button>
            <Button
              variant="outline"
              onClick={() => onSubmit(row.id, "reject", { notes })}
              className="gap-2"
            >
              <XCircle className="size-4" /> Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}