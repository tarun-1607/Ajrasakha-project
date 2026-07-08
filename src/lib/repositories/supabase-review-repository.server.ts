import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  EnqueueInput,
  FeedbackSummary,
  ReviewDecisionInput,
  ReviewItem,
  ReviewListResult,
  ReviewRepository,
  ReviewStatus,
} from "./review-repository";

type Row = Database["public"]["Tables"]["pending_reviews"]["Row"];

function toItem(row: Row, feedback: FeedbackSummary): ReviewItem {
  return {
    id: row.id,
    messageId: row.message_id,
    threadId: row.thread_id,
    userId: row.user_id,
    question: row.question,
    answer: row.answer,
    editedAnswer: row.edited_answer,
    language: row.language,
    crop: row.crop,
    status: row.status as ReviewStatus,
    reviewerId: row.reviewer_id,
    reviewedAt: row.reviewed_at,
    reviewerNotes: row.reviewer_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    feedback,
  };
}

async function loadFeedback(
  client: SupabaseClient<Database>,
  messageIds: string[],
): Promise<Map<string, FeedbackSummary>> {
  const out = new Map<string, FeedbackSummary>();
  if (messageIds.length === 0) return out;

  const [ratingRes, reportRes] = await Promise.all([
    client
      .from("feedback")
      .select("message_id, rating")
      .in("message_id", messageIds),
    client
      .from("answer_reports")
      .select("message_id, reason, details, created_at")
      .in("message_id", messageIds),
  ]);

  const ensure = (id: string): FeedbackSummary => {
    let s = out.get(id);
    if (!s) {
      s = { helpful: 0, notHelpful: 0, reports: [] };
      out.set(id, s);
    }
    return s;
  };

  for (const r of ratingRes.data ?? []) {
    const s = ensure(r.message_id);
    if (r.rating === "helpful") s.helpful += 1;
    else s.notHelpful += 1;
  }
  for (const r of reportRes.data ?? []) {
    const s = ensure(r.message_id);
    s.reports.push({ reason: r.reason, details: r.details, createdAt: r.created_at });
  }
  return out;
}

export function createSupabaseReviewRepository(
  client: SupabaseClient<Database>,
): ReviewRepository {
  return {
    async enqueue(input: EnqueueInput) {
      const payload = {
        message_id: input.messageId ?? null,
        thread_id: input.threadId ?? null,
        user_id: input.userId ?? null,
        question: input.question,
        answer: input.answer,
        language: input.language ?? null,
        crop: input.crop ?? null,
        status: "pending",
      };
      const { data, error } = await client
        .from("pending_reviews")
        .insert(payload as never)
        .select("id")
        .single();
      if (error) {
        console.error("[review-repo] enqueue failed", error);
        return null;
      }
      return { id: (data as { id: string }).id };
    },

    async list({ status, page, pageSize, search }): Promise<ReviewListResult> {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = client
        .from("pending_reviews")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);
      if (status !== "all") query = query.eq("status", status);
      if (search && search.trim().length > 0) {
        const q = search.trim().replace(/[%,]/g, "");
        query = query.or(
          [`question.ilike.%${q}%`, `answer.ilike.%${q}%`, `crop.ilike.%${q}%`].join(","),
        );
      }
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Row[];
      const feedback = await loadFeedback(
        client,
        rows.map((r) => r.message_id).filter((m): m is string => !!m),
      );
      const items = rows.map((r) =>
        toItem(r, feedback.get(r.message_id ?? "") ?? { helpful: 0, notHelpful: 0, reports: [] }),
      );
      return { items, total: count ?? 0 };
    },

    async get(id) {
      const { data, error } = await client
        .from("pending_reviews")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as Row;
      const feedback = await loadFeedback(client, row.message_id ? [row.message_id] : []);
      return toItem(
        row,
        feedback.get(row.message_id ?? "") ?? { helpful: 0, notHelpful: 0, reports: [] },
      );
    },

    async approve(id, decision: ReviewDecisionInput) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Review not found");
      if (existing.status !== "pending") throw new Error("Review already processed");
      const finalAnswer = (decision.editedAnswer ?? existing.editedAnswer ?? existing.answer).trim();
      if (!finalAnswer) throw new Error("Answer cannot be empty");

      const { data, error } = await client
        .from("pending_reviews")
        .update({
          status: "approved",
          reviewer_id: decision.reviewerId,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: decision.reviewerNotes ?? null,
          edited_answer: decision.editedAnswer ?? existing.editedAnswer ?? null,
        } as never)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      const row = data as Row;
      const feedback = await loadFeedback(client, row.message_id ? [row.message_id] : []);
      return {
        item: toItem(
          row,
          feedback.get(row.message_id ?? "") ?? { helpful: 0, notHelpful: 0, reports: [] },
        ),
        goldenPayload: {
          question: existing.question,
          answer: finalAnswer,
          source: "Verified Expert Answer",
          crop: existing.crop ?? null,
          category: null,
          state: null,
        },
      };
    },

    async reject(id, decision: ReviewDecisionInput) {
      const { data, error } = await client
        .from("pending_reviews")
        .update({
          status: "rejected",
          reviewer_id: decision.reviewerId,
          reviewed_at: new Date().toISOString(),
          reviewer_notes: decision.reviewerNotes ?? null,
        } as never)
        .eq("id", id)
        .eq("status", "pending")
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const row = data as Row;
      const feedback = await loadFeedback(client, row.message_id ? [row.message_id] : []);
      return toItem(
        row,
        feedback.get(row.message_id ?? "") ?? { helpful: 0, notHelpful: 0, reports: [] },
      );
    },

    async saveEdit(id, editedAnswer) {
      const { data, error } = await client
        .from("pending_reviews")
        .update({ edited_answer: editedAnswer } as never)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const row = data as Row;
      const feedback = await loadFeedback(client, row.message_id ? [row.message_id] : []);
      return toItem(
        row,
        feedback.get(row.message_id ?? "") ?? { helpful: 0, notHelpful: 0, reports: [] },
      );
    },
  };
}