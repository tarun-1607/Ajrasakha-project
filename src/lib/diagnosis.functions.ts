import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Crop-diagnosis server functions. Everything image-related flows through
 * Supabase Storage (bucket: `diagnosis-images`) so uploads work identically
 * from Lovable, local dev, GitHub-hosted forks, and production. The image
 * bytes are never stored in the database — only a storage path — and every
 * signed URL is minted server-side with the authenticated user's session.
 */

const DIAGNOSIS_BUCKET = "diagnosis-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1h — enough for reviewer/user browsing

export type DiagnosisRow = {
  id: string;
  crop: string | null;
  disease: string | null;
  confidence: number | null;
  severity: "low" | "medium" | "high" | "unknown" | null;
  description: string | null;
  treatment: string | null;
  organicTreatment: string | null;
  prevention: string | null;
  weatherSnapshot: JsonValue | null;
  region: JsonValue | null;
  provider: string;
  model: string | null;
  reviewerStatus: "not_needed" | "pending_review" | "approved" | "rejected";
  reviewerNotes: string | null;
  imagePath: string;
  imageUrl: string | null;
  createdAt: string;
};

const DiagnoseInputSchema = z.object({
  imagePath: z.string().min(1),
  farmerNote: z.string().max(500).optional(),
});

export const diagnoseCrop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => DiagnoseInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<DiagnosisRow> => {
    const { supabase, userId } = context;

    // Path must live under the user's own folder — enforced by storage RLS
    // too, but we double-check here to fail fast with a clear error.
    const prefix = `${userId}/`;
    if (!data.imagePath.startsWith(prefix)) {
      throw new Error("Invalid image path");
    }

    // Download the image via the caller's Supabase client so RLS applies.
    const { data: blob, error: dlError } = await supabase.storage
      .from(DIAGNOSIS_BUCKET)
      .download(data.imagePath);
    if (dlError || !blob) {
      throw new Error(`Failed to load image: ${dlError?.message ?? "unknown"}`);
    }
    const arrayBuffer = await blob.arrayBuffer();
    const imageBytes = new Uint8Array(arrayBuffer);
    const mimeType = blob.type || "image/jpeg";

    // Load region + weather (best-effort — diagnosis still runs without them).
    const { data: profile } = await supabase
      .from("profiles")
      .select("state, district, block, village, primary_crop, current_season")
      .eq("id", userId)
      .maybeSingle();

    const region = {
      state: profile?.state ?? null,
      district: profile?.district ?? null,
      block: profile?.block ?? null,
      village: profile?.village ?? null,
      crop: profile?.primary_crop ?? null,
      season: profile?.current_season ?? null,
    };

    let weatherForProvider: Record<string, number | string> | undefined;
    let weatherSnapshot: JsonValue | null = null;
    try {
      const { getWeatherForLocation, loadWeatherSettings } = await import(
        "@/lib/weather.server"
      );
      const settings = await loadWeatherSettings();
      if (settings.enabled && (region.state || region.district)) {
        const w = await getWeatherForLocation({
          state: region.state,
          district: region.district,
          block: region.block,
        });
        if (w) {
          const c = w.snapshot.current;
          const t = w.snapshot.today;
          weatherForProvider = {
            temperatureC: c.temperatureC,
            humidity: c.humidity,
            rainProbability: t.precipitationProbabilityMax,
            rainfallMm: t.precipitationSumMm,
            windSpeedKmh: c.windSpeedKmh,
            condition: c.condition,
          };
          weatherSnapshot = {
            ...weatherForProvider,
            cacheAgeMinutes: w.cacheAgeMinutes,
            source: "open-meteo",
          };
        }
      }
    } catch (err) {
      // Weather is best-effort; continue without it.
    }

    const { createHybridVisionProvider } = await import(
      "@/lib/diagnosis/hybrid-vision-provider.server"
    );
    const provider = createHybridVisionProvider();

    const result = await provider
      .diagnose({
        imageBytes,
        mimeType,
        region,
        weather: weatherForProvider as never,
        farmerNote: data.farmerNote,
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error ?? "");
        const quotaLimited =
          message.toLowerCase().includes("quota exceeded") ||
          message.toLowerCase().includes("exceeded your current quota") ||
          message.toLowerCase().includes("generate_content_free_tier_requests");

        return {
          crop: "Unknown",
          disease: "Unknown",
          confidence: 0,
          severity: "unknown" as const,
          description: quotaLimited
            ? "The image was uploaded successfully, but automatic AI diagnosis is temporarily unavailable because the vision model quota is exhausted. This case has been queued for reviewer verification."
            : "The image was uploaded successfully, but automatic AI diagnosis could not be completed. This case has been queued for reviewer verification.",
          treatment:
            "Do not apply chemical treatment based on this incomplete result. Please wait for reviewer guidance or consult a local agronomist/KVK with the crop image.",
          organicTreatment:
            "Until review, isolate visibly infected plant material if practical, avoid overhead irrigation, and monitor nearby plants for spread.",
          prevention:
            "Capture a clear close-up of affected leaves/stems plus one wider plant photo for accurate follow-up diagnosis.",
          needsReview: true,
          provider: provider.id,
          model: provider.model,
        };
      });

    const reviewerStatus: DiagnosisRow["reviewerStatus"] = result.needsReview
      ? "pending_review"
      : "not_needed";

    const { data: inserted, error: insError } = await supabase
      .from("diagnosis_history")
      .insert({
        user_id: userId,
        image_path: data.imagePath,
        crop: result.crop,
        disease: result.disease,
        confidence: result.confidence,
        severity: result.severity,
        description: result.description,
        treatment: result.treatment,
        organic_treatment: result.organicTreatment,
        prevention: result.prevention,
        weather_snapshot: weatherSnapshot as never,
        region: region as never,
        provider: result.provider,
        model: result.model,
        reviewer_status: reviewerStatus,
      })
      .select("*")
      .single();
    if (insError || !inserted) {
      throw new Error(`Failed to save diagnosis: ${insError?.message ?? "unknown"}`);
    }

    const { data: signed } = await supabase.storage
      .from(DIAGNOSIS_BUCKET)
      .createSignedUrl(inserted.image_path, SIGNED_URL_TTL_SECONDS);

    return mapRow(inserted as unknown as DbRow, signed?.signedUrl ?? null);
  });

