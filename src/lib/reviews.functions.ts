import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createSupabaseReviewRepository } from "@/lib/repositories/supabase-review-repository.server";
import { createGoldenAdminRepository } from "@/lib/repositories/supabase-knowledge-admin-repository.server";
import type {
  ReviewItem,
  ReviewListResult,
  ReviewStatus,
} from "@/lib/repositories/review-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Reviewer workflow server functions. Every mutation asserts the caller has
 * either the `admin` or `reviewer` role. All storage access flows through
 * the ReviewRepository interface so the backend is swappable.
 */

async function assertReviewer(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<{ isAdmin: boolean; isReviewer: boolean }> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = new Set((data ?? []).map((r) => r.role as string));
  const isAdmin = roles.has("admin");
  const isReviewer = roles.has("reviewer");
  if (!isAdmin && !isReviewer) {
    throw new Error("Forbidden: reviewer or admin role required");
  }
  return { isAdmin, isReviewer };
}

export const getReviewerAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean; isReviewer: boolean }> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) return { isAdmin: false, isReviewer: false };
    const roles = new Set((data ?? []).map((r) => r.role as string));
    return { isAdmin: roles.has("admin"), isReviewer: roles.has("reviewer") };
  });

type ListArgs = {
  status?: ReviewStatus | "all";
  page?: number;
  pageSize?: number;
  search?: string;
};

export const listPendingReviews = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ListArgs) => {
    const status: ReviewStatus | "all" =
      data.status === "approved" || data.status === "rejected" || data.status === "all"
        ? data.status
        : "pending";
    const page = Math.max(1, Math.floor(Number(data.page) || 1));
    const pageSize = Math.min(50, Math.max(5, Math.floor(Number(data.pageSize) || 20)));
    const search = typeof data.search === "string" ? data.search.slice(0, 200) : undefined;
    return { status, page, pageSize, search };
  })
  .handler(async ({ data, context }): Promise<ReviewListResult & { counts: Record<ReviewStatus, number> }> => {
    await assertReviewer(context.supabase, context.userId);
    const repo = createSupabaseReviewRepository(context.supabase);
    const [list, pending, approved, rejected] = await Promise.all([
      repo.list(data),
      context.supabase
        .from("pending_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      context.supabase
        .from("pending_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved"),
      context.supabase
        .from("pending_reviews")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected"),
    ]);
    return {
      ...list,
      counts: {
        pending: pending.count ?? 0,
        approved: approved.count ?? 0,
        rejected: rejected.count ?? 0,
      },
    };
  });

type EditArgs = { id: string; editedAnswer: string };

export const saveReviewEdit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: EditArgs) => {
    const id = String(data.id ?? "").trim();
    const editedAnswer = String(data.editedAnswer ?? "").trim();
    if (!id) throw new Error("Review id is required");
    if (!editedAnswer) throw new Error("Answer cannot be empty");
    if (editedAnswer.length > 8000) throw new Error("Answer is too long (max 8000)");
    return { id, editedAnswer };
  })
  .handler(async ({ data, context }): Promise<ReviewItem> => {
    await assertReviewer(context.supabase, context.userId);
    return createSupabaseReviewRepository(context.supabase).saveEdit(data.id, data.editedAnswer);
  });

type RejectArgs = { id: string; notes?: string };

export const rejectReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: RejectArgs) => {
    const id = String(data.id ?? "").trim();
    if (!id) throw new Error("Review id is required");
    const notes = typeof data.notes === "string" ? data.notes.slice(0, 2000) : undefined;
    return { id, notes };
  })
  .handler(async ({ data, context }): Promise<ReviewItem> => {
    await assertReviewer(context.supabase, context.userId);
    return createSupabaseReviewRepository(context.supabase).reject(data.id, {
      reviewerId: context.userId,
      reviewerNotes: data.notes ?? null,
    });
  });

type ApproveArgs = { id: string; editedAnswer?: string; notes?: string };

export const approveReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ApproveArgs) => {
    const id = String(data.id ?? "").trim();
    if (!id) throw new Error("Review id is required");
    const editedAnswer =
      typeof data.editedAnswer === "string" && data.editedAnswer.trim().length > 0
        ? data.editedAnswer.trim().slice(0, 8000)
        : undefined;
    const notes = typeof data.notes === "string" ? data.notes.slice(0, 2000) : undefined;
    return { id, editedAnswer, notes };
  })
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: true; goldenId: string; embeddingIndexed: boolean }> => {
      await assertReviewer(context.supabase, context.userId);
      const reviewRepo = createSupabaseReviewRepository(context.supabase);
      const goldenRepo = createGoldenAdminRepository(context.supabase);

      const { item, goldenPayload } = await reviewRepo.approve(data.id, {
        reviewerId: context.userId,
        editedAnswer: data.editedAnswer ?? null,
        reviewerNotes: data.notes ?? null,
      });

      // Insert into the Golden Dataset marked as "Verified Expert Answer".
      const goldenEntry = await goldenRepo.create(goldenPayload);

      // Mark as verified (column is not part of the shared repo shape).
      await context.supabase
        .from("golden_answers")
        .update({ verified: true } as never)
        .eq("id", goldenEntry.id);

      // Best-effort embedding. Failure does not roll back approval — the
      // knowledge manager surfaces missing embeddings in the index panel.
      let embeddingIndexed = false;
      try {
        const { embedText } = await import("@/lib/embeddings.server");
        const vec = await embedText(`${goldenPayload.question}\n\n${goldenPayload.answer}`);
        const { error } = await context.supabase
          .from("golden_answers")
          .update({ embedding: `[${vec.join(",")}]` } as never)
          .eq("id", goldenEntry.id);
        if (error) throw new Error(error.message);
        embeddingIndexed = true;
      } catch (err) {
        console.error("[reviews] embedding failed", err);
      }

      // Suppress unused-var lint on `item` while keeping the descriptive
      // destructure above.
      void item;
      return { ok: true, goldenId: goldenEntry.id, embeddingIndexed };
    },
  );

type GrantArgs = { userEmail: string; role: "reviewer"; action: "grant" | "revoke" };

export const grantReviewerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: GrantArgs) => {
    const userEmail = String(data.userEmail ?? "").trim().toLowerCase();
    if (!userEmail) throw new Error("User email is required");
    const action = data.action === "revoke" ? "revoke" : "grant";
    return { userEmail, action, role: "reviewer" as const };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const roles = await assertReviewer(context.supabase, context.userId);
    if (!roles.isAdmin) throw new Error("Forbidden: admin role required");

    const { data: profile, error: pErr } = await context.supabase
      .from("profiles")
      .select("id")
      .eq("email", data.userEmail)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile) throw new Error("No user with that email");

    if (data.action === "grant") {
      const { error } = await context.supabase
        .from("user_roles")
        .insert({ user_id: profile.id, role: "reviewer" } as never);
      if (error && !/duplicate key/i.test(error.message)) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("user_roles")
        .delete()
        .eq("user_id", profile.id)
        .eq("role", "reviewer");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });