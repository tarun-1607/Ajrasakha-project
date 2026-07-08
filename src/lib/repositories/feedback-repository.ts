/**
 * Backend-agnostic feedback / report repository contract.
 *
 * The chat UI and server functions ONLY depend on this interface.
 * To swap Postgres for MongoDB Atlas (or anything else) later:
 *   1. Implement `FeedbackRepository` against the new datastore.
 *   2. Change the single line in `getFeedbackRepository()` (see index.ts).
 * No UI or server-function code needs to change.
 */

export type Rating = "helpful" | "not_helpful";
export type ReportReason = "incorrect" | "incomplete" | "unsafe" | "other";

export interface FeedbackRecord {
  userId: string;
  threadId: string;
  messageId: string;
  question: string;
  answer: string;
  rating: Rating;
}

export interface ReportRecord {
  userId: string;
  threadId: string;
  messageId: string;
  question: string;
  answer: string;
  reason: ReportReason;
  details: string;
}

export interface FeedbackRepository {
  /** Upsert a rating for (userId, messageId). */
  saveFeedback(record: FeedbackRecord): Promise<void>;
  /** Append a new report entry for later expert review. */
  saveReport(record: ReportRecord): Promise<void>;
}