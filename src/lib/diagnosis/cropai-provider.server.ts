import type {
  DiagnoseImageInput,
  DiagnosisResult,
  VisionDiagnosisProvider,
} from "./ai-provider";

/**
 * CropAI provider — calls an external FastAPI model server that classifies
 * the crop + disease from an image. It ONLY performs image classification;
 * downstream guidance (description/treatment/organic/prevention) is left to
 * the hybrid provider so this stays a thin, swappable classifier.
 *
 * The endpoint base URL is read from `CROP_AI_API_URL` at call time. When
 * the env var is missing the provider throws `CropAiUnavailableError` so
 * the hybrid provider can gracefully fall back to Gemini Vision.
 */

export const CROP_AI_PROVIDER_ID = "cropai";
export const CROP_AI_MODEL_NAME = "cropai-fastapi";
const DEFAULT_TIMEOUT_MS = 20_000;

export class CropAiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CropAiUnavailableError";
  }
}

/**
 * Structured `success: false` response from the CropAI backend — e.g. the
 * uploaded image is not a clear crop photo. We surface the backend's
 * message to the farmer instead of falling back to Gemini Vision.
 */
export class CropAiValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CropAiValidationError";
  }
}

type CropAiSuccess = {
  success: true;
  crop: string;
  disease: string;
  /** 0..100 percentage from the model. */
  confidence: number;
  confidence_message?: string;
};

type CropAiFailure = {
  success: false;
  message?: string;
};

type CropAiResponse = CropAiSuccess | CropAiFailure;

export type CropAiClassification = {
  crop: string;
  disease: string;
  /** Normalised to 0..1. */
  confidence: number;
  confidenceMessage?: string;
};

function guessFilename(mimeType: string): string {
  const ext = mimeType.split("/")[1]?.split(";")[0] || "jpg";
  return `crop.${ext === "jpeg" ? "jpg" : ext}`;
}

function normaliseConfidence(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  // Model returns percentage (0..100); support already-normalised 0..1 too.
  const c = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, c));
}

export async function classifyWithCropAi(
  input: Pick<DiagnoseImageInput, "imageBytes" | "mimeType">,
): Promise<CropAiClassification> {
  const base = process.env.CROP_AI_API_URL?.trim();
  if (!base) {
    throw new CropAiUnavailableError("CROP_AI_API_URL is not configured");
  }
  const url = `${base.replace(/\/$/, "")}/predict-disease`;

  const form = new FormData();
  const blob = new Blob([input.imageBytes as unknown as BlobPart], {
    type: input.mimeType || "image/jpeg",
  });
  form.append("file", blob, guessFilename(input.mimeType || "image/jpeg"));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    throw new CropAiUnavailableError(
      `CropAI request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  const rawBody = await res.text();

  if (!res.ok) {
    if (res.status >= 500) {
      throw new CropAiUnavailableError(
        `CropAI returned HTTP ${res.status}: ${rawBody.slice(0, 200)}`,
      );
    }
    // 4xx — surface backend validation message to the farmer.
    let msg: string | undefined;
    try {
      const parsed = JSON.parse(rawBody) as { message?: string; detail?: string };
      msg = parsed.message ?? parsed.detail;
    } catch {
      msg = rawBody.slice(0, 200);
    }
    throw new CropAiValidationError(
      msg?.trim() || `CropAI rejected the request (HTTP ${res.status})`,
    );
  }

  let payload: CropAiResponse;
  try {
    payload = JSON.parse(rawBody) as CropAiResponse;
  } catch (err) {
    throw new CropAiUnavailableError(
      `CropAI returned invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!payload || typeof payload !== "object") {
    throw new CropAiUnavailableError("CropAI returned an empty response");
  }

  if (payload.success === false) {
    // Structured validation failure from CropAI — surface the message to
    // the farmer; do NOT fall back to Gemini Vision.
    throw new CropAiValidationError(
      payload.message?.trim() || "CropAI returned success=false",
    );
  }

  if (payload.success !== true || !payload.crop || !payload.disease) {
    throw new CropAiUnavailableError("CropAI response missing required fields");
  }

  const confidence = normaliseConfidence(payload.confidence);
  return {
    crop: String(payload.crop),
    disease: String(payload.disease),
    confidence,
    confidenceMessage: payload.confidence_message,
  };
}

/**
 * Thin VisionDiagnosisProvider wrapper — kept for symmetry so CropAI can be
 * consumed on its own in tests or other flows. In production the hybrid
 * provider consumes {@link classifyWithCropAi} directly to combine the
 * classification with Gemini-generated guidance.
 */
export function createCropAiProvider(): VisionDiagnosisProvider {
  return {
    id: CROP_AI_PROVIDER_ID,
    model: CROP_AI_MODEL_NAME,
    async diagnose(input: DiagnoseImageInput): Promise<DiagnosisResult> {
      const c = await classifyWithCropAi(input);
      return {
        crop: c.crop,
        disease: c.disease,
        confidence: c.confidence,
        severity: "unknown",
        description: c.confidenceMessage ?? "",
        treatment: "",
        organicTreatment: "",
        prevention: "",
      needsReview: false,
        provider: CROP_AI_PROVIDER_ID,
        model: CROP_AI_MODEL_NAME,
      };
    },
  };
}
