import { generateObject } from "ai";
import { z } from "zod";
import { createGeminiProvider, GEMINI_CHAT_MODEL } from "@/lib/gemini.server";
import type {
  DiagnoseImageInput,
  DiagnosisResult,
  VisionDiagnosisProvider,
} from "./ai-provider";

const DiagnosisSchema = z.object({
  crop: z.string().min(1).describe("Crop identified in the image (e.g. Rice, Wheat, Tomato). Use 'Unknown' if not identifiable."),
  disease: z.string().min(1).describe("Most likely disease or pest. Use 'Healthy' if the plant appears healthy or 'Unknown' if you cannot identify it."),
  confidence: z.number().min(0).max(1).describe("Confidence in the disease identification, from 0.0 to 1.0."),
  severity: z.enum(["low", "medium", "high", "unknown"]).describe("Estimated severity of the infection."),
  description: z.string().describe("Short description of what you observe in the image (symptoms, affected parts)."),
  treatment: z.string().describe("Recommended chemical / conventional treatment. Include specific active ingredients and dosage where safe."),
  organicTreatment: z.string().describe("Organic or low-input alternative (neem, biocontrol, cultural practices)."),
  prevention: z.string().describe("Prevention & agronomic practices to avoid recurrence."),
});

function buildSystemPrompt(): string {
  return [
    "You are Ajrasakha's crop-diagnosis vision assistant.",
    "Given a photo of a plant/leaf/field, identify the crop and the most likely disease or pest.",
    "If the image does not clearly show a crop or you are not sure, set disease to 'Unknown' and confidence <= 0.4.",
    "Prefer well-known Indian agricultural diseases when the farmer's region is in India.",
    "Be concise, farmer-friendly, and avoid hallucinated dosages — say 'Consult local KVK/agronomist for exact dosage' when unsure.",
    "Respond in English. Use simple sentences.",
  ].join(" ");
}

function buildUserContext(input: DiagnoseImageInput): string {
  const parts: string[] = [];
  const r = input.region ?? {};
  const loc = [r.village, r.block, r.district, r.state].filter(Boolean).join(", ");
  if (loc) parts.push(`Farm location: ${loc}.`);
  if (r.crop) parts.push(`Farmer's primary crop: ${r.crop}.`);
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
  parts.push("Analyse the attached image and return a structured diagnosis.");
  return parts.join("\n");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}

function isQuotaExceededError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("quota exceeded") ||
    message.includes("exceeded your current quota") ||
    message.includes("resource_exhausted") ||
    message.includes("generate_content_free_tier_requests")
  );
}

function createReviewFallbackResult(model: string, error: unknown): DiagnosisResult {
  const quotaLimited = isQuotaExceededError(error);
  return {
    crop: "Unknown",
    disease: "Unknown",
    confidence: 0,
    severity: "unknown",
    description: quotaLimited
      ? "The image was uploaded successfully, but automatic AI diagnosis is temporarily unavailable because the vision model quota is exhausted. This case has been queued for reviewer verification."
      : "The image was uploaded successfully, but automatic AI diagnosis could not be completed. This case has been queued for reviewer verification.",
    treatment:
      "Do not apply chemical treatment based on this incomplete result. Please wait for reviewer guidance or consult a local agronomist/KVK with the crop image.",
    organicTreatment:
      "Until review, isolate visibly infected plant material if practical, avoid overhead irrigation, and monitor nearby plants for spread.",
    prevention:
      "Capture a clear close-up of affected leaves/stems plus one wider plant photo for accurate follow-up diagnosis.",
    needsReview: true,
    provider: "gemini-vision",
    model,
  };
}

export function createGeminiVisionProvider(): VisionDiagnosisProvider {
  const model = GEMINI_CHAT_MODEL;
  return {
    id: "gemini-vision",
    model,
    async diagnose(input: DiagnoseImageInput): Promise<DiagnosisResult> {
      let object: z.infer<typeof DiagnosisSchema>;
      try {
        const google = createGeminiProvider();
        const generated = await generateObject({
          model: google(model),
          schema: DiagnosisSchema,
          system: buildSystemPrompt(),
          maxRetries: 0,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: buildUserContext(input) },
                {
                  type: "image",
                  image: input.imageBytes,
                },
              ],
            },
          ],
        });
        object = generated.object;
      } catch (error) {
        return createReviewFallbackResult(model, error);
      }

      const needsReview =
        object.confidence < 0.6 ||
        object.disease.toLowerCase() === "unknown" ||
        object.crop.toLowerCase() === "unknown";

      return {
        crop: object.crop,
        disease: object.disease,
        confidence: object.confidence,
        severity: object.severity,
        description: object.description,
        treatment: object.treatment,
        organicTreatment: object.organicTreatment,
        prevention: object.prevention,
        needsReview,
        provider: "gemini-vision",
        model,
      };
    },
  };
}
