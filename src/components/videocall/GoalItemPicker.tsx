import { useEffect, useState } from "react";
import { X, Loader2, Sparkles, ArrowLeft, Check } from "lucide-react";
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
  sizes: string | null;
  color_options: any;
}

const HIGH_END_CATEGORY_ID = "e5cbe699-04ca-4789-85aa-30cd0c3364e6";

export default function GoalItemPicker({ open, onClose, userId, onItemAdded }: GoalItemPickerProps) {
  const [items, setItems] = useState<LuxuryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<LuxuryItem | null>(null);
  const [chosenSize, setChosenSize] = useState<string | null>(null);
  const [chosenColorIdx, setChosenColorIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setActiveItem(null);
    setChosenSize(null);
    setChosenColorIdx(null);
    supabase
      .from("rewards")
      .select("id, title, image_url, minutes_cost, sizes, color_options")
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

  const parseSizes = (raw: string | null) =>
    (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const parseColors = (raw: any): { name: string; hex: string; image_url?: string }[] =>
    Array.isArray(raw) ? raw : [];

  const onTapItem = (item: LuxuryItem) => {
    const sizes = parseSizes(item.sizes);
    const colors = parseColors(item.color_options);
    if (sizes.length === 0 && colors.length === 0) {
      void saveGoal(item, null, null);
      return;
    }
    setActiveItem(item);
    setChosenSize(null);
    setChosenColorIdx(null);
  };

  const saveGoal = async (
    item: LuxuryItem,
    sizeChoice: string | null,
    colorChoice: { name: string; hex: string; image_url?: string } | null,
  ) => {
    setSavingId(item.id);
    try {
      const colorImage = colorChoice?.image_url || item.image_url || "";
      const { error } = await supabase.from("wishlist_items").insert({
        user_id: userId,
        title: item.title,
        description: "",
        price_cents: 0,
        source_url: "",
        image_url: colorImage,
        images: colorImage ? [colorImage] : [],
        sizes: sizeChoice ? [sizeChoice] : [],
        colors: colorChoice ? [colorChoice] : [],
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
            {activeItem ? (
              <button
                onClick={() => setActiveItem(null)}
                className="flex items-center gap-1.5 text-pink-200 hover:text-white text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
            ) : (
              <>
                <h2 className="text-white font-black text-xl flex items-center gap-2 tracking-tight">
                  <span className="text-2xl">💎</span>
                  Pick Your Dream Reward
                </h2>
                <p className="text-pink-300/80 text-xs font-medium mt-1">
                  Lock in a luxury goal — earn it FREE by chatting ✨
                </p>
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white bg-white/5 rounded-full p-1.5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pb-5">
          {activeItem ? (
            <ItemOptionsStep
              item={activeItem}
              sizes={parseSizes(activeItem.sizes)}
              colors={parseColors(activeItem.color_options)}
              chosenSize={chosenSize}
              setChosenSize={setChosenSize}
              chosenColorIdx={chosenColorIdx}
              setChosenColorIdx={setChosenColorIdx}
              saving={savingId === activeItem.id}
              onConfirm={() => {
                const colors = parseColors(activeItem.color_options);
                const sizes = parseSizes(activeItem.sizes);
                if (sizes.length > 0 && !chosenSize) {
                  toast.error("Pick a size first");
                  return;
                }
                if (colors.length > 0 && chosenColorIdx === null) {
                  toast.error("Pick a color first");
                  return;
                }
                void saveGoal(
                  activeItem,
                  chosenSize,
                  chosenColorIdx !== null ? colors[chosenColorIdx] : null,
                );
              }}
            />
          ) : loading ? (
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
                    onClick={() => onTapItem(item)}
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

          {!activeItem && (
            <p className="text-center text-white/30 text-[10px] mt-4 px-4 leading-relaxed">
              Pick one to set as your goal. You can change it anytime in the Reward Store. Chat → earn minutes → spin to win it FREE 🎰
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ItemOptionsStep({
  item,
  sizes,
  colors,
  chosenSize,
  setChosenSize,
  chosenColorIdx,
  setChosenColorIdx,
  saving,
  onConfirm,
}: {
  item: LuxuryItem;
  sizes: string[];
  colors: { name: string; hex: string; image_url?: string }[];
  chosenSize: string | null;
  setChosenSize: (v: string | null) => void;
  chosenColorIdx: number | null;
  setChosenColorIdx: (v: number | null) => void;
  saving: boolean;
  onConfirm: () => void;
}) {
  const previewImage =
    chosenColorIdx !== null && colors[chosenColorIdx]?.image_url
      ? colors[chosenColorIdx].image_url
      : item.image_url;

  return (
    <div className="pt-2">
      <div className="aspect-square bg-black/40 rounded-2xl overflow-hidden border border-pink-500/20 mb-3">
        {previewImage ? (
          <img src={previewImage} alt={item.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">💎</div>
        )}
      </div>
      <h3 className="text-white font-black text-base leading-tight mb-1">{item.title}</h3>
      <p className="text-pink-300 text-xs font-bold mb-4 flex items-center gap-1">
        <Sparkles className="w-3 h-3 text-yellow-400" /> {item.minutes_cost} minutes to unlock
      </p>

      {colors.length > 0 && (
        <div className="mb-4">
          <p className="text-white/70 text-[11px] font-black uppercase tracking-wider mb-2">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c, i) => {
              const active = chosenColorIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => setChosenColorIdx(active ? null : i)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    active
                      ? "border-pink-400 bg-pink-500/15 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30"
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-white/30"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                  {active && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div className="mb-4">
          <p className="text-white/70 text-[11px] font-black uppercase tracking-wider mb-2">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => {
              const active = chosenSize === s;
              return (
                <button
                  key={s}
                  onClick={() => setChosenSize(active ? null : s)}
                  className={`px-3 py-1.5 rounded-lg border-2 text-xs font-black transition-all ${
                    active
                      ? "border-pink-400 bg-pink-500/20 text-white"
                      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <button
        onClick={onConfirm}
        disabled={saving}
        className="w-full mt-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-400 hover:to-purple-400 disabled:opacity-50 text-white font-black uppercase tracking-wide py-3 rounded-xl text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Locking in...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" /> Lock in this goal
          </>
        )}
      </button>
    </div>
  );
}