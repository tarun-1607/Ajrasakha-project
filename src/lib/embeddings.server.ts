import { GEMINI_EMBEDDING_MODEL } from "@/lib/gemini.server";

/**
 * Server-only helper that turns text into a vector via the official Google
 * Gemini embeddings REST API. Uses gemini-embedding-001 (3072 dims by
 * default). Kept isolated so a future backend (e.g. MongoDB Atlas + a
 * different embedding model) can swap this out without touching the
 * reviewer workflow.
 */
export async function embedText(text: string): Promise<number[]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text: text.slice(0, 8000) }] },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Embedding request failed (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as {
    embedding?: { values?: number[] };
  };
  const vec = json.embedding?.values;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error("Embedding response missing vector");
  }
  return vec;
}