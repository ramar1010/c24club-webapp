import { useRef, useState, useCallback } from "react";
import { Camera, RotateCcw, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface SelfieCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onComplete: (imageUrl: string) => void;
}

const SelfieCaptureModal = ({ open, onClose, onComplete }: SelfieCaptureModalProps) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [step, setStep] = useState<"camera" | "preview" | "uploading">("camera");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [cameraStarted, setCameraStarted] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 640 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraStarted(true);
    } catch {
      toast({ title: "Camera access denied", description: "Please allow camera access to take a selfie.", variant: "destructive" });
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraStarted(false);
  }, []);

  const analyzeBrightness = useCallback((canvas: HTMLCanvasElement): { brightness: number; isTooDark: boolean; isTooUniform: boolean } => {
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let totalBrightness = 0;
    const pixelCount = pixels.length / 4;
    const brightnessBuckets = new Array(10).fill(0);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
      totalBrightness += brightness;
      brightnessBuckets[Math.min(9, Math.floor(brightness / 25.6))]++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    // Check if >85% of pixels fall in the same bucket (too uniform = covered camera / solid color)
    const maxBucket = Math.max(...brightnessBuckets);
    const isTooUniform = maxBucket / pixelCount > 0.85;

    return {
      brightness: avgBrightness,
      isTooDark: avgBrightness < 40,
      isTooUniform,
    };
  }, []);

  const takeSnapshot = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 480, 480);

    // Analyze brightness before accepting
    const { isTooDark, isTooUniform } = analyzeBrightness(canvas);
    if (isTooDark) {
      toast({ title: "Too dark! 🌑", description: "Your photo is too dark. Move to a well-lit area and try again.", variant: "destructive" });
      return;
    }
    if (isTooUniform) {
      toast({ title: "Can't see you! 🙈", description: "Make sure your face is visible and the camera isn't covered.", variant: "destructive" });
      return;
    }

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedBlob(blob);
          setPreviewUrl(URL.createObjectURL(blob));
          setStep("preview");
          stopCamera();
        }
      },
      "image/jpeg",
      0.85
    );
  }, [stopCamera, analyzeBrightness]);

  const retake = useCallback(() => {
    setCapturedBlob(null);
    setPreviewUrl("");
    setStep("camera");
    setTimeout(startCamera, 100);
  }, [startCamera]);

  const confirmAndUpload = useCallback(async () => {
    if (!capturedBlob || !user) return;
    setStep("uploading");

    const filePath = `${user.id}/selfie.jpg`;
    const { error } = await supabase.storage
      .from("member-photos")
      .upload(filePath, capturedBlob, { upsert: true, contentType: "image/jpeg" });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setStep("preview");
      return;
    }

    const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(filePath);
    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update member profile — image_status defaults to 'pending', admin must approve
    await supabase.from("members").update({
      image_url: imageUrl,
      image_thumb_url: imageUrl,
      is_discoverable: false,
      last_active_at: new Date().toISOString(),
    } as any).eq("id", user.id);

    onComplete(imageUrl);
    toast({ title: "Selfie submitted! 📸", description: "Your photo is under review — we'll make you discoverable once approved." });
  }, [capturedBlob, user, onComplete]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-sm overflow-hidden border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">Take a Quick Selfie 📸</h2>
          <button onClick={handleClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-white/60 text-sm text-center mb-4">
            Just one snap — we'll find people who want to connect with you and let you know!
          </p>

          {/* Camera / Preview area */}
          <div className="relative aspect-square rounded-xl overflow-hidden bg-black mb-4">
            {step === "camera" && (
              <>
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover mirror"
                  style={{ transform: "scaleX(-1)" }}
                  playsInline
                  muted
                />
                {!cameraStarted && (
                  <button
                    onClick={startCamera}
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60"
                  >
                    <Camera className="w-12 h-12 text-white" />
                    <span className="text-white font-medium">Tap to open camera</span>
                  </button>
                )}
              </>
            )}

            {(step === "preview" || step === "uploading") && previewUrl && (
              <img src={previewUrl} alt="Your selfie" className="w-full h-full object-cover" />
            )}
          </div>

          <canvas ref={canvasRef} className="hidden" />

          {/* Actions */}
          <div className="flex gap-3">
            {step === "camera" && cameraStarted && (
              <button
                onClick={takeSnapshot}
                className="flex-1 flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl transition-colors"
              >
                <Camera className="w-5 h-5" />
                Snap!
              </button>
            )}

            {step === "preview" && (
              <>
                <button
                  onClick={retake}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </button>
                <button
                  onClick={confirmAndUpload}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  <Check className="w-5 h-5" />
                  Looks Good!
                </button>
              </>
            )}

            {step === "uploading" && (
              <div className="flex-1 flex items-center justify-center gap-2 bg-white/10 text-white/60 font-medium py-3 rounded-xl">
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Setting you up...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelfieCaptureModal;
