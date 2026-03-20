import { useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BlueEyesSnapButtonProps {
  remoteVideoRef: React.RefObject<HTMLVideoElement>;
  userId: string;
  challengeId: string | null;
  snapsCount: number;
  maxSnaps: number;
  onSnapTaken: () => void;
}

export default function BlueEyesSnapButton({
  remoteVideoRef,
  userId,
  challengeId,
  snapsCount,
  maxSnaps,
  onSnapTaken,
}: BlueEyesSnapButtonProps) {
  const [snapping, setSnapping] = useState(false);

  if (snapsCount >= maxSnaps || !challengeId) return null;

  const handleSnap = async () => {
    if (!remoteVideoRef.current || snapping) return;
    setSnapping(true);

    try {
      const video = remoteVideoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85)
      );
      if (!blob) throw new Error("Failed to capture");

      // Upload to report-screenshots bucket (reuse existing public bucket)
      const timestamp = Date.now();
      const snapNumber = snapsCount + 1;
      const path = `${userId}/blue-eyes-${snapNumber}-${timestamp}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from("report-screenshots")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("report-screenshots")
        .getPublicUrl(path);

      // Submit as challenge proof
      const { error: subErr } = await supabase.from("challenge_submissions").insert({
        user_id: userId,
        challenge_id: challengeId,
        proof_text: `Blue eyes snap #${snapNumber}`,
        proof_image_url: urlData.publicUrl,
        status: "pending",
      });
      if (subErr) throw subErr;

      toast.success(`📸 Blue eyes snap #${snapNumber} captured!`, {
        description: `${maxSnaps - snapNumber} more to go`,
      });
      onSnapTaken();
    } catch (err: any) {
      toast.error("Snap failed", { description: err.message });
    }
    setSnapping(false);
  };

  return (
    <button
      onClick={handleSnap}
      disabled={snapping}
      className="flex items-center gap-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 backdrop-blur-sm text-cyan-200 font-black text-xs px-3 py-2 rounded-full transition-all active:scale-[0.95] shadow-[0_0_12px_rgba(34,211,238,0.3)]"
    >
      {snapping ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Camera className="w-4 h-4" />
      )}
      👁️ SNAP BLUE EYES ({snapsCount}/{maxSnaps})
    </button>
  );
}
