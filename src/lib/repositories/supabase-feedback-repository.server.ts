import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FeedbackRecord,
  FeedbackRepository,
  ReportRecord,
} from "./feedback-repository";

/**
 * Postgres (Lovable Cloud) implementation of FeedbackRepository.
 * Uses the request-scoped Supabase client from `requireSupabaseAuth`
 * so writes go through RLS as the current user.
 */
export class SupabaseFeedbackRepository implements FeedbackRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async saveFeedback(record: FeedbackRecord): Promise<void> {
    const { error } = await this.supabase
      .from("feedback")
      .upsert(
        {
          user_id: record.userId,
          thread_id: record.threadId,
          message_id: record.messageId,
          question: record.question,
          answer: record.answer,
          rating: record.rating,
        },
        { onConflict: "user_id,message_id" },
      );
    if (error) throw error;
  }

  async saveReport(record: ReportRecord): Promise<void> {
    const { error } = await this.supabase.from("answer_reports").insert({
      user_id: record.userId,
      thread_id: record.threadId,
      message_id: record.messageId,
      question: record.question,
      answer: record.answer,
      reason: record.reason,
      details: record.details,
    });
    if (error) throw error;
  }
}