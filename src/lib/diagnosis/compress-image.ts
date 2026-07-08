/**
 * Client-side image compression for crop diagnosis uploads.
 *
 * Goals:
 *  - Keep uploads under `maxBytes` (default 2 MB) to save storage + bandwidth.
 *  - Preserve enough detail for vision-based disease detection: cap the long
 *    edge at 1600 px (typical vision models downscale to ~1024 px anyway),
 *    stay in JPEG at q≈0.85, and only step down if the file is still too big.
 *  - Never upscale a small image, never re-encode a file that is already
 *    small enough — that would just lose quality for no gain.
 */

export type CompressOptions = {
  maxBytes?: number;
  maxDimension?: number;
  mimeType?: "image/jpeg" | "image/webp";
  initialQuality?: number;
  minQuality?: number;
};

export type CompressedImage = {
  file: File;
  width: number;
  height: number;
  originalBytes: number;
  compressedBytes: number;
  skipped: boolean;
};

const DEFAULTS: Required<CompressOptions> = {
  maxBytes: 2 * 1024 * 1024,
  maxDimension: 1600,
  mimeType: "image/jpeg",
  initialQuality: 0.85,
  minQuality: 0.5,
};

async function loadBitmap(file: File): Promise<{ width: number; height: number; source: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      source: bitmap,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to load image"));
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      source: img,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encoding failed"))),
      type,
      quality,
    );
  });
}

export async function compressImage(
  file: File,
  options: CompressOptions = {},
): Promise<CompressedImage> {
  const opts = { ...DEFAULTS, ...options };

  // Skip if the file is already small and a common web format — re-encoding
  // would only degrade quality.
  if (
    file.size <= opts.maxBytes &&
    (file.type === "image/jpeg" || file.type === "image/webp")
  ) {
    const dims = await loadBitmap(file).catch(() => null);
    if (dims) {
      const skip =
        Math.max(dims.width, dims.height) <= opts.maxDimension;
      dims.close();
      if (skip) {
        return {
          file,
          width: dims.width,
          height: dims.height,
          originalBytes: file.size,
          compressedBytes: file.size,
          skipped: true,
        };
      }
    }
  }

  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, opts.maxDimension / Math.max(bitmap.width, bitmap.height));
  const targetW = Math.max(1, Math.round(bitmap.width * scale));
  const targetH = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Canvas 2D context unavailable");
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap.source, 0, 0, targetW, targetH);
  bitmap.close();

  let quality = opts.initialQuality;
  let blob = await canvasToBlob(canvas, opts.mimeType, quality);
  while (blob.size > opts.maxBytes && quality > opts.minQuality) {
    quality = Math.max(opts.minQuality, quality - 0.1);
    blob = await canvasToBlob(canvas, opts.mimeType, quality);
  }

  const ext = opts.mimeType === "image/webp" ? "webp" : "jpg";
  const baseName = file.name.replace(/\.[^.]+$/, "");
  const compressed = new File([blob], `${baseName}.${ext}`, {
    type: opts.mimeType,
    lastModified: Date.now(),
  });

  return {
    file: compressed,
    width: targetW,
    height: targetH,
    originalBytes: file.size,
    compressedBytes: compressed.size,
    skipped: false,
  };
}