import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Creates the official Google Gemini provider for the Vercel AI SDK.
 * Reads GEMINI_API_KEY from the environment.
 */
export function createGeminiProvider() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");
  return createGoogleGenerativeAI({ apiKey });
}

export const GEMINI_CHAT_MODEL = "gemini-2.5-flash";
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-001";