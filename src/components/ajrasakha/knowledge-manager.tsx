import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  bulkImportKnowledgeEntries,
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  listKnowledgeEntries,
  updateKnowledgeEntry,
} from "@/lib/admin-knowledge.functions";
import type {
  KnowledgeCreateInput,
  KnowledgeEntry,
} from "@/lib/repositories/knowledge-admin-repository";
import type { KnowledgeTier } from "@/lib/repositories/knowledge-repository";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Upload,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

type FieldKey =
  | "source"
  | "crop"
  | "category"
  | "state"
  | "district"
  | "block"
  | "season"
  | "soilType";

export type KnowledgeManagerProps = {
  tier: KnowledgeTier;
  title: string;
  description: string;
  fields: FieldKey[];
  accent: "green" | "blue";
};

const PAGE_SIZE = 20;

const FIELD_META: Record<FieldKey, { label: string; placeholder: string }> = {
  source: { label: "Source", placeholder: "e.g. Ajrasakha reviewers" },
  crop: { label: "Crop", placeholder: "e.g. tomato" },
  category: { label: "Category", placeholder: "e.g. pest control" },
  state: { label: "State", placeholder: "e.g. Karnataka" },
  district: { label: "District", placeholder: "e.g. Mysuru" },
  block: { label: "Block / Taluka", placeholder: "e.g. Nanjangud" },
  season: { label: "Season", placeholder: "Kharif / Rabi / Zaid" },
  soilType: { label: "Soil type", placeholder: "e.g. black cotton" },
};

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cur.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      field = "";
      if (cur.some((v) => v.trim().length > 0)) rows.push(cur);
      cur = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    if (cur.some((v) => v.trim().length > 0)) rows.push(cur);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}

