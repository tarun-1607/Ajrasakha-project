/**
 * AIProvider (vision) interface for the crop diagnosis module.
 *
 * Concrete implementations live in `*.server.ts` files so the frontend
 * never imports a vision SDK directly. Swap Gemini for MiniMax Vision or
 * any other multimodal model by writing a new provider that satisfies
 * this interface — nothing else in the app needs to change.
 */

export type DiagnosisSeverity = "low" | "medium" | "high" | "unknown";

export type DiagnosisRegion = {
  state?: string | null;
  district?: string | null;
  block?: string | null;
  village?: string | null;
  crop?: string | null;
  season?: string | null;
};

export type DiagnosisWeather = {
  temperatureC?: number;
  humidity?: number;
  rainProbability?: number;
  rainfallMm?: number;
  windSpeedKmh?: number;
  condition?: string;
};

export type DiagnoseImageInput = {
  /** Raw image bytes to analyse. */
  imageBytes: Uint8Array;
  /** Mime type — e.g. `image/jpeg`, `image/png`. */
  mimeType: string;
  /** Region/crop/season context to bias the diagnosis. */
  region?: DiagnosisRegion;
  /** Current live weather at the farmer's location. */
  weather?: DiagnosisWeather;
  /** Optional free-text hint from the farmer (e.g. "yellow spots on leaves"). */
  farmerNote?: string;
};

export type DiagnosisResult = {
  crop: string;
  disease: string;
  /** Confidence in the disease identification, 0..1. */
  confidence: number;
  severity: DiagnosisSeverity;
  /** Short description of what the AI saw in the image. */
  description: string;
  /** Recommended chemical treatment. */
  treatment: string;
  /** Organic / low-input alternative. */
  organicTreatment: string;
  /** Prevention & cultural practices. */
  prevention: string;
  /** True when the model is unsure — caller should auto-queue for reviewer. */
  needsReview: boolean;
  /** Provider identifier (e.g. `gemini-vision`) — persisted with each row. */
  provider: string;
  /** Model identifier (e.g. `gemini-2.5-flash`). */
  model: string;
};

export interface VisionDiagnosisProvider {
  readonly id: string;
  readonly model: string;
  diagnose(input: DiagnoseImageInput): Promise<DiagnosisResult>;
}