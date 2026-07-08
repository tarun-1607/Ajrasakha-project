import type { KnowledgeTier } from "./knowledge-repository";

/**
 * Admin-facing CRUD abstraction for both Golden and Package of Practices
 * knowledge stores. Kept separate from the read-side `KnowledgeRepository`
 * so a MongoDB Atlas implementation only needs to reimplement this
 * interface — the UI, server functions, and permission logic stay put.
 */

export type KnowledgeEntry = {
  id: string;
  tier: KnowledgeTier;
  question: string;
  answer: string;
  source: string | null;
  crop: string | null;
  category: string | null;
  state: string | null;
  district: string | null;
  block: string | null;
  season: string | null;
  soilType: string | null;
  hasEmbedding: boolean;
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeCreateInput = {
  question: string;
  answer: string;
  source?: string | null;
  crop?: string | null;
  category?: string | null;
  state?: string | null;
  district?: string | null;
  block?: string | null;
  season?: string | null;
  soilType?: string | null;
};

export type KnowledgeUpdateInput = Partial<KnowledgeCreateInput>;

export type KnowledgeListResult = {
  entries: KnowledgeEntry[];
  total: number;
};

export type IndexStatus = {
  tier: KnowledgeTier;
  total: number;
  indexed: number;
  missing: number;
};

export interface KnowledgeAdminRepository {
  list(params: {
    page: number;
    pageSize: number;
    search?: string;
  }): Promise<KnowledgeListResult>;
  create(input: KnowledgeCreateInput): Promise<KnowledgeEntry>;
  update(id: string, input: KnowledgeUpdateInput): Promise<KnowledgeEntry>;
  remove(id: string): Promise<void>;
  bulkCreate(inputs: KnowledgeCreateInput[]): Promise<number>;
  indexStatus(): Promise<IndexStatus>;
}