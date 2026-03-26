import { useState } from "react";
import { X, Link2, Loader2, ShoppingBag, Sparkles } from "lucide-react";
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

interface ScrapedProduct {
  title: string;
  description: string;
  price: string;
  images: string[];
  sizes: string[];
  colors: { name: string; hex: string; image_url: string }[];
}

function parsePriceCents(priceStr: string): number {
  // Extract numeric value from price string like "$12.99", "US $5.00", "12,99 €"
  const cleaned = priceStr.replace(/[^0-9.,]/g, "");
  // Handle comma as decimal separator
  const normalized = cleaned.includes(",") && !cleaned.includes(".")
    ? cleaned.replace(",", ".")
    : cleaned.replace(",", "");
  const num = parseFloat(normalized);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

function calculateMinutesCost(priceCents: number): number {
  // Base: $1 = 50 minutes, so price_cents / 100 * 50
  // Plus random bonus: 10-30% extra
  const baseMinutes = (priceCents / 100) * 50;
  const bonusMultiplier = 1 + (0.1 + Math.random() * 0.2); // 1.1 to 1.3
  return Math.round(baseMinutes * bonusMultiplier);
}

const MAX_PRICE_CENTS = 2500; // $25 cap

export default function PickItemModal({
  open,
  onClose,
  userId,
  currentItemCount,
  maxItems,
  onItemAdded,
}: PickItemModalProps) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [product, setProduct] = useState<ScrapedProduct | null>(null);
  const [saving, setSaving] = useState(false);
  const [minutesCost, setMinutesCost] = useState(0);

  if (!open) return null;

  const handleScrape = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setProduct(null);

    try {
      const { data, error } = await supabase.functions.invoke("scrape-product", {
        body: { url: url.trim() },
      });

      if (error || !data?.success) {
        toast.error("Couldn't load that product", {
          description: data?.error || "Try a different URL or paste details manually.",
        });
        setLoading(false);
        return;
      }

      const priceCents = parsePriceCents(data.price || "0");

      if (priceCents > MAX_PRICE_CENTS) {
        toast.error("Item too expensive!", {
          description: `Max price is $${(MAX_PRICE_CENTS / 100).toFixed(2)}. Try a more affordable item.`,
        });
        setLoading(false);
        return;
      }

      if (priceCents === 0) {
        toast.error("Couldn't detect the price", {
          description: "Try a different product page.",
        });
        setLoading(false);
        return;
      }

      const cost = calculateMinutesCost(priceCents);
      setMinutesCost(cost);

      setProduct({
        title: data.title || "Unknown Product",
        description: data.description || "",
        price: data.price || "",
        images: data.images || [],
        sizes: data.sizes || [],
        colors: data.colors || [],
      });
    } catch (err: any) {
      toast.error("Failed to scrape", { description: err.message });
    }
    setLoading(false);
  };

  const handleAddItem = async () => {
    if (!product) return;
    setSaving(true);

    try {
      const priceCents = parsePriceCents(product.price);

      const { error } = await supabase.from("wishlist_items").insert({
        user_id: userId,
        title: product.title,
        description: product.description,
        price_cents: priceCents,
        source_url: url.trim(),
        image_url: product.images[0] || null,
        images: product.images,
        sizes: product.sizes,
        colors: product.colors,
        minutes_cost: minutesCost,
        status: "active",
      } as any);

      if (error) throw error;

      toast.success("🎯 Item added to your goals!", {
        description: `Earn ${minutesCost} minutes to spin for this item!`,
      });
      onItemAdded();
      onClose();
      setProduct(null);
      setUrl("");
    } catch (err: any) {
      toast.error("Failed to save", { description: err.message });
    }
    setSaving(false);
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
          <button onClick={onClose} className="text-white/60 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Slots info */}
          <p className="text-white/50 text-xs text-center">
            {slotsLeft} of {maxItems} item slots available
          </p>

          {/* URL Input */}
          {!product && (
            <>
              <p className="text-white/60 text-sm text-center">
                Paste a link from AliExpress, Shein, or any site and we'll load the item for you!
              </p>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="Paste product URL..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-500/50"
                    onKeyDown={(e) => e.key === "Enter" && handleScrape()}
                  />
                </div>
                <button
                  onClick={handleScrape}
                  disabled={loading || !url.trim()}
                  className="bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold px-4 py-2.5 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
                </button>
              </div>
              <p className="text-white/30 text-[10px] text-center">
                Max item price: $25. Items under $25 only.
              </p>
            </>
          )}

          {/* Product Preview */}
          {product && (
            <div className="space-y-3">
              {/* Image */}
              {product.images[0] && (
                <div className="rounded-xl overflow-hidden bg-black aspect-square max-h-48 mx-auto">
                  <img
                    src={product.images[0]}
                    alt={product.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              {/* Title & Price */}
              <div>
                <h3 className="text-white font-bold text-sm line-clamp-2">{product.title}</h3>
                <p className="text-green-400 font-bold text-lg mt-1">{product.price}</p>
              </div>

              {/* Minutes Cost — the star of the show */}
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

              {/* Sizes */}
              {product.sizes.length > 0 && (
                <div>
                  <span className="text-white/50 text-xs font-bold">Sizes: </span>
                  <span className="text-white/70 text-xs">{product.sizes.join(", ")}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => { setProduct(null); setUrl(""); }}
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
