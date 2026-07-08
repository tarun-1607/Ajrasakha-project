import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FeedbackRepository } from "./repositories/feedback-repository";
import type { SupabaseClient } from "@supabase/supabase-js";

// Swap this factory to change backends (e.g. MongoDB Atlas) later.
// Keep the return type as `FeedbackRepository` so callers don't change.
async function getFeedbackRepository(
  supabase: SupabaseClient,
): Promise<FeedbackRepository> {
  const { SupabaseFeedbackRepository } = await import(
    "./repositories/supabase-feedback-repository.server"
  );
  return new SupabaseFeedbackRepository(supabase);
}

const RatingSchema = z.object({
  threadId: z.string().min(1).max(200),
  messageId: z.string().min(1).max(200),
  question: z.string().max(4000).optional().default(""),
  answer: z.string().max(20000).optional().default(""),
  rating: z.enum(["helpful", "not_helpful"]),
});

const ReportSchema = z.object({
  threadId: z.string().min(1).max(200),
  messageId: z.string().min(1).max(200),
  question: z.string().max(4000).optional().default(""),
  answer: z.string().max(20000).optional().default(""),
  reason: z.enum(["incorrect", "incomplete", "unsafe", "other"]),
  details: z.string().max(2000).optional().default(""),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => RatingSchema.parse(data))
  .handler(async ({ data, context }) => {
    const repo = await getFeedbackRepository(context.supabase);
    await repo.saveFeedback({
      userId: context.userId,
      threadId: data.threadId,
      messageId: data.messageId,
      question: data.question,
      answer: data.answer,
      rating: data.rating,
    });
    return { ok: true };
  });

export const submitReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => ReportSchema.parse(data))
  .handler(async ({ data, context }) => {
    const repo = await getFeedbackRepository(context.supabase);
    await repo.saveReport({
      userId: context.userId,
      threadId: data.threadId,
      messageId: data.messageId,
      question: data.question,
      answer: data.answer,
      reason: data.reason,
      details: data.details,
    });
    return { ok: true };
  });