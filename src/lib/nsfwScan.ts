/**
 * Shared NSFWJS scanning utility for image moderation.
 * Loads the model once and caches it for reuse.
 */

let modelPromise: Promise<any> | null = null;

async function getModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      try {
        await tf.setBackend("cpu");
        await tf.ready();
      } catch {
        await tf.ready();
      }
      const nsfwjs = await import("nsfwjs");
      return nsfwjs.load();
    })();
  }
  return modelPromise;
}

export interface NsfwScanResult {
  isNsfw: boolean;
  nudityScore: number;
  scores: { porn: number; hentai: number; sexy: number; neutral: number; drawing: number };
}

/**
 * Scan an image element (HTMLImageElement or HTMLCanvasElement) for NSFW content.
 * Returns whether it's NSFW and the individual scores.
 */
export async function scanImageForNsfw(
  source: HTMLImageElement | HTMLCanvasElement,
  threshold = 0.35
): Promise<NsfwScanResult> {
  const model = await getModel();

  // If source is an image, draw it onto a canvas for classification
  let canvas: HTMLCanvasElement;
  if (source instanceof HTMLImageElement) {
    canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(source, 0, 0, 224, 224);
  } else {
    canvas = source;
  }

  const predictions = await model.classify(canvas);
  const getScore = (name: string) =>
    predictions.find((p: any) => p.className === name)?.probability ?? 0;

  const porn = getScore("Porn");
  const hentai = getScore("Hentai");
  const sexy = getScore("Sexy");
  const neutral = getScore("Neutral");
  const drawing = getScore("Drawing");

  const nudityScore = Math.max(porn, hentai, sexy * 0.9);

  return {
    isNsfw: nudityScore >= threshold,
    nudityScore,
    scores: { porn, hentai, sexy, neutral, drawing },
  };
}

/**
 * Scan an image from a URL. Creates a temporary Image element and scans it.
 */
export async function scanImageUrlForNsfw(
  imageUrl: string,
  threshold = 0.60
): Promise<NsfwScanResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = async () => {
      try {
        const result = await scanImageForNsfw(img, threshold);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image for NSFW scan"));
    img.src = imageUrl;
  });
}
