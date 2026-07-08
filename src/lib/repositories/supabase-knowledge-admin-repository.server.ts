import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type {
  IndexStatus,
  KnowledgeAdminRepository,
  KnowledgeCreateInput,
  KnowledgeEntry,
  KnowledgeListResult,
  KnowledgeUpdateInput,
} from "./knowledge-admin-repository";
import type { KnowledgeTier } from "./knowledge-repository";

type Table = "golden_answers" | "pop_answers";

type Row = {
  id: string;
  question: string;
  answer: string;
  source: string | null;
  crop: string | null;
  category: string | null;
  state: string | null;
  district: string | null;
  block: string | null;
  season: string | null;
  soil_type: string | null;
  embedding: unknown;
  created_at: string;
  updated_at: string;
};

const SELECT_COLS =
  "id, question, answer, source, crop, category, state, district, block, season, soil_type, embedding, created_at, updated_at";

function toEntry(row: Row, tier: KnowledgeTier): KnowledgeEntry {
  return {
    id: row.id,
    tier,
    question: row.question,
    answer: row.answer,
    source: row.source,
    crop: row.crop,
    category: row.category,
    state: row.state,
    district: row.district,
    block: row.block,
    season: row.season,
    soilType: row.soil_type,
    hasEmbedding: row.embedding !== null && row.embedding !== undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRowPayload(input: KnowledgeCreateInput | KnowledgeUpdateInput) {
  const payload: Record<string, unknown> = {};
  if (input.question !== undefined) payload.question = input.question;
  if (input.answer !== undefined) payload.answer = input.answer;
  if (input.source !== undefined) payload.source = input.source ?? null;
  if (input.crop !== undefined) payload.crop = input.crop ?? null;
  if (input.category !== undefined) payload.category = input.category ?? null;
  if (input.state !== undefined) payload.state = input.state ?? null;
  if (input.district !== undefined) payload.district = input.district ?? null;
  if (input.block !== undefined) payload.block = input.block ?? null;
  if (input.season !== undefined) payload.season = input.season ?? null;
  if (input.soilType !== undefined) payload.soil_type = input.soilType ?? null;
  return payload;
}

function buildAdminRepository(
  client: SupabaseClient<Database>,
  table: Table,
  tier: KnowledgeTier,
): KnowledgeAdminRepository {
  return {
    async list({ page, pageSize, search }): Promise<KnowledgeListResult> {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      let query = client
        .from(table)
        .select(SELECT_COLS, { count: "exact" })
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (search && search.trim().length > 0) {
        const q = search.trim().replace(/[%,]/g, "");
        query = query.or(
          [
            `question.ilike.%${q}%`,
            `answer.ilike.%${q}%`,
            `crop.ilike.%${q}%`,
            `source.ilike.%${q}%`,
            `category.ilike.%${q}%`,
            `state.ilike.%${q}%`,
            `district.ilike.%${q}%`,
            `block.ilike.%${q}%`,
            `season.ilike.%${q}%`,
            `soil_type.ilike.%${q}%`,
          ].join(","),
        );
      }
      const { data, error, count } = await query;
      if (error) throw new Error(error.message);
      return {
        entries: ((data ?? []) as unknown as Row[]).map((r) => toEntry(r, tier)),
        total: count ?? 0,
      };
    },

    async create(input): Promise<KnowledgeEntry> {
      const { data, error } = await client
        .from(table)
        .insert(toRowPayload(input) as never)
        .select(SELECT_COLS)
        .single();
      if (error) throw new Error(error.message);
      return toEntry(data as unknown as Row, tier);
    },

    async update(id, input): Promise<KnowledgeEntry> {
      const { data, error } = await client
        .from(table)
        .update(toRowPayload(input) as never)
        .eq("id", id)
        .select(SELECT_COLS)
        .single();
      if (error) throw new Error(error.message);
      return toEntry(data as unknown as Row, tier);
    },

    async remove(id): Promise<void> {
      const { error } = await client.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },

    async bulkCreate(inputs): Promise<number> {
      if (inputs.length === 0) return 0;
      const rows = inputs.map((i) => toRowPayload(i));
      const { error, count } = await client
        .from(table)
        .insert(rows as never, { count: "exact" });
      if (error) throw new Error(error.message);
      return count ?? inputs.length;
    },

    async indexStatus(): Promise<IndexStatus> {
      const totalRes = await client
        .from(table)
        .select("id", { count: "exact", head: true });
      if (totalRes.error) throw new Error(totalRes.error.message);
      const indexedRes = await client
        .from(table)
        .select("id", { count: "exact", head: true })
        .not("embedding", "is", null);
      if (indexedRes.error) throw new Error(indexedRes.error.message);
      const total = totalRes.count ?? 0;
      const indexed = indexedRes.count ?? 0;
      return { tier, total, indexed, missing: total - indexed };
    },
  };
}

export function createGoldenAdminRepository(
  client: SupabaseClient<Database>,
): KnowledgeAdminRepository {
  return buildAdminRepository(client, "golden_answers", "golden");
}

export function createPopAdminRepository(
  client: SupabaseClient<Database>,
): KnowledgeAdminRepository {
  return buildAdminRepository(client, "pop_answers", "pop");
}