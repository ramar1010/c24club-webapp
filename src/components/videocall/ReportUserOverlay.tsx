import { X, AlertTriangle } from "lucide-react";
import { useState, RefObject } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import reportIcon from "@/assets/videocall/report-icon.png";

const REPORT_REASONS = [
  "Underage User",
  "Inappropriate Behavior",
  "Nudity / Sexual Content",
  "Harassment / Bullying",
  "Hate Speech / Discrimination",
  "Spam / Scam",
  "Violence / Threats",
  "Other",
] as const;

interface ReportUserOverlayProps {
  reporterId: string;
  reportedUserId: string;
  remoteVideoRef?: RefObject<HTMLVideoElement>;
  onClose: () => void;
}

const captureVideoFrame = (videoRef?: RefObject<HTMLVideoElement>): Blob | null => {
  const video = videoRef?.current;
  if (!video || video.readyState < 2) return null;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  const byteString = atob(dataUrl.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: "image/jpeg" });
};

const ReportUserOverlay = ({ reporterId, reportedUserId, remoteVideoRef, onClose }: ReportUserOverlayProps) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      toast.error("Please select a reason");
      return;
    }
    setSubmitting(true);

    // Capture screenshot of reported user's video
    let screenshotUrl: string | null = null;
    const blob = captureVideoFrame(remoteVideoRef);
    if (blob) {
      const fileName = `${reporterId}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("report-screenshots")
        .upload(fileName, blob, { contentType: "image/jpeg" });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage
          .from("report-screenshots")
          .getPublicUrl(fileName);
        screenshotUrl = urlData?.publicUrl || null;
      }
    }

    const { error } = await supabase.from("user_reports").insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason: selectedReason,
      details: details.trim() || null,
      screenshot_url: screenshotUrl,
    });

    if (error) {
      toast.error("Failed to submit report");
    } else {
      toast.success("Report submitted. Thank you!");
      onClose();
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center px-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm p-5 relative">
        {/* Close */}
        <button onClick={onClose} className="absolute top-3 right-3">
          <X className="w-6 h-6 text-neutral-400 hover:text-white transition-colors" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-5">
          <img src={reportIcon} alt="Report" className="w-14 h-14" />
          <h2 className="text-white text-lg font-black tracking-wider">REPORT USER</h2>
          <p className="text-neutral-500 text-xs text-center">Select a reason for your report</p>
        </div>

        {/* Reason buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              onClick={() => setSelectedReason(reason)}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-all border ${
                selectedReason === reason
                  ? "bg-red-600 border-red-500 text-white"
                  : "bg-neutral-800 border-neutral-700 text-neutral-300 hover:border-neutral-500"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>

        {/* Optional details */}
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Additional details (optional)"
          maxLength={500}
          rows={3}
          className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-red-500 resize-none mb-4"
        />

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedReason || submitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-neutral-700 disabled:text-neutral-500 text-white font-black tracking-wider py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <AlertTriangle className="w-4 h-4" />
          {submitting ? "SUBMITTING..." : "SUBMIT REPORT"}
        </button>
      </div>
    </div>
  );
};

export default ReportUserOverlay;
