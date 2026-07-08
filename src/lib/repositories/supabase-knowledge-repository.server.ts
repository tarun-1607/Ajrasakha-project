import { createClient } from "@supabase/supabase-js";
import type {
  FindAnswerOptions,
  KnowledgeMatch,
  KnowledgeRepository,
  KnowledgeTier,
  RegionContext,
} from "./knowledge-repository";

/**
 * Keyword-overlap ranker with regional/crop/season boosts as a stand-in
 * for pgvector semantic search. Swap for `embedding <=> query_embedding`
 * once vector search is wired up — the boost logic below is designed to
 * layer on top of a semantic score too (final = base + regional bonuses).
 */
function scoreOverlap(question: string, candidate: string): number {
  const tokenize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 3),
    );
  const q = tokenize(question);
  const c = tokenize(candidate);
  if (q.size === 0 || c.size === 0) return 0;
  let hits = 0;
  for (const t of q) if (c.has(t)) hits += 1;
  return hits / q.size;
}

type Row = {
  question: string;
  answer: string;
  source: string | null;
  crop: string | null;
  state: string | null;
  district: string | null;
  block: string | null;
  season: string | null;
  soil_type: string | null;
  updated_at: string;
};

function eqCI(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function makeClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildRepository(
  table: "golden_answers" | "pop_answers",
  tier: KnowledgeTier,
  defaultSource: string,
  threshold: number,
): KnowledgeRepository {
  return {
    async findAnswer(question, context, options) {
      const client = makeClient();
      if (!client) return null;

      // NOTE: Replace with a semantic-similarity RPC once embeddings exist.
      // For now we pull a candidate set and rank in memory with regional
      // and crop/season boosts so the effective priority order is:
      //   1. regional-golden  → 2. regional-pop
      //   3. national-golden  → 4. national-pop
      //   5. AI (handled by the caller when this returns null)
      let query = client
        .from(table)
        .select(
          "question, answer, source, crop, state, district, block, season, soil_type, updated_at",
        )
        .limit(200);

      // Narrow candidate set for regional passes so we don't hand a
      // regionally-labelled row a national-only boost by accident.
      if (options?.requireRegional && context?.state) {
        query = query.eq("state", context.state);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) return null;

      let best: {
        row: Row;
        baseScore: number;
        score: number;
        regional: boolean;
      } | null = null;
      for (const row of data as Row[]) {
        const base = scoreOverlap(question, row.question);
        if (base < threshold) continue;

        const stateMatch = eqCI(row.state, context?.state);
        const districtMatch = eqCI(row.district, context?.district);
        const cropMatch = eqCI(row.crop, context?.crop);
        const seasonMatch = eqCI(row.season, context?.season);
        const soilMatch = eqCI(row.soil_type, context?.soilType);

        let bonus = 0;
        if (stateMatch) bonus += 0.3;
        if (districtMatch) bonus += 0.2;
        if (cropMatch) bonus += 0.15;
        if (seasonMatch) bonus += 0.1;
        if (soilMatch) bonus += 0.05;

        // A "regional" hit needs at least a state-level match. Callers
        // asking for requireRegional will already have filtered to
        // context.state at the query level.
        const regional = stateMatch || districtMatch;
        if (options?.requireRegional && !regional) continue;

        const score = Math.min(1, base + bonus);
        if (!best || score > best.score) {
          best = { row, baseScore: base, score, regional };
        }
      }
      if (!best) return null;

      const match: KnowledgeMatch = {
        tier,
        answer: best.row.answer,
        confidence: best.score,
        source: best.row.source ?? defaultSource,
        updatedAt: best.row.updated_at,
        crop: best.row.crop ?? undefined,
        state: best.row.state ?? undefined,
        district: best.row.district ?? undefined,
        block: best.row.block ?? undefined,
        season: best.row.season ?? undefined,
        soilType: best.row.soil_type ?? undefined,
        regional: best.regional,
      };
      return match;
    },
  };
}

export function createGoldenRepository(): KnowledgeRepository {
  return buildRepository(
    "golden_answers",
    "golden",
    "Ajrasakha expert reviewers",
    0.5,
  );
}

export function createPopRepository(): KnowledgeRepository {
  return buildRepository(
    "pop_answers",
    "pop",
    "State Package of Practices",
    0.35,
  );
}