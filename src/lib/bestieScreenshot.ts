import { supabase } from "@/integrations/supabase/client";

/**
 * Captures a frame from a video element and uploads it to bestie-screenshots bucket.
 * Returns the storage path on success.
 */
export async function captureBestieScreenshot(
  videoEl: HTMLVideoElement,
  userId: string,
  pairId: string,
  dayNumber: number,
  role: "inviter" | "invitee"
): Promise<string | null> {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 320;
    canvas.height = videoEl.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.7)
    );
    if (!blob) return null;

    const timestamp = Date.now();
    const path = `${userId}/${pairId}_day${dayNumber}_${role}_${timestamp}.jpg`;

    const { error } = await supabase.storage
      .from("bestie-screenshots")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });

    if (error) {
      console.error("Bestie screenshot upload failed:", error.message);
      return null;
    }

    return path;
  } catch (err) {
    console.error("Bestie screenshot capture failed:", err);
    return null;
  }
}
