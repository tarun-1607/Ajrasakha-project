/**
 * Knowledge repository abstraction for the Ajrasakha three-tier answer
 * workflow. Concrete implementations (Supabase/Postgres today, MongoDB Atlas
 * later) live behind this interface so the UI never touches storage.
 */
export type KnowledgeTier = "golden" | "pop";

export type KnowledgeMatch = {
  tier: KnowledgeTier;
  answer: string;
  /** 0..1 semantic similarity confidence. */
  confidence: number;
  /** Human-readable source label (e.g. dataset name, PoP publisher). */
  source: string;
  /** ISO timestamp for "last updated". */
  updatedAt: string;
  /** Optional crop tag — mainly for PoP entries. */
  crop?: string;
  /** Optional region metadata for the matched answer. */
  state?: string;
  district?: string;
  block?: string;
  season?: string;
  soilType?: string;
  /** True when the row satisfied the caller's regional context. */
  regional?: boolean;
};

/**
 * Contextual signals used to prioritise regional matches. All fields are
 * optional so the retriever gracefully degrades to national scope when the
 * farmer has not filled their profile.
 */
export type RegionContext = {
  state?: string | null;
  district?: string | null;
  block?: string | null;
  crop?: string | null;
  season?: string | null;
  soilType?: string | null;
};

export type FindAnswerOptions = {
  /** When true, only return matches from the farmer's state/district. */
  requireRegional?: boolean;
};

export interface KnowledgeRepository {
  /**
   * Look up a stored answer for the farmer's question. Return `null` when
   * nothing meets the tier's confidence threshold.
   */
  findAnswer(
    question: string,
    context?: RegionContext,
    options?: FindAnswerOptions,
  ): Promise<KnowledgeMatch | null>;
}