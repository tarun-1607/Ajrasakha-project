import { createGeminiProvider, GEMINI_CHAT_MODEL } from "@/lib/gemini.server";
import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  type UIMessage,
} from "ai";
import {
  createGoldenRepository,
  createPopRepository,
} from "@/lib/repositories/supabase-knowledge-repository.server";
import type {
  KnowledgeMatch,
  KnowledgeRepository,
  RegionContext,
} from "@/lib/repositories/knowledge-repository";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { createSupabaseReviewRepository } from "@/lib/repositories/supabase-review-repository.server";
import {
  buildSprayAdvisoryBlock,
  buildWeatherAnswerPrefix,
  buildWeatherAnswerRequirementsBlock,
  buildWeatherPromptBlock,
  buildSprayRecommendationFallback,
  getWeatherForLocation,
  isSprayQuestion,
  loadWeatherSettings,
  type WeatherResult,
} from "@/lib/weather.server";

/** Region chips + verification info attached to every assistant message. */
export type RegionInfo = {
  state?: string;
  district?: string;
  block?: string;
  crop?: string;
  season?: string;
  regional?: boolean;
  weather?: {
    temperatureC: number;
    feelsLikeC: number;
    humidity: number;
    rainProbability: number;
    windSpeedKmh: number;
    condition: string;
    uvIndex: number;
    cacheAgeMinutes: number;
    stale: boolean;
    source: "open-meteo";
  };
};

export type AnswerMetadata =
  | ({
      source: "golden";
      confidence: number;
      sourceName: string;
      updatedAt: string;
    } & RegionInfo)
  | ({
      source: "pop";
      confidence: number;
      sourceName: string;
      updatedAt: string;
    } & RegionInfo)
  | ({ source: "ai" } & RegionInfo);

function deriveSeason(): string {
  const m = new Date().getUTCMonth() + 1;
  if (m >= 6 && m <= 9) return "Kharif";
  if (m >= 10 || m <= 3) return "Rabi";
  return "Zaid";
}

function decodeJwtSubject(token: string): string | null {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    const json = JSON.parse(atob(normalized)) as { sub?: unknown };
    return typeof json.sub === "string" ? json.sub : null;
  } catch {
    return null;
  }
}

function logChatWeatherDebug(
  requestId: string,
  event: string,
  details: Record<string, unknown>,
) {
  console.info(`[chat-weather-debug:${requestId}] ${event}`, details);
}

