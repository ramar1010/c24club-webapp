import { useState, useRef, useEffect } from "react";
import { X, Loader2, Sparkles, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

import shopper1 from "@/assets/pick-reward/shopper1.png";
import shopper2 from "@/assets/pick-reward/shopper2.png";
import shopper3 from "@/assets/pick-reward/shopper3.png";
import sheinLogo from "@/assets/pick-reward/shein-logo.png";
import amazonLogo from "@/assets/pick-reward/amazon-logo.png";
import hmLogo from "@/assets/pick-reward/hm-logo.png";
import gapLogo from "@/assets/pick-reward/gap-logo.png";

interface PickItemModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentItemCount: number;
  maxItems: number;
  onItemAdded: () => void;
}

/* ─── floating emoji config ─── */
const FLOAT_EMOJIS = ["🛍️", "💅", "👛", "💖", "✨", "🎀", "👠", "💎", "🌸", "💕", "🛒", "🎁"];

function FloatingEmojis() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-0">
      {FLOAT_EMOJIS.map((emoji, i) => {
        const left = 5 + (i / FLOAT_EMOJIS.length) * 90;
        const delay = i * 0.7;
        const dur = 4 + (i % 3) * 1.5;
        const size = 16 + (i % 3) * 6;
        return (
          <span
            key={i}
            className="absolute animate-bounce"
            style={{
              left: `${left}%`,
              bottom: `-${size}px`,
              fontSize: `${size}px`,
              animation: `floatUp ${dur}s ${delay}s ease-in-out infinite`,
              opacity: 0.7,
            }}
          >
            {emoji}
          </span>
        );
      })}
    </div>
  );
}

/* ─── brand logo strip ─── */
function BrandStrip() {
  const logos = [
    { src: sheinLogo, alt: "Shein" },
    { src: amazonLogo, alt: "Amazon" },
    { src: hmLogo, alt: "H&M" },
    { src: gapLogo, alt: "Gap" },
  ];
  return (
    <div className="flex items-center justify-center gap-4 py-2">
      {logos.map((l, i) => (
        <img
          key={i}
          src={l.src}
          alt={l.alt}
          className="h-5 w-auto object-contain opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all"
        />
      ))}
    </div>
  );
}

/* ─── sticker decoration ─── */
function ShopperStickers() {
  const stickers = [shopper1, shopper2, shopper3];
  return (
    <div className="flex items-end justify-center gap-0 -mb-1 mt-2">
      {stickers.map((src, i) => (
        <img
          key={i}
          src={src}
          alt=""
          className="object-contain drop-shadow-lg"
          style={{
            height: i === 1 ? "100px" : "85px",
            transform: i === 0 ? "rotate(-6deg)" : i === 2 ? "rotate(6deg)" : "none",
            marginBottom: i === 1 ? "4px" : "0",
            zIndex: i === 1 ? 2 : 1,
          }}
        />
      ))}
    </div>
  );
}

