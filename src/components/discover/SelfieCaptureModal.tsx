import { useRef, useState, useCallback } from "react";
import { Camera, RotateCcw, Check, X, ChevronRight, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { scanImageForNsfw } from "@/lib/nsfwScan";
import cashappIcon from "@/assets/socials/cashapp.png";
import tiktokIcon from "@/assets/socials/tiktok.png";
import instagramIcon from "@/assets/socials/instagram.png";
import snapchatIcon from "@/assets/socials/snapchat.png";
import venmoIcon from "@/assets/socials/venmo.png";
import paypalIcon from "@/assets/socials/paypal.png";
import discordIcon from "@/assets/socials/discord.png";

const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram", icon: instagramIcon, placeholder: "@username" },
  { key: "tiktok", label: "TikTok", icon: tiktokIcon, placeholder: "@username" },
  { key: "snapchat", label: "Snapchat", icon: snapchatIcon, placeholder: "/username" },
  { key: "discord", label: "Discord", icon: discordIcon, placeholder: "username" },
  { key: "cashapp", label: "CashApp", icon: cashappIcon, placeholder: "$cashtag" },
  { key: "venmo", label: "Venmo", icon: venmoIcon, placeholder: "/username" },
  { key: "paypal", label: "PayPal", icon: paypalIcon, placeholder: "@username" },
];

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
  const [step, setStep] = useState<"camera" | "preview" | "socials" | "uploading">("camera");
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [cameraStarted, setCameraStarted] = useState(false);
  const [socialInputs, setSocialInputs] = useState<Record<string, string>>({});
  const [bio, setBio] = useState("");

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

  const analyzeBrightness = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d")!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    let totalBrightness = 0;
    const pixelCount = pixels.length / 4;
    const brightnessBuckets = new Array(10).fill(0);

    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      const brightness = r * 0.299 + g * 0.587 + b * 0.114;
      totalBrightness += brightness;
      brightnessBuckets[Math.min(9, Math.floor(brightness / 25.6))]++;
    }

    const avgBrightness = totalBrightness / pixelCount;
    const maxBucket = Math.max(...brightnessBuckets);
    const isTooUniform = maxBucket / pixelCount > 0.85;

    return { isTooDark: avgBrightness < 40, isTooUniform };
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

    const { isTooDark, isTooUniform } = analyzeBrightness(canvas);
    if (isTooDark) {
      toast({ title: "Too dark! 🌑", description: "Move to a well-lit area and try again.", variant: "destructive" });
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

  const goToSocials = () => setStep("socials");

  const confirmAndUpload = useCallback(async () => {
    if (!capturedBlob || !user) return;
    setStep("uploading");

    // --- NSFW Auto-Scan ---
    try {
      const scanCanvas = document.createElement("canvas");
      scanCanvas.width = 224;
      scanCanvas.height = 224;
      const scanCtx = scanCanvas.getContext("2d")!;
      const bitmap = await createImageBitmap(capturedBlob);
      scanCtx.drawImage(bitmap, 0, 0, 224, 224);
      bitmap.close();

      const result = await scanImageForNsfw(scanCanvas, 0.60);
      if (result.isNsfw) {
        console.warn("[NSFW] Selfie upload blocked — score:", result.nudityScore);
        // Auto-ban via edge function
        try {
          await supabase.functions.invoke("nsfw-ban", {
            body: { targetUserId: user.id },
          });
        } catch (banErr) {
          console.error("[NSFW] Auto-ban failed:", banErr);
        }
        toast({
          title: "Upload Blocked 🚫",
          description: "Your photo was flagged as inappropriate. Your account has been suspended.",
          variant: "destructive",
        });
        setStep("camera");
        onClose();
        return;
      }
    } catch (scanErr) {
      console.warn("[NSFW] Scan failed, proceeding with upload:", scanErr);
      // If scan fails, still allow upload — admin will review manually
    }

    const filePath = `${user.id}/selfie.jpg`;
    const { error } = await supabase.storage
      .from("member-photos")
      .upload(filePath, capturedBlob, { upsert: true, contentType: "image/jpeg" });

    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
      setStep("socials");
      return;
    }

    const { data: urlData } = supabase.storage.from("member-photos").getPublicUrl(filePath);
    const imageUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    // Update member profile
    await supabase.from("members").update({
      image_url: imageUrl,
      image_thumb_url: imageUrl,
      image_status: "pending",
      is_discoverable: false,
      last_active_at: new Date().toISOString(),
      ...(bio.trim() ? { bio: bio.trim() } : {}),
    } as any).eq("id", user.id);

    // Save socials to vip_settings (pinned_socials format: "platform:username")
    const socialsArray = Object.entries(socialInputs)
      .filter(([, val]) => val.trim())
      .map(([key, val]) => `${key}:${val.trim()}`);

    if (socialsArray.length > 0) {
      const { data: existing } = await supabase
        .from("vip_settings")
        .select("id, pinned_socials")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Merge: keep existing socials for platforms not entered, add new ones
        const existingMap = new Map<string, string>();
        (existing.pinned_socials || []).forEach((s: string) => {
          const [k, ...v] = s.split(":");
          existingMap.set(k, v.join(":"));
        });
        socialsArray.forEach(s => {
          const [k, ...v] = s.split(":");
          existingMap.set(k, v.join(":"));
        });
        const merged = [...existingMap.entries()].map(([k, v]) => `${k}:${v}`);
        await supabase.from("vip_settings").update({ pinned_socials: merged, updated_at: new Date().toISOString() }).eq("user_id", user.id);
      } else {
        await supabase.from("vip_settings").insert({ user_id: user.id, pinned_socials: socialsArray });
      }
    }

    // Send Discord webhook for male listings
    try {
      const { data: memberData } = await supabase
        .from("members")
        .select("gender")
        .eq("id", user.id)
        .single();

      if (memberData?.gender === "male") {
        const discoverUrl = `${window.location.origin}/discover`;
        await supabase.functions.invoke("discord-discover-alert", {
          body: { discoverUrl },
        });
      }
    } catch (e) {
      console.error("Discord alert error:", e);
    }

    onComplete(imageUrl);
    toast({ title: "Selfie submitted! 📸", description: "Your photo is under review — we'll make you discoverable once approved." });
  }, [capturedBlob, user, onComplete, socialInputs, bio]);

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const handleSocialChange = (key: string, value: string) => {
    setSocialInputs(prev => ({ ...prev, [key]: value }));
  };

  const filledSocials = Object.values(socialInputs).filter(v => v.trim()).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-sm overflow-hidden border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg">
            {step === "socials" ? "Add Your Socials 🔗" : "Take a Quick Selfie 📸"}
          </h2>
          <button onClick={handleClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Step: Camera */}
          {step === "camera" && (
            <>
              <p className="text-white/60 text-sm text-center mb-4">
                Just one snap — we'll find people who want to connect with you!
              </p>
              <div className="relative aspect-square rounded-xl overflow-hidden bg-black mb-4">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
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
              </div>
              <canvas ref={canvasRef} className="hidden" />
              {cameraStarted && (
                <button
                  onClick={takeSnapshot}
                  className="w-full flex items-center justify-center gap-2 bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  Snap!
                </button>
              )}
            </>
          )}

          {/* Step: Preview */}
          {step === "preview" && (
            <>
              <div className="relative aspect-square rounded-xl overflow-hidden bg-black mb-4">
                <img src={previewUrl} alt="Your selfie" className="w-full h-full object-cover" />
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <div className="flex gap-3">
                <button
                  onClick={retake}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake
                </button>
                <button
                  onClick={goToSocials}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}

          {/* Step: Socials + Bio */}
          {step === "socials" && (
            <>
              <p className="text-white/50 text-xs text-center mb-3">
                Add your socials so matches can connect with you. This is optional — you can always add them later.
              </p>

              {/* Bio */}
              <div className="mb-4">
                <label className="text-white/70 text-xs font-bold mb-1 block">Short Bio</label>
                <input
                  value={bio}
                  onChange={(e) => setBio(e.target.value.slice(0, 120))}
                  placeholder="Tell people a little about yourself..."
                  maxLength={120}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
                />
                <span className="text-white/30 text-[10px]">{bio.length}/120</span>
              </div>

              {/* Social platforms */}
              <div className="space-y-2 mb-4">
                {SOCIAL_PLATFORMS.map((platform) => (
                  <div key={platform.key} className="flex items-center gap-2">
                    <img src={platform.icon} alt={platform.label} className="w-7 h-7 rounded-md object-contain" />
                    <input
                      value={socialInputs[platform.key] || ""}
                      onChange={(e) => handleSocialChange(platform.key, e.target.value)}
                      placeholder={platform.placeholder}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("preview")}
                  className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={confirmAndUpload}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  <Check className="w-5 h-5" />
                  {filledSocials > 0 ? "Submit" : "Skip & Submit"}
                </button>
              </div>
            </>
          )}

          {/* Step: Uploading */}
          {step === "uploading" && (
            <div className="flex items-center justify-center gap-2 bg-white/10 text-white/60 font-medium py-3 rounded-xl">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Setting you up...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelfieCaptureModal;