const SYSTEM_PROMPT = `You are Ajrasakha, a warm and trusted farming assistant for agricultural workers.

Answer the farmer's question in clear, simple language. Prefer concrete, actionable advice: crop guidance, pest and disease control, irrigation, seeds, fertilisers, weather-related decisions, market prices, and government schemes.

Guidelines:
- Be concise and practical. Use short paragraphs and bullet points when helpful.
- If the farmer shares a crop photo, describe what you visually observe (crop, growth stage, visible symptoms) and give a likely diagnosis with next steps. Clearly note that visual diagnosis is preliminary and should be confirmed by a local agricultural officer or extension worker.
- If the question is unclear or region-specific, ask one brief clarifying question (crop, region, growth stage).
- Never invent chemical dosages or scheme details you are not confident about — tell the farmer to check with a local agricultural officer.
- Respond in the language the farmer used.
- Add a short "Verified by Ajrasakha reviewers" note only when you are certain of the answer; otherwise say the answer is AI-generated guidance pending expert review.
- When a LIVE WEATHER block is provided in the context, you MUST cite the actual numeric values (temperature, rain probability, rainfall, wind speed) from it in your answer. NEVER tell the farmer to "check the weather" or "see if rain is expected" — the live values are already known. Base every irrigation, spraying, harvesting or field-work timing recommendation on those exact numbers.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestId = crypto.randomUUID();
        const body = (await request.json()) as { messages?: unknown };
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        let gemini: ReturnType<typeof createGeminiProvider>;
        try {
          gemini = createGeminiProvider();
        } catch (err) {
          return new Response((err as Error).message, { status: 500 });
        }
        const messages = body.messages as UIMessage[];

        // Best-effort: identify the signed-in farmer from the bearer token so
        // pending-review rows can be attributed to them. Chat still works if
        // this is absent (the RLS policy accepts user_id=null inserts).
        const authHeader = request.headers.get("authorization");
        let farmerId: string | null = null;
        let farmerLanguage: string | null = null;
        let farmerCrop: string | null = null;
        let farmerState: string | null = null;
        let farmerDistrict: string | null = null;
        let farmerBlock: string | null = null;
        let farmerSeason: string | null = null;
        let farmerSoil: string | null = null;
        let threadId: string | null = null;
        {
          const hdr = request.headers.get("x-thread-id");
          if (hdr) threadId = hdr;
        }
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const userSupabase =
          authHeader?.startsWith("Bearer ") && SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
            ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                global: { headers: { Authorization: authHeader } },
                auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
              })
            : null;
        if (userSupabase) {
          try {
            const token = authHeader!.replace("Bearer ", "");
            const { data } = await userSupabase.auth.getClaims(token);
            farmerId =
              (data?.claims?.sub as string | undefined) ?? decodeJwtSubject(token);
            if (farmerId) {
              const { data: profile } = await userSupabase
                .from("profiles")
                .select(
                  "preferred_language, primary_crop, state, district, block, current_season, soil_type",
                )
                .eq("id", farmerId)
                .maybeSingle();
              if (profile) {
                farmerLanguage = profile.preferred_language ?? null;
                farmerCrop = profile.primary_crop ?? null;
                farmerState = profile.state ?? null;
                farmerDistrict = profile.district ?? null;
                farmerBlock = profile.block ?? null;
                farmerSeason = (profile.current_season ?? "").trim() || null;
                farmerSoil = (profile.soil_type ?? "").trim() || null;
              }
            }
          } catch (err) {
            console.error("[chat] identify caller failed", err);
            const token = authHeader!.replace("Bearer ", "");
            farmerId = decodeJwtSubject(token);
            if (farmerId) {
              const { data: profile } = await userSupabase
                .from("profiles")
                .select(
                  "preferred_language, primary_crop, state, district, block, current_season, soil_type",
                )
                .eq("id", farmerId)
                .maybeSingle();
              if (profile) {
                farmerLanguage = profile.preferred_language ?? null;
                farmerCrop = profile.primary_crop ?? null;
                farmerState = profile.state ?? null;
                farmerDistrict = profile.district ?? null;
                farmerBlock = profile.block ?? null;
                farmerSeason = (profile.current_season ?? "").trim() || null;
                farmerSoil = (profile.soil_type ?? "").trim() || null;
              }
            }
          }
        }

        const regionContext: RegionContext = {
          state: farmerState,
          district: farmerDistrict,
          block: farmerBlock,
          crop: farmerCrop,
          season: farmerSeason ?? deriveSeason(),
          soilType: farmerSoil,
        };

        // Fetch live weather in parallel with knowledge retrieval so chat is
        // never blocked. Failures are non-fatal — fallback gracefully.
        const weatherPromise: Promise<WeatherResult | null> =
          farmerState || farmerDistrict
            ? getWeatherForLocation({
                state: farmerState,
                district: farmerDistrict,
                block: farmerBlock,
              }).catch((err) => {
                console.error("[chat] weather fetch failed", err);
                return null;
              })
            : Promise.resolve(null);

        // Extract latest user question for knowledge-base lookup.
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        const questionText = lastUser
          ? lastUser.parts
              .filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join(" ")
              .trim()
          : "";

        const sprayDetectorTriggered = questionText.length > 0 && isSprayQuestion(questionText);
        logChatWeatherDebug(requestId, "request-context", {
          hasAuthorizationHeader: Boolean(authHeader?.startsWith("Bearer ")),
          farmerIdentified: Boolean(farmerId),
          state: farmerState,
          district: farmerDistrict,
          block: farmerBlock,
          crop: farmerCrop,
          sprayDetectorTriggered,
          questionLength: questionText.length,
        });

        // Regional-first retrieval order:
        //   1. regional golden  → 2. regional pop
        //   3. national golden  → 4. national pop
        //   5. AI fallback (handled below)
        let match: KnowledgeMatch | null = null;
        // Weather-sensitive questions (spraying, irrigation) must always use
        // live weather in the response — skip curated match so we don't serve
        // a stale generic answer that ignores today's forecast.
        const weatherSensitive = sprayDetectorTriggered;
        if (questionText.length > 0 && !weatherSensitive) {
          const golden = createGoldenRepository();
          const pop = createPopRepository();
          const attempts: Array<{
            repo: KnowledgeRepository;
            requireRegional: boolean;
          }> = [
            { repo: golden, requireRegional: Boolean(regionContext.state) },
            { repo: pop, requireRegional: Boolean(regionContext.state) },
            { repo: golden, requireRegional: false },
            { repo: pop, requireRegional: false },
          ];
          for (const { repo, requireRegional } of attempts) {
            try {
              match = await repo.findAnswer(questionText, regionContext, {
                requireRegional,
              });
            } catch (err) {
              console.error("Knowledge repo error", err);
              match = null;
            }
            if (match) break;
          }
        }

        const weather = await weatherPromise;
        logChatWeatherDebug(requestId, "weather-fetch-result", {
          weatherFetchedSuccessfully: Boolean(weather),
          weatherInjectedIntoPrompt: false,
          cached: weather?.cached ?? null,
          stale: weather?.stale ?? null,
          cacheAgeMinutes: weather?.cacheAgeMinutes ?? null,
          state: weather?.location.state ?? null,
          district: weather?.location.district ?? null,
          block: weather?.location.block ?? null,
          temperatureC: weather?.snapshot.current.temperatureC ?? null,
          humidity: weather?.snapshot.current.humidity ?? null,
          rainProbability: weather?.snapshot.today.precipitationProbabilityMax ?? null,
          rainfallMm: weather?.snapshot.today.precipitationSumMm ?? null,
          windSpeedKmh: weather?.snapshot.current.windSpeedKmh ?? null,
        });
        // If a curated match was found but live weather is available, still
        // prefer the AI path when the question is weather-sensitive so the
        // farmer sees today's numbers, not a generic playbook.
        const weatherMeta = weather
          ? {
              temperatureC: weather.snapshot.current.temperatureC,
              feelsLikeC: weather.snapshot.current.feelsLikeC,
              humidity: weather.snapshot.current.humidity,
              rainProbability:
                weather.snapshot.today.precipitationProbabilityMax,
              windSpeedKmh: weather.snapshot.current.windSpeedKmh,
              condition: weather.snapshot.current.condition,
              uvIndex: weather.snapshot.current.uvIndex,
              cacheAgeMinutes: weather.cacheAgeMinutes,
              stale: weather.stale,
              source: "open-meteo" as const,
            }
          : undefined;

        if (match) {
          logChatWeatherDebug(requestId, "response-path-selected", {
            responsePath: match.tier === "golden" ? "Golden Dataset" : "PoP",
            sprayDetectorTriggered,
            weatherFetchedSuccessfully: Boolean(weather),
            weatherInjectedIntoPrompt: false,
          });
          // Tier 1/2: stream the curated answer verbatim with source metadata.
          const curated = match;
          const stream = createUIMessageStream<UIMessage<AnswerMetadata>>({
            execute: ({ writer }) => {
              writer.write({
                type: "start",
                messageMetadata: {
                  source: curated.tier,
                  confidence: curated.confidence,
                  sourceName: curated.source,
                  updatedAt: curated.updatedAt,
                  crop: curated.crop ?? regionContext.crop ?? undefined,
                  state: curated.state ?? regionContext.state ?? undefined,
                  district:
                    curated.district ?? regionContext.district ?? undefined,
                  block: curated.block ?? regionContext.block ?? undefined,
                  season: curated.season ?? regionContext.season ?? undefined,
                  regional: curated.regional,
                  weather: weatherMeta,
                },
              });
              const id = "curated-text";
              writer.write({ type: "text-start", id });
              writer.write({
                type: "text-delta",
                id,
                delta: curated.answer,
              });
              writer.write({ type: "text-end", id });
            },
          });
          return createUIMessageStreamResponse({ stream });
        }

        // Build region + weather + spray-advisory-aware system prompt.
        const settings = await loadWeatherSettings();
        const contextBlocks: string[] = [SYSTEM_PROMPT];
        const profileParts = [
          farmerState && `State: ${farmerState}`,
          farmerDistrict && `District: ${farmerDistrict}`,
          farmerBlock && `Block/Village: ${farmerBlock}`,
          farmerCrop && `Primary crop: ${farmerCrop}`,
          regionContext.season && `Season: ${regionContext.season}`,
          farmerSoil && `Soil type: ${farmerSoil}`,
          farmerLanguage && `Preferred language: ${farmerLanguage}`,
        ].filter(Boolean) as string[];
        if (profileParts.length) {
          contextBlocks.push(
            "FARMER PROFILE (use this context when relevant):\n" +
              profileParts.map((p) => `- ${p}`).join("\n"),
          );
        }
        if (weather) {
          contextBlocks.push(buildWeatherPromptBlock(weather));
          if (sprayDetectorTriggered) {
            contextBlocks.push(buildWeatherAnswerRequirementsBlock(weather));
            contextBlocks.push(buildSprayAdvisoryBlock(weather, settings));
          }
          contextBlocks.push(
            "When the farmer asks about spraying, irrigation, harvesting, disease pressure or field work, cite the live weather numbers above and give specific timing (e.g., 'spray tomorrow morning 5-7am when wind is 8 km/h').",
          );
        }
        const composedSystem = contextBlocks.join("\n\n");
        const weatherAnswerPrefix =
          weather && sprayDetectorTriggered ? buildWeatherAnswerPrefix(weather) : "";
        logChatWeatherDebug(requestId, "final-gemini-prompt", {
          responsePath: "AI",
          sprayDetectorTriggered,
          weatherFetchedSuccessfully: Boolean(weather),
          weatherInjectedIntoPrompt: Boolean(weather),
          finalPromptSentToGemini: composedSystem,
        });

        async function enqueueForReview(answer: string) {
          if (!userSupabase || !questionText || !answer.trim()) return;
          try {
            const repo = createSupabaseReviewRepository(userSupabase);
            await repo.enqueue({
              question: questionText,
              answer: answer.trim(),
              userId: farmerId,
              language: farmerLanguage,
              crop: farmerCrop,
              threadId,
              messageId: null,
            });
          } catch (err) {
            console.error("[chat] enqueue for review failed", err);
          }
        }

        // Tier 3: AI-generated response.
        const result = streamText({
          model: gemini(GEMINI_CHAT_MODEL),
          system: composedSystem,
          messages: await convertToModelMessages(messages),
          onFinish: async ({ text }) => {
            // Auto-enqueue every AI-generated answer for reviewer approval.
            await enqueueForReview(`${weatherAnswerPrefix}${text ?? ""}`);
          },
        });

        if (weatherAnswerPrefix) {
          const stream = createUIMessageStream<UIMessage<AnswerMetadata>>({
            execute: async ({ writer }) => {
              writer.write({
                type: "start",
                messageMetadata: {
                  source: "ai" as const,
                  state: regionContext.state ?? undefined,
                  district: regionContext.district ?? undefined,
                  block: regionContext.block ?? undefined,
                  crop: regionContext.crop ?? undefined,
                  season: regionContext.season ?? undefined,
                  regional: false,
                  weather: weatherMeta,
                },
              });
              const id = "weather-aware-ai-text";
              writer.write({ type: "text-start", id });
              writer.write({ type: "text-delta", id, delta: weatherAnswerPrefix });
              let aiText = "";
              let aiErrored = false;
              try {
                for await (const delta of result.textStream) {
                  aiText += delta;
                  writer.write({ type: "text-delta", id, delta });
                }
              } catch (err) {
                aiErrored = true;
                console.error("[chat] AI stream failed, using deterministic fallback", err);
              }
              // Guarantee the farmer receives an actionable recommendation even
              // if Gemini fails (quota, network) or returns empty text.
              if (weather && (aiErrored || aiText.trim().length === 0)) {
                const fallback = buildSprayRecommendationFallback(weather, settings);
                writer.write({
                  type: "text-delta",
                  id,
                  delta: (aiText.length ? "\n\n" : "") + fallback,
                });
              }
              writer.write({ type: "text-end", id });
            },
            onError: (error) => {
              console.error("Chat stream error", error);
              if (error instanceof Error) return error.message;
              return "Something went wrong. Please try again.";
            },
          });
          return createUIMessageStreamResponse({ stream });
        }

        return result.toUIMessageStreamResponse<UIMessage<AnswerMetadata>>({
          originalMessages: messages as UIMessage<AnswerMetadata>[],
          messageMetadata: ({ part }) => {
            if (part.type === "start") {
              return {
                source: "ai" as const,
                state: regionContext.state ?? undefined,
                district: regionContext.district ?? undefined,
                block: regionContext.block ?? undefined,
                crop: regionContext.crop ?? undefined,
                season: regionContext.season ?? undefined,
                regional: false,
                weather: weatherMeta,
              };
            }
            return undefined;
          },
          onError: (error) => {
            console.error("Chat stream error", error);
            if (error instanceof Error) return error.message;
            return "Something went wrong. Please try again.";
          },
        });
      },
    },
  },
});