export function KnowledgeManager({ tier, title, description, fields, accent }: KnowledgeManagerProps) {
  const listFn = useServerFn(listKnowledgeEntries);
  const createFn = useServerFn(createKnowledgeEntry);
  const updateFn = useServerFn(updateKnowledgeEntry);
  const deleteFn = useServerFn(deleteKnowledgeEntry);
  const bulkFn = useServerFn(bulkImportKnowledgeEntries);

  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KnowledgeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KnowledgeEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const accentClass = accent === "green"
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
    : "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listFn({
        data: { tier, page, pageSize: PAGE_SIZE, search: search || undefined },
      });
      setEntries(res.entries);
      setTotal(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load entries");
    } finally {
      setLoading(false);
    }
  }, [listFn, tier, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(entry: KnowledgeEntry) {
    setEditing(entry);
    setDialogOpen(true);
  }

  async function handleSubmit(input: KnowledgeCreateInput) {
    setSubmitting(true);
    try {
      if (editing) {
        await updateFn({ data: { tier, id: editing.id, input } });
        toast.success("Entry updated");
      } else {
        await createFn({ data: { tier, input } });
        toast.success("Entry added");
      }
      setDialogOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteFn({ data: { tier, id: deleteTarget.id } });
      toast.success("Entry deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        toast.error("CSV appears to be empty");
        return;
      }
      const rows: KnowledgeCreateInput[] = parsed
        .map((r) => ({
          question: r.question ?? "",
          answer: r.answer ?? "",
          source: r.source,
          crop: r.crop,
          category: r.category,
          state: r.state,
          district: r.district,
          block: r.block,
          season: r.season,
          soilType: r.soil_type ?? r.soiltype,
        }))
        .filter((r) => r.question.trim() && r.answer.trim());
      if (rows.length === 0) {
        toast.error("No valid rows found. CSV needs 'question' and 'answer' columns.");
        return;
      }
      const { inserted } = await bulkFn({ data: { tier, rows } });
      toast.success(`Imported ${inserted} row${inserted === 1 ? "" : "s"}`);
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleCsv(f);
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="gap-2"
          >
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import CSV
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="size-4" />
            Add entry
          </Button>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(searchInput.trim());
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search question, answer, crop…"
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="secondary">Search</Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearchInput("");
              setSearch("");
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      <Card className="overflow-hidden rounded-2xl border-border/70">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading entries…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No entries found. Add your first one to get started.
            </div>
          ) : (
            <ul className="divide-y divide-border/70">
              {entries.map((entry) => (
                <li key={entry.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={accentClass}>
                          {tier === "golden" ? "Golden" : "PoP"}
                        </Badge>
                        {entry.hasEmbedding ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="mr-1 size-3" /> Indexed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                            <AlertCircle className="mr-1 size-3" /> Not indexed
                          </Badge>
                        )}
                        {entry.crop && (
                          <span className="text-xs text-muted-foreground">crop: <span className="font-medium text-foreground/80">{entry.crop}</span></span>
                        )}
                        {entry.category && (
                          <span className="text-xs text-muted-foreground">category: <span className="font-medium text-foreground/80">{entry.category}</span></span>
                        )}
                        {entry.state && (
                          <span className="text-xs text-muted-foreground">state: <span className="font-medium text-foreground/80">{entry.state}</span></span>
                        )}
                        {entry.district && (
                          <span className="text-xs text-muted-foreground">district: <span className="font-medium text-foreground/80">{entry.district}</span></span>
                        )}
                        {entry.season && (
                          <span className="text-xs text-muted-foreground">season: <span className="font-medium text-foreground/80">{entry.season}</span></span>
                        )}
                        {entry.soilType && (
                          <span className="text-xs text-muted-foreground">soil: <span className="font-medium text-foreground/80">{entry.soilType}</span></span>
                        )}
                      </div>
                      <div className="text-sm font-semibold">{entry.question}</div>
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">{entry.answer}</div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {entry.source && <span>Source: {entry.source}</span>}
                        <span>Updated {new Date(entry.updatedAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(entry)} aria-label="Edit">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setDeleteTarget(entry)}
                        aria-label="Delete"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total === 0 ? "No results" : `Page ${page} of ${totalPages} — ${total} total`}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <EntryDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        editing={editing}
        fields={fields}
        submitting={submitting}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the entry from the knowledge base.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EntryDialog({
  open,
  onOpenChange,
  editing,
  fields,
  submitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: KnowledgeEntry | null;
  fields: FieldKey[];
  submitting: boolean;
  onSubmit: (input: KnowledgeCreateInput) => Promise<void>;
}) {
  const [form, setForm] = useState<KnowledgeCreateInput>({
    question: "",
    answer: "",
    source: "",
    crop: "",
    category: "",
    state: "",
    district: "",
    block: "",
    season: "",
    soilType: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        question: editing?.question ?? "",
        answer: editing?.answer ?? "",
        source: editing?.source ?? "",
        crop: editing?.crop ?? "",
        category: editing?.category ?? "",
        state: editing?.state ?? "",
        district: editing?.district ?? "",
        block: editing?.block ?? "",
        season: editing?.season ?? "",
        soilType: editing?.soilType ?? "",
      });
    }
  }, [open, editing]);

  const disabled = useMemo(
    () => submitting || !form.question.trim() || !form.answer.trim(),
    [submitting, form],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit entry" : "Add entry"}</DialogTitle>
          <DialogDescription>
            Provide the question exactly as a farmer might ask and a clear expert answer.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmit({
              question: form.question,
              answer: form.answer,
              source: form.source,
              crop: form.crop,
              category: form.category,
              state: form.state,
              district: form.district,
              block: form.block,
              season: form.season,
              soilType: form.soilType,
            });
          }}
          className="space-y-3"
        >
          <div className="space-y-1.5">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              value={form.question}
              onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))}
              placeholder="e.g. Why are my tomato leaves turning yellow?"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="answer">Answer</Label>
            <Textarea
              id="answer"
              value={form.answer}
              onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))}
              placeholder="Clear, actionable expert answer…"
              rows={6}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {fields.map((key) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{FIELD_META[key].label}</Label>
                <Input
                  id={key}
                  value={(form[key] as string | null | undefined) ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={FIELD_META[key].placeholder}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled} className="gap-2">
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgeManagerHint({ title, csvColumns }: { title: string; csvColumns: string[] }) {
  return (
    <Card className="rounded-2xl border-dashed border-border/70 bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground">
        CSV columns supported: <code className="rounded bg-background px-1.5 py-0.5 text-xs">{csvColumns.join(", ")}</code>. The first row must be the header.
      </CardContent>
    </Card>
  );
}