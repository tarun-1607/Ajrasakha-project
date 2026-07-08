import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  diagnoseCrop,
  listMyDiagnoses,
  deleteMyDiagnosis,
  type DiagnosisRow,
} from "@/lib/diagnosis.functions";
import { compressImage } from "@/lib/diagnosis/compress-image";
import { AjrasakhaWordmark } from "@/components/ajrasakha/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  Camera,
  ImagePlus,
  Leaf,
  Loader2,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/diagnose")({
  ssr: false,
  component: DiagnosePage,
});

const BUCKET = "diagnosis-images";
const INPUT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB raw (phones shoot 8–15 MB)
const UPLOAD_MAX_BYTES = 2 * 1024 * 1024; // Compress every upload to ≤ 2 MB

function severityTone(sev: DiagnosisRow["severity"]): string {
  switch (sev) {
    case "high":
      return "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300";
    case "medium":
      return "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300";
    case "low":
      return "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function DiagnosePage() {
  const diagnoseFn = useServerFn(diagnoseCrop);
  const listFn = useServerFn(listMyDiagnoses);
  const deleteFn = useServerFn(deleteMyDiagnosis);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [current, setCurrent] = useState<DiagnosisRow | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [history, setHistory] = useState<DiagnosisRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    let alive = true;
    listFn({})
      .then((rows) => alive && setHistory(rows))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [listFn]);

  function chooseFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (f.size > INPUT_MAX_BYTES) {
      toast.error("Image is too large (max 20 MB)");
      return;
    }
    setFile(f);
    setCurrent(null);
  }

  async function onDiagnose() {
    if (!file) return;
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");
      // Client-side compression: cap at 2 MB while keeping detail sharp enough
      // for vision-based disease detection (long edge ≤ 1600 px, JPEG q≈0.85,
      // stepping down only if needed to hit the size cap).
      const compressed = await compressImage(file, {
        maxBytes: UPLOAD_MAX_BYTES,
      });
      if (!compressed.skipped) {
        const savedKb = Math.max(
          0,
          Math.round((compressed.originalBytes - compressed.compressedBytes) / 1024),
        );
        if (savedKb > 50) toast.info(`Compressed image · saved ~${savedKb} KB`);
      }
      const upload = compressed.file;
      const ext = (upload.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, upload, { contentType: upload.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      setUploading(false);
      setDiagnosing(true);
      const row = await diagnoseFn({
        data: { imagePath: path, farmerNote: note.trim() || undefined },
      });
      setCurrent(row);
      setHistory((h) => (h ? [row, ...h] : [row]));
      toast.success("Diagnosis ready");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      toast.error(msg);
    } finally {
      setUploading(false);
      setDiagnosing(false);
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteFn({ data: { id } });
      setHistory((h) => h?.filter((r) => r.id !== id) ?? null);
      if (current?.id === id) setCurrent(null);
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  }

  const busy = uploading || diagnosing;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <AjrasakhaWordmark />
            <span className="hidden rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary sm:inline-block">
              Diagnose
            </span>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <Card className="border-primary/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Leaf className="size-5 text-primary" /> Crop Disease Detection
            </CardTitle>
            <CardDescription>
              Upload or capture a photo of the affected plant. We'll identify the
              likely disease, severity, and recommend treatment.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                chooseFile(e.dataTransfer.files?.[0] ?? null);
              }}
              className={
                "relative flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors " +
                (dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/30")
              }
            >
              {previewUrl ? (
                <div className="relative w-full">
                  <img
                    src={previewUrl}
                    alt="Selected crop"
                    className="mx-auto max-h-[320px] rounded-md object-contain"
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2"
                    onClick={() => setFile(null)}
                    disabled={busy}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <ImagePlus className="size-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag &amp; drop an image, or choose one
                  </p>
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileRef.current?.click()}
                      className="gap-2"
                    >
                      <Upload className="size-4" /> Choose file
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => camRef.current?.click()}
                      className="gap-2"
                    >
                      <Camera className="size-4" /> Camera
                    </Button>
                  </div>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              />
              <input
                ref={camRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <Textarea
              placeholder="Optional: describe what you see (yellow spots, wilting, etc.)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={busy}
            />

            <Button
              onClick={onDiagnose}
              disabled={!file || busy}
              className="w-full gap-2"
              size="lg"
            >
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {uploading ? "Uploading…" : "Analysing image…"}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Diagnose
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {current ? (
            <DiagnosisCard row={current} />
          ) : (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">Your diagnosis will appear here</CardTitle>
                <CardDescription>
                  We combine live weather at your farm, your region, and expert
                  reference material to produce a farmer-friendly report.
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent diagnoses</CardTitle>
              <CardDescription>
                Your last 50 checks — images are stored privately.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {history === null ? (
                <div className="space-y-2">
                  <Skeleton className="h-16 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No diagnoses yet.</p>
              ) : (
                history.map((r) => (
                  <HistoryItem
                    key={r.id}
                    row={r}
                    onOpen={() => setCurrent(r)}
                    onDelete={() => onDelete(r.id)}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

function DiagnosisCard({ row }: { row: DiagnosisRow }) {
  const confidencePct = row.confidence != null ? Math.round(row.confidence * 100) : null;
  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">
              {row.disease ?? "Unknown"}{" "}
              <span className="font-normal text-muted-foreground">
                on {row.crop ?? "crop"}
              </span>
            </CardTitle>
            <CardDescription>
              {new Date(row.createdAt).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={severityTone(row.severity)}>
              Severity: {row.severity ?? "unknown"}
            </Badge>
            {confidencePct !== null && (
              <Badge variant="secondary">Confidence {confidencePct}%</Badge>
            )}
            {row.reviewerStatus === "pending_review" && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                <ShieldAlert className="mr-1 size-3" /> Pending review
              </Badge>
            )}
            {row.reviewerStatus === "approved" && (
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                Reviewer approved
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {row.imageUrl && (
          <img
            src={row.imageUrl}
            alt="Diagnosed crop"
            className="mx-auto max-h-[240px] rounded-md object-contain"
          />
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wide">Source:</span>
          <Badge variant="outline" className="font-normal">
            {row.provider === "cropai"
              ? "CropAI Model"
              : row.provider === "gemini-vision"
                ? "Gemini Vision (Fallback)"
                : row.provider}
          </Badge>
        </div>
        {row.description && <Section label="What we saw" body={row.description} />}
        {row.treatment && <Section label="Treatment" body={row.treatment} />}
        {row.organicTreatment && (
          <Section label="Organic option" body={row.organicTreatment} />
        )}
        {row.prevention && <Section label="Prevention" body={row.prevention} />}
        {row.weatherSnapshot && (
          <p className="text-xs text-muted-foreground">
            Weather context considered · source: open-meteo
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Section({ label, body }: { label: string; body: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function HistoryItem({
  row,
  onOpen,
  onDelete,
}: {
  row: DiagnosisRow;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/60 p-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 items-center gap-3 text-left"
      >
        {row.imageUrl ? (
          <img
            src={row.imageUrl}
            alt=""
            className="size-12 rounded object-cover"
          />
        ) : (
          <div className="size-12 rounded bg-muted" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {row.disease ?? "Unknown"}{" "}
            <span className="font-normal text-muted-foreground">
              · {row.crop ?? "crop"}
            </span>
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {new Date(row.createdAt).toLocaleString()}
            {row.reviewerStatus === "pending_review" && " · pending review"}
          </p>
        </div>
        <Badge variant="outline" className={severityTone(row.severity)}>
          {row.severity ?? "?"}
        </Badge>
      </button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}