import type { KnowledgeCreateInput } from "./knowledge-admin-repository";

/**
 * Reviewer-facing abstraction over the pending-review queue.
 *
 * Keeping the queue behind an interface means the storage backend can be
 * swapped (Supabase Postgres today, MongoDB Atlas tomorrow) without any
 * change to the reviewer server functions or UI.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type FeedbackSummary = {
  helpful: number;
  notHelpful: number;
  reports: Array<{ reason: string; details: string; createdAt: string }>;
};

export type ReviewItem = {
  id: string;
  messageId: string | null;
  threadId: string | null;
  userId: string | null;
  question: string;
  answer: string;
  editedAnswer: string | null;
  language: string | null;
  crop: string | null;
  status: ReviewStatus;
  reviewerId: string | null;
  reviewedAt: string | null;
  reviewerNotes: string | null;
  createdAt: string;
  updatedAt: string;
  feedback: FeedbackSummary;
};

export type ReviewListResult = {
  items: ReviewItem[];
  total: number;
};

export type EnqueueInput = {
  messageId?: string | null;
  threadId?: string | null;
  userId?: string | null;
  question: string;
  answer: string;
  language?: string | null;
  crop?: string | null;
};

export type ReviewDecisionInput = {
  reviewerId: string;
  editedAnswer?: string | null;
  reviewerNotes?: string | null;
};

export interface ReviewRepository {
  enqueue(input: EnqueueInput): Promise<{ id: string } | null>;
  list(params: {
    status: ReviewStatus | "all";
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<ReviewListResult>;
  get(id: string): Promise<ReviewItem | null>;
  approve(id: string, decision: ReviewDecisionInput): Promise<{
    item: ReviewItem;
    goldenPayload: KnowledgeCreateInput;
  }>;
  reject(id: string, decision: ReviewDecisionInput): Promise<ReviewItem>;
  saveEdit(id: string, editedAnswer: string): Promise<ReviewItem>;
}