export default function PickItemModal({
  open,
  onClose,
  userId,
  currentItemCount,
  maxItems,
  onItemAdded,
}: PickItemModalProps) {
  const [step, setStep] = useState<"image" | "questions" | "confirm">("image");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [isUnder25, setIsUnder25] = useState<boolean | null>(null);
  const [isInUSA, setIsInUSA] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [minutesCost, setMinutesCost] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("wishlist_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      const min = (data as any)?.min_minutes ?? 400;
      const max = (data as any)?.max_minutes ?? 800;
      setMinutesCost(Math.round(min + Math.random() * (max - min)));
    };
    fetchSettings();
  }, [open]);

  if (!open) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image too large", { description: "Max 5MB" });
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setStep("questions");
  };

  const handleQuestionsNext = () => {
    if (!isUnder25) {
      toast.error("Sorry!", { description: "Only items under $25 are eligible." });
      return;
    }
    if (!isInUSA) {
      toast.error("Sorry!", { description: "This feature is only available for members in the USA." });
      return;
    }
    if (!itemName.trim()) {
      toast.error("Please enter the item name");
      return;
    }
    setStep("confirm");
  };

  const handleAddItem = async () => {
    if (!imageFile) return;
    setSaving(true);
    try {
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `${userId}/wishlist/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("member-photos")
        .upload(path, imageFile, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("member-photos")
        .getPublicUrl(path);

      const imageUrl = urlData.publicUrl;

      const { error } = await supabase.from("wishlist_items").insert({
        user_id: userId,
        title: itemName.trim(),
        description: "",
        price_cents: 2500,
        source_url: "",
        image_url: imageUrl,
        images: [imageUrl],
        sizes: [],
        colors: [],
        minutes_cost: minutesCost,
        status: "active",
      } as any);

      if (error) throw error;

      toast.success("🎯 Item added to your goals!", {
        description: `Earn ${minutesCost} minutes to spin for this item!`,
      });
      onItemAdded();
      handleReset();
      onClose();
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    }
    setSaving(false);
  };

  const handleReset = () => {
    setStep("image");
    setImageFile(null);
    setImagePreview(null);
    setItemName("");
    setIsUnder25(null);
    setIsInUSA(null);
  };

  const slotsLeft = maxItems - currentItemCount;

  return (
    <>
      {/* float keyframes injected once */}
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.6; }
          100% { transform: translateY(-420px) scale(0.6) rotate(20deg); opacity: 0; }
        }
      `}</style>

      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="relative bg-gradient-to-b from-[#2d1033] via-[#1a1a2e] to-[#0f0f0f] rounded-3xl w-full max-w-sm overflow-hidden border border-pink-500/20 max-h-[90vh] overflow-y-auto shadow-[0_0_60px_-10px_rgba(236,72,153,0.3)]">
          <FloatingEmojis />

          {/* Header */}
          <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-2">
            <h2 className="text-white font-black text-xl flex items-center gap-2 tracking-tight">
              <span className="text-2xl">🛍️</span>
              Pick Your Reward
              <span className="text-2xl">✨</span>
            </h2>
            <button onClick={() => { handleReset(); onClose(); }} className="text-white/40 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="relative z-10 px-5 pb-5 space-y-3">
            {/* Slots indicator */}
            <div className="flex items-center justify-center gap-1.5">
              {Array.from({ length: maxItems }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full border-2 transition-colors ${
                    i < currentItemCount
                      ? "bg-pink-500 border-pink-400"
                      : "bg-transparent border-white/20"
                  }`}
                />
              ))}
              <span className="text-white/40 text-[10px] ml-2 font-medium">{slotsLeft} left</span>
            </div>

            {/* ─── STEP 1: Upload ─── */}
            {step === "image" && (
              <div className="space-y-3">
                {/* Shopper stickers */}
                <ShopperStickers />

                <div className="text-center space-y-1.5">
                  <p className="text-white font-bold text-sm">
                    Shop from <span className="text-pink-400">ANY</span> website 💕
                  </p>
                  <p className="text-white/50 text-xs leading-relaxed">
                    Screenshot any item under <span className="text-yellow-400 font-bold">$25</span> from your fave stores and upload it!
                  </p>
                </div>

                {/* Brand logos */}
                <BrandStrip />

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-gradient-to-br from-pink-500/10 to-purple-500/10 border-2 border-dashed border-pink-500/30 hover:border-pink-400/60 rounded-2xl p-6 flex flex-col items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <div className="bg-pink-500/20 p-3 rounded-full">
                    <ImagePlus className="w-7 h-7 text-pink-400" />
                  </div>
                  <span className="text-white font-bold text-sm">Tap to upload item photo</span>
                  <span className="text-white/30 text-[10px]">PNG, JPG up to 5MB</span>
                </button>

                <p className="text-center text-white/30 text-[10px]">
                  🇺🇸 USA only · Earn minutes chatting → spin to win!
                </p>
              </div>
            )}

            {/* ─── STEP 2: Questions ─── */}
            {step === "questions" && (
              <div className="space-y-3">
                {imagePreview && (
                  <div className="rounded-2xl overflow-hidden bg-black/40 border border-white/10 aspect-square max-h-44 mx-auto">
                    <img src={imagePreview} alt="Item" className="w-full h-full object-contain" />
                  </div>
                )}

                <div>
                  <label className="text-white/60 text-xs font-bold block mb-1.5">What's it called? 💅</label>
                  <input
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="e.g. Pink Heart Necklace"
                    maxLength={100}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-pink-500/50 focus:ring-1 focus:ring-pink-500/20"
                  />
                </div>

                <div>
                  <label className="text-white/60 text-xs font-bold block mb-1.5">Under $25? 💰</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsUnder25(true)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isUnder25 === true
                          ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      ✅ Yes
                    </button>
                    <button
                      onClick={() => setIsUnder25(false)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isUnder25 === false
                          ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      ❌ No
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-white/60 text-xs font-bold block mb-1.5">Are you in the USA? 🇺🇸</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setIsInUSA(true)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isInUSA === true
                          ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      🇺🇸 Yes
                    </button>
                    <button
                      onClick={() => setIsInUSA(false)}
                      className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        isInUSA === false
                          ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                          : "bg-white/5 text-white/60 hover:bg-white/10"
                      }`}
                    >
                      ❌ No
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleQuestionsNext}
                    disabled={isUnder25 === null || isInUSA === null || !itemName.trim()}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/20"
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {/* ─── STEP 3: Confirm ─── */}
            {step === "confirm" && (
              <div className="space-y-3">
                {imagePreview && (
                  <div className="rounded-2xl overflow-hidden bg-black/40 border border-pink-500/20 aspect-square max-h-44 mx-auto shadow-lg shadow-pink-500/10">
                    <img src={imagePreview} alt={itemName} className="w-full h-full object-contain" />
                  </div>
                )}

                <h3 className="text-white font-bold text-sm text-center">{itemName}</h3>

                <div className="bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-pink-500/15 border border-pink-500/20 rounded-2xl p-4 text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span className="text-white/50 text-xs font-medium">Minutes to earn</span>
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                  </div>
                  <p className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-yellow-300">
                    {minutesCost}
                  </p>
                  <p className="text-white/35 text-[10px] mt-1">
                    Chat → earn minutes → spin to win this item! 🎰
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-xl transition-colors"
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleAddItem}
                    disabled={saving}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎯 Add to Goals"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
