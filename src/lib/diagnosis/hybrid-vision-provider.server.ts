import { generateObject } from "ai";
import { z } from "zod";
import { createGeminiProvider, GEMINI_CHAT_MODEL } from "@/lib/gemini.server";
import type {
  DiagnoseImageInput,
  DiagnosisResult,
  VisionDiagnosisProvider,
} from "./ai-provider";
import {
  classifyWithCropAi,
  CROP_AI_MODEL_NAME,
  CROP_AI_PROVIDER_ID,
  CropAiUnavailableError,
  CropAiValidationError,
} from "./cropai-provider.server";
import { createGeminiVisionProvider } from "./gemini-vision-provider.server";

/**
 * Crops the current CropAI TensorFlow model was trained on. Anything
 * outside this list is delegated to Gemini Vision, and the farmer sees a
 * clear "not yet supported" note in the description.
 */
const CROP_AI_SUPPORTED_CROPS = new Set(["tomato", "potato", "bell pepper", "pepper bell"]);
const CROP_AI_MIN_CONFIDENCE = 0.5;

function isSupportedCrop(crop: string): boolean {
  const normalised = crop.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (CROP_AI_SUPPORTED_CROPS.has(normalised)) return true;
  // Handle CropAI variants like "Pepper,_bell" / "Tomato___Early_blight".
  for (const supported of CROP_AI_SUPPORTED_CROPS) {
    if (normalised.startsWith(supported)) return true;
  }
  return false;
}

/**
 * HybridVisionProvider
 *
 * 1. Try CropAI first (fast, specialised classifier).
 *    - If it returns success=true → use its crop/disease/confidence and
 *      ask Gemini (text-only) to generate farmer guidance.
 *    - If it returns success=false → surface the validation message to
 *      the farmer and do NOT call Gemini Vision.
 *    - If it errors (network / timeout / unsupported crop / low confidence
 *      / CROP_AI_API_URL missing) → silently fall back to Gemini Vision.
 * 2. Otherwise fall back to the existing Gemini Vision provider — the
 *    behaviour the app had before this provider existed is preserved.
 */

const GuidanceSchema = z.object({
  severity: z
    .enum(["low", "medium", "high", "unknown"])
    .describe("Estimated severity of the infection for this crop/disease."),
  description: z
    .string()
    .describe("Short farmer-friendly description of the disease and its typical symptoms."),
  treatment: z
    .string()
    .describe("Recommended chemical / conventional treatment. Say 'Consult local KVK/agronomist for exact dosage' when unsure."),
  organicTreatment: z
    .string()
    .describe("Organic or low-input alternative (neem, biocontrol, cultural practices)."),
  prevention: z
    .string()
    .describe("Prevention & agronomic practices to avoid recurrence."),
});

function buildGuidanceContext(
  crop: string,
  disease: string,
  input: DiagnoseImageInput,
): string {
  const parts: string[] = [];
  parts.push(`Crop: ${crop}. Disease: ${disease}.`);
  const r = input.region ?? {};
  const loc = [r.village, r.block, r.district, r.state].filter(Boolean).join(", ");
  if (loc) parts.push(`Farm location: ${loc}.`);
  if (r.season) parts.push(`Season: ${r.season}.`);
  const w = input.weather;
  if (w) {
    const bits: string[] = [];
    if (typeof w.temperatureC === "number") bits.push(`temp ${w.temperatureC}°C`);
    if (typeof w.humidity === "number") bits.push(`humidity ${w.humidity}%`);
    if (typeof w.rainProbability === "number") bits.push(`rain probability ${w.rainProbability}%`);
    if (typeof w.rainfallMm === "number") bits.push(`rainfall ${w.rainfallMm} mm`);
    if (typeof w.windSpeedKmh === "number") bits.push(`wind ${w.windSpeedKmh} km/h`);
    if (w.condition) bits.push(w.condition);
    if (bits.length) parts.push(`Current weather: ${bits.join(", ")}.`);
  }
  if (input.farmerNote) parts.push(`Farmer's note: ${input.farmerNote}`);
  parts.push(
    "Do NOT re-classify the image — trust the given crop and disease. Return only structured farmer guidance.",
  );
  return parts.join("\n");
}

