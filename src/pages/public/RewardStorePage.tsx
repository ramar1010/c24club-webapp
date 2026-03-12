import { useState, useRef, useEffect } from "react";
import { usePublicRewards, usePublicCategories } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { X, ArrowLeft, ChevronLeft, ChevronRight, Crown, Star, RotateCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ShippingForm from "@/components/store/ShippingForm";
import { useAuth } from "@/hooks/useAuth";
import { useVipStatus } from "@/hooks/useVipStatus";
import { toast } from "sonner";

const RARITY_STYLES: Record<string, { bg: string; text: string }> = {
  common: { bg: "bg-neutral-700", text: "text-white" },
  rare: { bg: "bg-blue-600", text: "text-white" },
  legendary: { bg: "bg-amber-500", text: "text-black" },
};

const SPIN_SLOT_COLORS = ["#FF6B35", "#2EC4B6", "#9B5DE5", "#E71D36"];

// Build a long reel of items for the spin animation
function buildSpinReel(commons: any[], target: any, won: boolean, totalSlots = 28): { items: any[]; winnerIndex: number } {
  // We'll place the winning item near the end so the reel scrolls a good distance
  const winnerIndex = totalSlots - 4; // lands 4 from end
  const items: any[] = [];
  for (let i = 0; i < totalSlots; i++) {
    if (i === winnerIndex) {
      items.push(won ? { ...target, isTarget: true } : { ...commons[i % commons.length], isTarget: false });
    } else {
      // Mix commons and target randomly, but target appears occasionally to tease
      if (Math.random() < 0.2 && i < winnerIndex - 1) {
        items.push({ ...target, isTarget: true });
      } else {
        items.push({ ...commons[i % commons.length], isTarget: false });
      }
    }
  }
  return { items, winnerIndex };
}

const RewardStorePage = ({ onClose }: { onClose?: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscribed, vipTier } = useVipStatus(user?.id ?? null);
  const { data: rewards, isLoading: loadingRewards } = usePublicRewards();
  const { data: categories } = usePublicCategories();
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<any | null>(null);
  const [showShipping, setShowShipping] = useState(false);
  const [showSpinToWin, setShowSpinToWin] = useState<any | null>(null);
  const [spinState, setSpinState] = useState<"idle" | "spinning" | "won" | "lost">("idle");
  const [spinResult, setSpinResult] = useState<any[]>([]);
  const [canRespin, setCanRespin] = useState(false);
  const [selectedColor, setSelectedColorState] = useState<number | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [spinReelItems, setSpinReelItems] = useState<any[]>([]);
  const [spinWinnerIndex, setSpinWinnerIndex] = useState(0);
  const [spinAnimating, setSpinAnimating] = useState(false);
  const reelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const isPremiumVip = subscribed && vipTier === "premium";

  const filteredRewards = selectedCategory
    ? rewards?.filter((r: any) => r.category_id === selectedCategory)
    : rewards;

  const categoryCards = categories?.map((cat: any) => {
    const count = rewards?.filter((r: any) => r.category_id === cat.id).length ?? 0;
    return { ...cat, count };
  });

  // Fetch user's current minute balance
  const { data: userMinutes } = useQuery({
    queryKey: ["user-minutes-balance"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;
      const { data } = await supabase.functions.invoke("earn-minutes", {
        body: { type: "get_balance", userId: user.id },
      });
      return data?.totalMinutes ?? 0;
    },
  });

  // Fetch chance enhancer for spin mechanic
  const { data: ceData } = useQuery({
    queryKey: ["store-chance-enhancer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("spin-wheel", {
        body: { type: "get_chance_enhancer", userId: user!.id },
      });
      return data || { chance_enhancer: 10, is_vip: false };
    },
  });

  const chanceEnhancer = ceData?.chance_enhancer ?? 10;

  // Get common rewards for the spin mechanic
  const commonRewards = rewards?.filter((r: any) => r.rarity === "common") || [];

  const handleSpinToWin = (reward: any) => {
    setShowSpinToWin(reward);
    setSpinState("idle");
    setSpinResult([]);
    setCanRespin(false);
  };

  const executeItemSpin = (targetReward: any, isRespin = false) => {
    setSpinState("spinning");
    
    // Pick 3 random commons
    const shuffled = [...commonRewards].sort(() => Math.random() - 0.5);
    const commons = shuffled.slice(0, 3);
    
    // Determine win based on chance enhancer
    // CE is the win percentage (e.g., 35% CE = 35% chance to win the target)
    const roll = Math.random() * 100;
    const won = roll < chanceEnhancer;
    
    // Build 4 slots: 3 commons + 1 target, shuffle positions
    const slots = [...commons.map(c => ({ ...c, isTarget: false })), { ...targetReward, isTarget: true }];
    const shuffledSlots = slots.sort(() => Math.random() - 0.5);
    
    setSpinResult(shuffledSlots);
    
    setTimeout(() => {
      if (won) {
        setSpinState("won");
        toast.success(`🎉 You won ${targetReward.title}!`);
      } else {
        setSpinState("lost");
        // Premium VIP can respin for legendary items only (not on a respin)
        if (isPremiumVip && targetReward.rarity === "legendary" && !isRespin) {
          setCanRespin(true);
        }
      }
    }, 2000);
  };

  const handleRespin = () => {
    if (!showSpinToWin) return;
    setCanRespin(false);
    executeItemSpin(showSpinToWin, true);
  };

  // Spin to Win overlay
  if (showSpinToWin) {
    const targetReward = showSpinToWin;
    const rarity = RARITY_STYLES[targetReward.rarity] || RARITY_STYLES.common;

    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
        <div className="w-full flex items-center pt-3 pb-2">
          <button onClick={() => setShowSpinToWin(null)} className="flex items-center gap-1 hover:opacity-80">
            <ChevronLeft className="w-7 h-7" />
            <span className="font-black text-sm">BACK</span>
          </button>
        </div>

        <h1 className="text-2xl font-black mt-2 mb-1">🎰 SPIN TO WIN</h1>
        <p className="text-neutral-400 text-xs mb-4 text-center">
          Win the <span className={`${rarity.text === "text-black" ? "text-amber-400" : "text-blue-400"} font-bold`}>
            {targetReward.rarity}
          </span> item using your Chance Enhancer!
        </p>

        {/* CE Display */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-6 flex items-center gap-2">
          <span className="text-orange-400 text-xs font-black">
            🔥 Your Win Chance: {Math.round(chanceEnhancer)}%
          </span>
        </div>

        {/* Target item display */}
        <div className="mb-6 text-center">
          <div className="w-24 h-24 rounded-2xl overflow-hidden bg-neutral-800 mx-auto mb-2 border-2 border-amber-500/50">
            {targetReward.image_url ? (
              <img src={targetReward.image_url} alt={targetReward.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl">🎁</div>
            )}
          </div>
          <p className="font-black text-sm">{targetReward.title}</p>
          <span className={`${rarity.bg} ${rarity.text} px-3 py-0.5 rounded-md font-bold text-[10px] inline-block mt-1`}>
            {targetReward.rarity.charAt(0).toUpperCase() + targetReward.rarity.slice(1)}
          </span>
        </div>

        {/* Spin Slots */}
        {spinResult.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6 w-full max-w-sm">
            {spinResult.map((slot, i) => {
              const isWinning = spinState === "won" && slot.isTarget;
              const isLosing = spinState === "lost" && !slot.isTarget;
              return (
                <div
                  key={i}
                  className={`rounded-2xl overflow-hidden aspect-square border-2 transition-all duration-500 ${
                    spinState === "spinning"
                      ? "border-yellow-500/50 animate-pulse"
                      : isWinning
                      ? "border-green-500 shadow-lg shadow-green-500/30 scale-105"
                      : spinState === "won" && !slot.isTarget
                      ? "border-neutral-700 opacity-40"
                      : spinState === "lost" && slot.isTarget
                      ? "border-red-500 opacity-60"
                      : "border-neutral-700"
                  }`}
                >
                  {slot.image_url ? (
                    <img src={slot.image_url} alt={slot.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-2xl">🎁</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Result message */}
        {spinState === "won" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 text-center">
            <p className="text-green-400 font-black text-lg">🎉 YOU WON!</p>
            <p className="text-neutral-300 text-sm">Click below to redeem your prize</p>
          </div>
        )}
        {spinState === "lost" && !canRespin && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-4 text-center">
            <p className="text-red-400 font-black text-lg">😔 Not this time!</p>
            <p className="text-neutral-400 text-sm">Keep chatting to boost your Chance Enhancer</p>
          </div>
        )}
        {spinState === "lost" && canRespin && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-4 text-center">
            <p className="text-purple-400 font-black text-lg">👑 Premium VIP Perk!</p>
            <p className="text-neutral-300 text-sm">You get one more shot at this legendary item</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full max-w-xs space-y-3">
          {spinState === "idle" && (
            <button
              onClick={() => executeItemSpin(targetReward)}
              className="w-full py-3 rounded-full font-black text-lg bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              🎰 SPIN NOW!
            </button>
          )}
          {spinState === "spinning" && (
            <button disabled className="w-full py-3 rounded-full font-black text-lg bg-neutral-700 text-neutral-400 cursor-wait">
              SPINNING...
            </button>
          )}
          {spinState === "won" && (
            <button
              onClick={() => {
                setShowSpinToWin(null);
                setSelectedReward(targetReward);
                setShowShipping(true);
              }}
              className="w-full py-3 rounded-full font-black text-lg bg-green-600 hover:bg-green-700 text-white transition-all shadow-lg"
            >
              REDEEM NOW
            </button>
          )}
          {canRespin && (
            <button
              onClick={handleRespin}
              className="w-full py-3 rounded-full font-black text-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <RotateCw className="w-5 h-5" /> SPIN AGAIN (VIP)
            </button>
          )}
          {(spinState === "lost" && !canRespin) && (
            <button
              onClick={() => setShowSpinToWin(null)}
              className="w-full py-3 rounded-full font-black text-sm bg-neutral-800 text-neutral-400 hover:bg-neutral-700 transition-all"
            >
              Back to Store
            </button>
          )}
        </div>
      </div>
    );
  }

  // Shipping form view
  if (selectedReward && showShipping) {
    return (
      <ShippingForm
        reward={isPremiumVip ? { ...selectedReward, shipping_fee: 0 } : selectedReward}
        onBack={() => setShowShipping(false)}
        onSuccess={() => {
          setShowShipping(false);
          setSelectedReward(null);
          queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
        }}
      />
    );
  }

  // Product detail view
  if (selectedReward) {
    const rarity = RARITY_STYLES[selectedReward.rarity] || RARITY_STYLES.common;
    const sizes = selectedReward.sizes?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];
    const isRareOrLegendary = selectedReward.rarity === "rare" || selectedReward.rarity === "legendary";
    const canSpinThis = selectedReward.rarity === "rare" || (selectedReward.rarity === "legendary" && isPremiumVip);
    const displayShippingFee = isPremiumVip ? 0 : (Number(selectedReward.shipping_fee) || 0);

    // Build image gallery: main + feature + variations + color images
    const allImages: string[] = [];
    if (selectedReward.image_url) allImages.push(selectedReward.image_url);
    
    if (selectedReward.variation_images?.length) allImages.push(...selectedReward.variation_images);

    const colors: { name: string; hex: string; image_url: string }[] = 
      Array.isArray(selectedReward.color_options) ? selectedReward.color_options : [];

    // Use top-level state for selected color and image index

    // When a color is selected, show its image if available
    const displayImage = selectedColor !== null && colors[selectedColor]?.image_url
      ? colors[selectedColor].image_url
      : allImages[currentImageIndex] || null;

    const prevImage = () => setCurrentImageIndex((i) => Math.max(0, i - 1));
    const nextImage = () => setCurrentImageIndex((i) => Math.min(allImages.length - 1, i + 1));

    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => { setSelectedReward(null); setSelectedColorState(null); setCurrentImageIndex(0); }} className="flex items-center gap-1 text-white hover:text-neutral-300 transition-colors">
            <ArrowLeft className="w-6 h-6" />
            <span className="font-bold text-sm">BACK</span>
          </button>
          <h1 className="flex-1 text-2xl font-black leading-tight text-right">
            {selectedReward.title}
          </h1>
        </div>

        {/* Product Image */}
        <div className="px-4 mb-4">
          <div className="relative rounded-2xl overflow-hidden bg-neutral-800 aspect-square">
            {displayImage ? (
              <img src={displayImage} alt={selectedReward.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">🎁</span>
              </div>
            )}
            <span className={`absolute bottom-3 right-3 ${rarity.bg} ${rarity.text} px-4 py-1.5 rounded-lg font-black text-sm`}>
              {selectedReward.rarity.charAt(0).toUpperCase() + selectedReward.rarity.slice(1)}
            </span>
            {allImages.length > 1 && selectedColor === null && (
              <>
                <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Image thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              {allImages.map((url, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentImageIndex(i); setSelectedColorState(null); }}
                  className={`w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                    currentImageIndex === i && selectedColor === null ? "border-yellow-500" : "border-neutral-700"
                  }`}
                >
                  <img src={url} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Color Options */}
        {colors.length > 0 && (
          <div className="px-4 mb-4">
            <h3 className="text-yellow-400 font-black text-lg mb-2">Colors</h3>
            <div className="flex gap-3 flex-wrap">
              {colors.map((color: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setSelectedColorState(selectedColor === i ? null : i)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition-all ${
                    selectedColor === i
                      ? "border-yellow-500 bg-neutral-800"
                      : "border-neutral-700 hover:border-neutral-500"
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-full border border-neutral-500"
                    style={{ backgroundColor: color.hex }}
                  />
                  <span className="text-sm font-bold">{color.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div className="px-4 mb-4">
            <h3 className="text-yellow-400 font-black text-lg mb-2">Sizes</h3>
            <div className="flex gap-2">
              {sizes.map((size: string) => (
                <span key={size} className="bg-green-600 text-white font-black text-lg w-10 h-10 rounded-lg flex items-center justify-center">
                  {size}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Ships to */}
        {selectedReward.delivery !== "digital" && (
          <div className="px-4 mb-4">
            <h3 className="text-yellow-400 font-black text-lg mb-1">Ships only to:</h3>
            <div className="flex gap-2 text-2xl">🇺🇸 🇬🇧</div>
          </div>
        )}

        {selectedReward.brief && (
          <div className="px-4 mb-4">
            <p className="text-neutral-400 text-sm">{selectedReward.brief}</p>
          </div>
        )}

        <div className="px-4 mb-4">
          <p className="text-neutral-400 text-sm">
            Cost: <span className="text-white font-bold">🪙 {selectedReward.minutes_cost} Minutes</span>
          </p>
          {isPremiumVip && displayShippingFee === 0 && Number(selectedReward.shipping_fee) > 0 && (
            <p className="text-purple-400 text-xs font-bold mt-1">👑 FREE SHIPPING (Premium VIP)</p>
          )}
        </div>

        <div className="mt-auto px-4 pb-2">
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-center">
            <p className="text-neutral-400 text-sm">Your Balance</p>
            <p className="text-green-400 font-black text-2xl">🪙 {userMinutes ?? 0} Minutes</p>
          </div>
        </div>

        <div className="px-4 pb-6 pt-2 space-y-2">
          {isRareOrLegendary && canSpinThis && commonRewards.length >= 3 && (
            <button
              onClick={() => handleSpinToWin(selectedReward)}
              className={`w-full font-black text-lg py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 ${
                selectedReward.rarity === "legendary"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-amber-900/30"
                  : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-900/30"
              }`}
            >
              🎰 Spin to Win
              {isPremiumVip && selectedReward.rarity === "legendary" && (
                <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">+ Re-spin</span>
              )}
            </button>
          )}
          {isRareOrLegendary && !canSpinThis && selectedReward.rarity === "legendary" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-center">
              <p className="text-amber-400 font-black text-sm">👑 Premium VIP Only</p>
              <p className="text-neutral-400 text-xs">Upgrade to spin for legendary items</p>
            </div>
          )}

          {!isRareOrLegendary && (
            <button
              onClick={() => setShowShipping(true)}
              disabled={(userMinutes ?? 0) < selectedReward.minutes_cost}
              className={`w-full font-black text-xl py-4 rounded-xl transition-colors shadow-lg ${
                (userMinutes ?? 0) >= selectedReward.minutes_cost
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-green-900/30"
                  : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
              }`}
            >
              Redeem This Product
            </button>
          )}
        </div>
      </div>
    );
  }

  // Main store view - category grid
  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={() => onClose ? onClose() : navigate(-1)} className="text-red-500 hover:text-red-400 transition-colors">
          <X className="w-8 h-8" strokeWidth={3} />
        </button>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-1">
          <span>⚡</span> Reward Store <span>⚡</span>
        </h1>
        <div className="flex flex-col items-end">
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wide">Balance</span>
          <span className="text-green-400 font-black text-lg">🪙 {userMinutes ?? 0}</span>
        </div>
      </div>

      {/* Premium VIP badge */}
      {isPremiumVip && (
        <div className="px-4 mb-3">
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-full px-4 py-1.5 text-center">
            <span className="text-purple-400 text-xs font-black">👑 Premium VIP — Free Shipping on all orders</span>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      {loadingRewards ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : selectedCategory ? (
        <div className="flex-1 px-4 pb-6">
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-neutral-400 hover:text-white mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-bold">Back to Categories</span>
          </button>

          <h2 className="text-2xl font-black mb-4">
            {categories?.find((c: any) => c.id === selectedCategory)?.name || "Rewards"}
          </h2>

          {!filteredRewards?.length ? (
            <p className="text-neutral-500 text-center py-10">No rewards in this category yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredRewards.map((reward: any) => {
                const rarity = RARITY_STYLES[reward.rarity] || RARITY_STYLES.common;
                const isSpinnable = (reward.rarity === "rare") || (reward.rarity === "legendary" && isPremiumVip);
                return (
                  <button
                    key={reward.id}
                    onClick={() => setSelectedReward(reward)}
                    className="relative rounded-2xl overflow-hidden bg-neutral-800 aspect-square group text-left"
                  >
                    {reward.image_url ? (
                      <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                        <span className="text-4xl">🎁</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="font-black text-sm leading-tight text-white drop-shadow-lg">{reward.title}</p>
                      <p className="text-xs text-neutral-300 mt-0.5">🪙 {reward.minutes_cost} min</p>
                      {(reward.rarity === "rare" || reward.rarity === "legendary") && (
                        <span className="text-[9px] text-yellow-400 font-bold">🎰 Spin to Win</span>
                      )}
                    </div>
                    <span className={`absolute top-2 right-2 ${rarity.bg} ${rarity.text} px-2 py-0.5 rounded-md font-bold text-[10px]`}>
                      {reward.rarity}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 px-4 pb-6">
          {!categoryCards?.length && !rewards?.length ? (
            <p className="text-neutral-500 text-center py-10">No rewards available yet. Start chatting to unlock!</p>
          ) : (
            <>
              {categoryCards && categoryCards.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {categoryCards.map((cat: any) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="relative rounded-2xl overflow-hidden bg-neutral-800 aspect-square group text-left"
                    >
                      {cat.image_url ? (
                        <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center">
                          <span className="text-4xl">📦</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute top-3 left-3">
                        <p className="font-black text-base text-white drop-shadow-lg">{cat.name}</p>
                      </div>
                      <div className="absolute bottom-3 left-3">
                        <span className="bg-black/60 backdrop-blur-sm text-white font-bold text-xs px-3 py-1.5 rounded-lg">
                          {cat.count} Items
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(!categoryCards || categoryCards.length === 0) && rewards && rewards.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {rewards.map((reward: any) => {
                    const rarity = RARITY_STYLES[reward.rarity] || RARITY_STYLES.common;
                    return (
                      <button
                        key={reward.id}
                        onClick={() => setSelectedReward(reward)}
                        className="relative rounded-2xl overflow-hidden bg-neutral-800 aspect-square group text-left"
                      >
                        {reward.image_url ? (
                          <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                            <span className="text-4xl">🎁</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <p className="font-black text-sm leading-tight text-white drop-shadow-lg">{reward.title}</p>
                          <p className="text-xs text-neutral-300 mt-0.5">🪙 {reward.minutes_cost} min</p>
                          {(reward.rarity === "rare" || reward.rarity === "legendary") && (
                            <span className="text-[9px] text-yellow-400 font-bold">🎰 Spin to Win</span>
                          )}
                        </div>
                        <span className={`absolute top-2 right-2 ${rarity.bg} ${rarity.text} px-2 py-0.5 rounded-md font-bold text-[10px]`}>
                          {reward.rarity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};


export default RewardStorePage;
