import { useState, useRef } from "react";
import { X, Loader2, ShoppingBag, Sparkles, Camera, ImagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PickItemModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  currentItemCount: number;
  maxItems: number;
  onItemAdded: () => void;
}

function calculateMinutesCost(): number {
  // Random cost between 400–800 minutes for items under $25
  return Math.round(400 + Math.random() * 400);
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
  const [minutesCost] = useState(() => calculateMinutesCost());
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Upload image to storage
      const ext = imageFile.name.split(".").pop() || "jpg";
      const path = `wishlist/${userId}/${Date.now()}.${ext}`;
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#1a1a1a] rounded-2xl w-full max-w-sm overflow-hidden border border-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-pink-400" />
            Pick Your Reward
          </h2>
          <button onClick={() => { handleReset(); onClose(); }} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-white/50 text-xs text-center">
            {slotsLeft} of {maxItems} item slots available
          </p>

          {/* Step 1: Upload Image */}
          {step === "image" && (
            <div className="space-y-4">
              <p className="text-white/60 text-sm text-center">
                Take a screenshot of any item you want (AliExpress, Shein, etc.) and upload it here!
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-white/5 border-2 border-dashed border-white/20 hover:border-pink-500/50 rounded-xl p-8 flex flex-col items-center gap-3 transition-colors"
              >
                <ImagePlus className="w-10 h-10 text-pink-400" />
                <span className="text-white/70 text-sm font-medium">Tap to upload item photo</span>
                <span className="text-white/30 text-xs">PNG, JPG up to 5MB</span>
              </button>
            </div>
          )}

          {/* Step 2: Questions */}
          {step === "questions" && (
            <div className="space-y-4">
              {imagePreview && (
                <div className="rounded-xl overflow-hidden bg-black aspect-square max-h-48 mx-auto">
                  <img src={imagePreview} alt="Item" className="w-full h-full object-contain" />
                </div>
              )}

              {/* Item name */}
              <div>
                <label className="text-white/60 text-xs font-bold block mb-1.5">What's the item called?</label>
                <input
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Pink Heart Necklace"
                  maxLength={100}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
                />
              </div>

              {/* Under $25? */}
              <div>
                <label className="text-white/60 text-xs font-bold block mb-2">Is this item under $25?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsUnder25(true)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      isUnder25 === true
                        ? "bg-green-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    ✅ Yes
                  </button>
                  <button
                    onClick={() => setIsUnder25(false)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      isUnder25 === false
                        ? "bg-red-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    ❌ No
                  </button>
                </div>
              </div>

              {/* In USA? */}
              <div>
                <label className="text-white/60 text-xs font-bold block mb-2">Are you in the USA?</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsInUSA(true)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      isInUSA === true
                        ? "bg-green-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    🇺🇸 Yes
                  </button>
                  <button
                    onClick={() => setIsInUSA(false)}
                    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-colors ${
                      isInUSA === false
                        ? "bg-red-500 text-white"
                        : "bg-white/5 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    ❌ No
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Start Over
                </button>
                <button
                  onClick={handleQuestionsNext}
                  disabled={isUnder25 === null || isInUSA === null || !itemName.trim()}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Confirm with minutes */}
          {step === "confirm" && (
            <div className="space-y-3">
              {imagePreview && (
                <div className="rounded-xl overflow-hidden bg-black aspect-square max-h-48 mx-auto">
                  <img src={imagePreview} alt={itemName} className="w-full h-full object-contain" />
                </div>
              )}

              <h3 className="text-white font-bold text-sm text-center">{itemName}</h3>

              {/* Minutes Cost */}
              <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/30 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-white/60 text-sm font-medium">Minutes needed</span>
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                </div>
                <p className="text-3xl font-black text-white">{minutesCost}</p>
                <p className="text-white/40 text-xs mt-1">
                  Earn these minutes chatting, then spin to win!
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-3 rounded-xl transition-colors"
                >
                  Try Another
                </button>
                <button
                  onClick={handleAddItem}
                  disabled={saving}
                  className="flex-1 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "🎯 Add to Goals"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