function isQuotaExceededError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("resource_exhausted") ||
    message.includes("generate_content_free_tier_requests")
  );
}

function buildMinimalGuidance(crop: string, disease: string): z.infer<typeof GuidanceSchema> {
  return {
    severity: "unknown",
    description: `${disease} identified on ${crop}. Follow standard management practices below and consult your local agronomist/KVK for crop-specific dosages.`,
    treatment:
      "Consult your local KVK/agronomist for the exact chemical treatment and dosage suited to your region.",
    organicTreatment:
      "Isolate visibly infected plant material if practical, avoid overhead irrigation, and monitor nearby plants for spread.",
    prevention:
      "Practice crop rotation, use disease-free seed, and monitor fields regularly for early symptoms.",
  };
}

async function generateGuidance(
  crop: string,
  disease: string,
  input: DiagnoseImageInput,
): Promise<{ object: z.infer<typeof GuidanceSchema>; needsReview: boolean }> {
  try {
    const google = createGeminiProvider();
    const { object } = await generateObject({
      model: google(GEMINI_CHAT_MODEL),
      schema: GuidanceSchema,
      system:
        "You are Ajrasakha's crop-diagnosis guidance assistant. You are GIVEN the crop and disease from a specialised classifier — never contradict them. Produce concise, farmer-friendly guidance in English. Prefer Indian agronomic practice when the region is in India.",
      maxRetries: 0,
      prompt: buildGuidanceContext(crop, disease, input),
    });
    return { object, needsReview: false };
  } catch (error) {
    return { object: buildMinimalGuidance(crop, disease), needsReview: true };
  }
}

export function createHybridVisionProvider(): VisionDiagnosisProvider {
  const geminiFallback = createGeminiVisionProvider();
  return {
    id: "hybrid-vision",
    model: `${CROP_AI_MODEL_NAME}+${GEMINI_CHAT_MODEL}`,
    async diagnose(input: DiagnoseImageInput): Promise<DiagnosisResult> {
      // 1) CropAI classification (primary).
      try {
        const classification = await classifyWithCropAi(input);
        // Route unsupported crops (or low-confidence supported crops) to
        // Gemini Vision so the farmer still gets a real diagnosis.
        if (!isSupportedCrop(classification.crop) || classification.confidence < CROP_AI_MIN_CONFIDENCE) {
          const geminiResult = await geminiFallback.diagnose(input);
          const note = "This crop is not yet supported by the current disease model. Diagnosis generated by Gemini Vision.";
          return {
            ...geminiResult,
            description: geminiResult.description
              ? `${note}\n\n${geminiResult.description}`
              : note,
          };
        }
        const { object, needsReview } = await generateGuidance(
          classification.crop,
          classification.disease,
          input,
        );
        return {
          crop: classification.crop,
          disease: classification.disease,
          confidence: classification.confidence,
          severity: object.severity,
          description: object.description,
          treatment: object.treatment,
          organicTreatment: object.organicTreatment,
          prevention: object.prevention,
          needsReview,
          provider: CROP_AI_PROVIDER_ID,
          model: CROP_AI_MODEL_NAME,
        };
      } catch (error) {
        // Structured validation failure (success=false or 4xx) — surface the
        // backend's message to the farmer; do NOT fall back to Gemini.
        if (error instanceof CropAiValidationError) {
          return {
            crop: "Unknown",
            disease: "Unknown",
            confidence: 0,
            severity: "unknown",
            description: error.message,
            treatment: "",
            organicTreatment: "",
            prevention: "",
            needsReview: true,
            provider: CROP_AI_PROVIDER_ID,
            model: CROP_AI_MODEL_NAME,
          };
        }
        // Network / timeout / 5xx / invalid response → Gemini fallback.
        void (error instanceof CropAiUnavailableError);
        return geminiFallback.diagnose(input);
      }
    },
  };
}
