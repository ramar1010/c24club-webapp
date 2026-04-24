import { useEffect, useState } from "react";
import { X, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GoalItemPickerProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  onItemAdded: () => void;
}

interface LuxuryItem {
  id: string;
  title: string;
  image_url: string | null;
  minutes_cost: number;
}

const HIGH_END_CATEGORY_ID = "e5cbe699-04ca-4789-85aa-30cd0c3364e6";

export default function GoalItemPicker({ open, onClose, userId, onItemAdded }: GoalItemPickerProps) {
  const [items, setItems] = useState<LuxuryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("rewards")
      .select("id, title, image_url, minutes_cost")
      .eq("category_id", HIGH_END_CATEGORY_ID)
      .eq("visible", true)
      .order("minutes_cost", { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setItems((data ?? []) as LuxuryItem[]);
        setLoading(false);
      });
  }, [open]);

  if (!open) return null;

  const handlePick = async (item: LuxuryItem) => {
    setSavingId(item.id);
    try {
      const { error } = await supabase.from("wishlist_items").insert({
        user_id: userId,
        title: item.title,
        description: "",
        price_cents: 0,
        source_url: "",
        image_url: item.image_url ?? "",
        images: item.image_url ? [item.image_url] : [],
        sizes: [],
        colors: [],
        minutes_cost: item.minutes_cost,
        status: "active",
      } as any);
      if (error) throw error;
      toast.success("💎 Goal locked in!", {
        description: `Earn ${item.minutes_cost} minutes to win this!`,
      });
      onItemAdded();
      onClose();
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    }
    setSavingId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="relative bg-gradient-to-b from-[#2d1033] via-[#1a1a2e] to-[#0f0f0f] rounded-3xl w-full max-w-md max-h-[92vh] overflow-y-auto border border-pink-500/30 shadow-[0_0_60px_-10px_rgba(236,72,153,0.4)]">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#2d1033] to-[#2d1033]/95 backdrop-blur px-5 pt-5 pb-3 flex items-start justify-between">
          <div>
            <h2 className="text-white font-black text-xl flex items-center gap-2 tracking-tight">
              <span className="text-2xl">💎</span>
              Pick Your Dream Reward
            </h2>
            <p className="text-pink-300/80 text-xs font-medium mt-1">
              Lock in a luxury goal — earn it FREE by chatting ✨
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-white/50 text-center py-12 text-sm">No luxury items available right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const saving = savingId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handlePick(item)}
                    disabled={!!savingId}
                    className="group bg-white/[0.03] hover:bg-white/[0.06] border border-pink-500/20 hover:border-pink-400/50 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 text-left"
                  >
                    <div className="aspect-square bg-black/40 overflow-hidden relative">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-3xl">💎</div>
                      )}
                      <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-yellow-400 to-pink-400 text-black text-[9px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                        Luxury
                      </div>
                      {saving && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-pink-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="p-2.5">
                      <p className="text-white text-xs font-bold line-clamp-2 leading-tight min-h-[2rem]">
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1 mt-1.5">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        <span className="text-pink-300 text-[11px] font-black">
                          {item.minutes_cost} min
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="text-center text-white/30 text-[10px] mt-4 px-4 leading-relaxed">
            Pick one to set as your goal. You can change it anytime in the Reward Store. Chat → earn minutes → spin to win it FREE 🎰
          </p>
        </div>
      </div>
    </div>
  );
}