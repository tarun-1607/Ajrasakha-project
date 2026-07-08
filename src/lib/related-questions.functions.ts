import { createGeminiProvider, GEMINI_CHAT_MODEL } from "@/lib/gemini.server";
import { createServerFn } from "@tanstack/react-start";
import { generateText, NoObjectGeneratedError, Output } from "ai";
import { z } from "zod";

const Input = z.object({
  question: z.string().min(1).max(4000),
  answer: z.string().min(1).max(8000),
});

const Schema = z.object({
  questions: z.array(z.string()),
});

export const getRelatedQuestions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const gemini = createGeminiProvider();
    let parsed: { questions: string[] } = { questions: [] };
    try {
      const { output } = await generateText({
        model: gemini(GEMINI_CHAT_MODEL),
        output: Output.object({ schema: Schema }),
        system:
          "You suggest short, natural follow-up farming questions a farmer might ask next. Keep each question under 12 words, practical, specific to the topic, and phrased as a question. Match the language of the user's original question. Always return exactly 3 questions.",
        prompt: `Original question:\n${data.question}\n\nAnswer given:\n${data.answer}\n\nGenerate exactly 3 concise related follow-up questions.`,
      });
      parsed = output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error) && error.text) {
        try {
          const match = error.text.match(/\{[\s\S]*\}/);
          if (match) parsed = Schema.parse(JSON.parse(match[0]));
        } catch {
          // fall through with empty
        }
      } else {
        // Swallow quota/rate-limit and other AI errors so the UI doesn't crash.
        // Related questions are a non-critical enhancement.
        console.warn("[related-questions] generation failed:", error instanceof Error ? error.message : error);
      }
    }

    const questions = (parsed.questions ?? [])
      .filter((q) => typeof q === "string" && q.trim().length > 0)
      .slice(0, 3);
    return { questions };
  });