export const listMyDiagnoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosisRow[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("diagnosis_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return signRows(supabase, (data ?? []) as unknown as DbRow[]);
  });

export const deleteMyDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: row } = await supabase
      .from("diagnosis_history")
      .select("image_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (row?.image_path) {
      await supabase.storage.from(DIAGNOSIS_BUCKET).remove([row.image_path]);
    }
    const { error } = await supabase
      .from("diagnosis_history")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ------------------------- Admin / reviewer APIs ------------------------- */

async function assertReviewer(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = new Set((data ?? []).map((r) => r.role as string));
  if (!roles.has("admin") && !roles.has("reviewer")) {
    throw new Error("Forbidden: admin or reviewer role required");
  }
}

export const listPendingDiagnoses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiagnosisRow[]> => {
    const { supabase, userId } = context;
    await assertReviewer(supabase, userId);
    const { data, error } = await supabase
      .from("diagnosis_history")
      .select("*")
      .in("reviewer_status", ["pending_review"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return signRows(supabase, (data ?? []) as unknown as DbRow[]);
  });

const ReviewInputSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "edit"]),
  disease: z.string().optional(),
  treatment: z.string().optional(),
  organicTreatment: z.string().optional(),
  prevention: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "unknown"]).optional(),
  notes: z.string().max(1000).optional(),
  addToGolden: z.boolean().optional(),
});

export const reviewDiagnosis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ReviewInputSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; addedToGolden: boolean }> => {
    const { supabase, userId } = context;
    await assertReviewer(supabase, userId);

    const patch: Database["public"]["Tables"]["diagnosis_history"]["Update"] = {
      reviewer_status:
        data.action === "approve"
          ? "approved"
          : data.action === "reject"
            ? "rejected"
            : "approved",
      reviewer_notes: data.notes ?? null,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    };
    if (data.disease) patch.disease = data.disease;
    if (data.treatment) patch.treatment = data.treatment;
    if (data.organicTreatment) patch.organic_treatment = data.organicTreatment;
    if (data.prevention) patch.prevention = data.prevention;
    if (data.severity) patch.severity = data.severity;

    const { data: updated, error } = await supabase
      .from("diagnosis_history")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error || !updated) throw new Error(error?.message ?? "Update failed");

    let addedToGolden = false;
    if (data.addToGolden && updated.disease && updated.treatment) {
      const region =
        (updated.region as Record<string, string | null> | null) ?? {};
      const question = `What are the symptoms and treatment of ${updated.disease} on ${updated.crop ?? "the crop"}?`;
      const answer = [
        updated.description ? `Symptoms: ${updated.description}` : null,
        `Treatment: ${updated.treatment}`,
        updated.organic_treatment ? `Organic: ${updated.organic_treatment}` : null,
        updated.prevention ? `Prevention: ${updated.prevention}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const { error: gErr } = await supabase.from("golden_answers").insert({
        question,
        answer,
        source: "Diagnosis review",
        crop: updated.crop,
        state: region.state ?? null,
        district: region.district ?? null,
        block: region.block ?? null,
      });
      addedToGolden = !gErr;
    }

    return { ok: true, addedToGolden };
  });

/* ------------------------------- Helpers -------------------------------- */

type DbRow = {
  id: string;
  image_path: string;
  crop: string | null;
  disease: string | null;
  confidence: number | null;
  severity: "low" | "medium" | "high" | "unknown" | null;
  description: string | null;
  treatment: string | null;
  organic_treatment: string | null;
  prevention: string | null;
  weather_snapshot: unknown;
  region: unknown;
  provider: string;
  model: string | null;
  reviewer_status: "not_needed" | "pending_review" | "approved" | "rejected";
  reviewer_notes: string | null;
  created_at: string;
};

function mapRow(row: DbRow, imageUrl: string | null): DiagnosisRow {
  return {
    id: row.id,
    crop: row.crop,
    disease: row.disease,
    confidence: row.confidence != null ? Number(row.confidence) : null,
    severity: row.severity,
    description: row.description,
    treatment: row.treatment,
    organicTreatment: row.organic_treatment,
    prevention: row.prevention,
    weatherSnapshot: (row.weather_snapshot as JsonValue | null) ?? null,
    region: (row.region as JsonValue | null) ?? null,
    provider: row.provider,
    model: row.model,
    reviewerStatus: row.reviewer_status,
    reviewerNotes: row.reviewer_notes,
    imagePath: row.image_path,
    imageUrl,
    createdAt: row.created_at,
  };
}

async function signRows(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  rows: DbRow[],
): Promise<DiagnosisRow[]> {
  if (rows.length === 0) return [];
  const paths = rows.map((r) => r.image_path);
  const { data: signed } = await supabase.storage
    .from(DIAGNOSIS_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  const byPath = new Map<string, string>();
  (signed ?? []).forEach((s) => {
    if (s.path && s.signedUrl) byPath.set(s.path, s.signedUrl);
  });
  return rows.map((r) => mapRow(r, byPath.get(r.image_path) ?? null));
}
