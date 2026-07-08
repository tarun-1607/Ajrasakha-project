import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createGoldenAdminRepository,
  createPopAdminRepository,
} from "@/lib/repositories/supabase-knowledge-admin-repository.server";
import type {
  IndexStatus,
  KnowledgeAdminRepository,
  KnowledgeCreateInput,
  KnowledgeEntry,
  KnowledgeListResult,
  KnowledgeUpdateInput,
} from "@/lib/repositories/knowledge-admin-repository";
import type { KnowledgeTier } from "@/lib/repositories/knowledge-repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side admin operations for the Ajrasakha knowledge bases.
 * All mutation functions require an authenticated user with the `admin` role.
 *
 * Storage sits behind KnowledgeAdminRepository so the app can later swap
 * Supabase/Postgres for MongoDB Atlas by adding a second implementation.
 */

async function assertAdmin(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

function pickRepository(
  supabase: SupabaseClient<Database>,
  tier: KnowledgeTier,
): KnowledgeAdminRepository {
  return tier === "golden"
    ? createGoldenAdminRepository(supabase)
    : createPopAdminRepository(supabase);
}

function normalizeInput(input: KnowledgeCreateInput): KnowledgeCreateInput {
  const clean = (v?: string | null) => {
    if (v === undefined || v === null) return null;
    const trimmed = String(v).trim();
    return trimmed.length > 0 ? trimmed : null;
  };
  const question = String(input.question ?? "").trim();
  const answer = String(input.answer ?? "").trim();
  if (question.length === 0) throw new Error("Question is required");
  if (answer.length === 0) throw new Error("Answer is required");
  if (question.length > 1000) throw new Error("Question is too long (max 1000)");
  if (answer.length > 8000) throw new Error("Answer is too long (max 8000)");
  return {
    question,
    answer,
    source: clean(input.source),
    crop: clean(input.crop),
    category: clean(input.category),
    state: clean(input.state),
    district: clean(input.district),
    block: clean(input.block),
    season: clean(input.season),
    soilType: clean(input.soilType),
  };
}

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) return { isAdmin: false };
    return { isAdmin: Boolean(data) };
  });

type ListArgs = {
  tier: KnowledgeTier;
  page: number;
  pageSize: number;
  search?: string;
};

export const listKnowledgeEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ListArgs) => {
    const page = Math.max(1, Math.floor(Number(data.page) || 1));
    const pageSize = Math.min(100, Math.max(5, Math.floor(Number(data.pageSize) || 20)));
    const tier: KnowledgeTier = data.tier === "pop" ? "pop" : "golden";
    const search = typeof data.search === "string" ? data.search.slice(0, 200) : undefined;
    return { tier, page, pageSize, search };
  })
  .handler(async ({ data, context }): Promise<KnowledgeListResult> => {
    await assertAdmin(context.supabase, context.userId);
    const repo = pickRepository(context.supabase, data.tier);
    return repo.list({ page: data.page, pageSize: data.pageSize, search: data.search });
  });

type CreateArgs = { tier: KnowledgeTier; input: KnowledgeCreateInput };

export const createKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CreateArgs) => {
    const tier: KnowledgeTier = data.tier === "pop" ? "pop" : "golden";
    return { tier, input: normalizeInput(data.input) };
  })
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    await assertAdmin(context.supabase, context.userId);
    const repo = pickRepository(context.supabase, data.tier);
    return repo.create(data.input);
  });

type UpdateArgs = { tier: KnowledgeTier; id: string; input: KnowledgeUpdateInput };

export const updateKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: UpdateArgs) => {
    const tier: KnowledgeTier = data.tier === "pop" ? "pop" : "golden";
    const id = String(data.id ?? "").trim();
    if (!id) throw new Error("Entry id is required");
    return { tier, id, input: normalizeInput({
      question: data.input.question ?? "",
      answer: data.input.answer ?? "",
      source: data.input.source,
      crop: data.input.crop,
      category: data.input.category,
      state: data.input.state,
      district: data.input.district,
      block: data.input.block,
      season: data.input.season,
      soilType: data.input.soilType,
    }) };
  })
  .handler(async ({ data, context }): Promise<KnowledgeEntry> => {
    await assertAdmin(context.supabase, context.userId);
    const repo = pickRepository(context.supabase, data.tier);
    return repo.update(data.id, data.input);
  });

type DeleteArgs = { tier: KnowledgeTier; id: string };

export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: DeleteArgs) => {
    const tier: KnowledgeTier = data.tier === "pop" ? "pop" : "golden";
    const id = String(data.id ?? "").trim();
    if (!id) throw new Error("Entry id is required");
    return { tier, id };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context.supabase, context.userId);
    const repo = pickRepository(context.supabase, data.tier);
    await repo.remove(data.id);
    return { ok: true };
  });

type BulkArgs = { tier: KnowledgeTier; rows: KnowledgeCreateInput[] };

export const bulkImportKnowledgeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: BulkArgs) => {
    const tier: KnowledgeTier = data.tier === "pop" ? "pop" : "golden";
    if (!Array.isArray(data.rows)) throw new Error("rows must be an array");
    if (data.rows.length === 0) throw new Error("No rows to import");
    if (data.rows.length > 500) throw new Error("Import limited to 500 rows per batch");
    const rows = data.rows.map(normalizeInput);
    return { tier, rows };
  })
  .handler(async ({ data, context }): Promise<{ inserted: number }> => {
    await assertAdmin(context.supabase, context.userId);
    const repo = pickRepository(context.supabase, data.tier);
    const inserted = await repo.bulkCreate(data.rows);
    return { inserted };
  });

export const getKnowledgeIndexStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ golden: IndexStatus; pop: IndexStatus }> => {
    await assertAdmin(context.supabase, context.userId);
    const golden = await createGoldenAdminRepository(context.supabase).indexStatus();
    const pop = await createPopAdminRepository(context.supabase).indexStatus();
    return { golden, pop };
  });