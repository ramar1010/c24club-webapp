import { useState, useRef, useEffect } from "react";
import { usePublicRewards, usePublicCategories } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { X, ArrowLeft, ChevronLeft, ChevronRight, Crown, Star, RotateCw, CreditCard, Copy, Check, DollarSign, Target, Trash2 } from "lucide-react";
import CashoutModal from "@/components/discover/CashoutModal";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ShippingForm from "@/components/store/ShippingForm";
import { useAuth } from "@/hooks/useAuth";
import { useVipStatus } from "@/hooks/useVipStatus";
import { toast } from "sonner";
import fireRed from "@/assets/rewards/fire-red.png";
import fireBlue from "@/assets/rewards/fire-blue.png";

const RARITY_STYLES: Record<string, { bg: string; text: string; labelColor: string }> = {
  common: { bg: "bg-neutral-700", text: "text-white", labelColor: "text-green-500" },
  rare: { bg: "bg-blue-600", text: "text-white", labelColor: "text-red-500" },
  legendary: { bg: "bg-amber-500", text: "text-black", labelColor: "text-cyan-400" },
};

function RarityLabel({ rarity, cashoutValue }: { rarity: string; cashoutValue?: number }) {
  const style = RARITY_STYLES[rarity] || RARITY_STYLES.common;
  const label = rarity.charAt(0).toUpperCase() + rarity.slice(1);
  const fireIcon = rarity === "rare" ? fireRed : rarity === "legendary" ? fireBlue : null;
  const hasCashout = rarity === "legendary" && cashoutValue && cashoutValue > 0;

  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col items-start">
      <div className="flex items-center gap-0.5">
        <span className={`font-black text-base drop-shadow-lg ${style.labelColor}`} style={{ textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>
          {label}
        </span>
        {fireIcon && (
          <img src={fireIcon} alt="" className="w-5 h-5 -mt-0.5" />
        )}
      </div>
      {hasCashout && (
        <span className="font-black text-xs text-yellow-400 drop-shadow-lg" style={{ textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}>
          Cash Out ${cashoutValue.toFixed(0)}
        </span>
      )}
    </div>
  );
}

function RewardCard({ reward, onClick, isPremiumVip }: { reward: any; onClick: () => void; isPremiumVip?: boolean }) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-2xl overflow-hidden bg-neutral-900 aspect-square group text-left border border-neutral-700/50 hover:border-neutral-600 transition-all"
    >
      {reward.image_url ? (
        <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-neutral-800">
          <span className="text-4xl">🎁</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/20" />
      <RarityLabel rarity={reward.rarity} cashoutValue={Number(reward.cashout_value) || 0} />
      <div className="absolute bottom-0 left-0 right-0 p-3 text-center">
        <p className="font-black text-sm leading-tight text-white drop-shadow-lg">
          {reward.title}
        </p>
      </div>
    </button>
  );
}

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
  const [instantRedeeming, setInstantRedeeming] = useState(false);
  const [showGiftCards, setShowGiftCards] = useState(false);
  const [redeemingGiftCard, setRedeemingGiftCard] = useState<string | null>(null);
  const [redeemedCode, setRedeemedCode] = useState<{ code: string; brand: string; value: number } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showPaypalPrompt, setShowPaypalPrompt] = useState<any | null>(null);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cashingOut, setCashingOut] = useState(false);
  const [showCashoutModal, setShowCashoutModal] = useState(false);
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

  // Fetch available gift cards
  const { data: giftCardsData } = useQuery({
    queryKey: ["store-gift-cards"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("redeem-giftcard", {
        body: { action: "list" },
      });
      if (error) throw error;
      return data?.cards || [];
    },
  });

  // Fetch user's wishlist/goal items
  const { data: wishlistItems = [], refetch: refetchWishlist } = useQuery({
    queryKey: ["wishlist-items", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("user_id", user!.id)
        .in("status", ["active", "rejected"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Get common rewards for the spin mechanic
  const commonRewards = rewards?.filter((r: any) => r.rarity === "common") || [];

  const [landedItem, setLandedItem] = useState<any | null>(null);

  const handleSpinToWin = (reward: any) => {
    setShowSpinToWin(reward);
    setSpinState("idle");
    setSpinResult([]);
    setCanRespin(false);
    setLandedItem(null);
  };

  const executeItemSpin = (targetReward: any, isRespin = false) => {
    setSpinState("spinning");
    setSpinAnimating(true);
    
    // Pick 3 random commons
    const shuffled = [...commonRewards].sort(() => Math.random() - 0.5);
    const commons = shuffled.slice(0, Math.min(3, shuffled.length));
    if (commons.length === 0) return;
    
    // Wishlist items always win (guaranteed spin)
    const isWishlist = targetReward._isWishlist === true;
    const roll = Math.random() * 100;
    const won = isWishlist ? true : roll < chanceEnhancer;
    
    // Build the reel
    const { items, winnerIndex } = buildSpinReel(commons, targetReward, won);
    setSpinReelItems(items);
    setSpinWinnerIndex(winnerIndex);
    setSpinResult(items);
    
    // Animate: after a short delay, scroll the reel to the winner position
    requestAnimationFrame(() => {
      if (reelRef.current) {
        // Reset position instantly
        reelRef.current.style.transition = "none";
        reelRef.current.style.transform = "translateX(0)";
        
        requestAnimationFrame(() => {
          if (reelRef.current) {
            const itemWidth = 88; // 80px + 8px gap
            const containerCenter = 160; // half of ~320px viewport area
            const targetX = winnerIndex * itemWidth - containerCenter + 40;
            reelRef.current.style.transition = "transform 3.5s cubic-bezier(0.15, 0.85, 0.35, 1)";
            reelRef.current.style.transform = `translateX(-${targetX}px)`;
          }
        });
      }
    });
    
    setTimeout(() => {
      setSpinAnimating(false);
      // The item at winnerIndex is what they landed on
      const landed = items[winnerIndex];
      setLandedItem(landed);
      if (won) {
        setSpinState("won");
        toast.success(`🎉 You won ${targetReward.title}!`);
      } else {
        setSpinState("lost");
        if (isPremiumVip && targetReward.rarity === "legendary" && !isRespin) {
          setCanRespin(true);
        }
      }
    }, 4000);
  };

  const handleRespin = () => {
    if (!showSpinToWin) return;
    setCanRespin(false);
    executeItemSpin(showSpinToWin, true);
  };

  // Spin to Win overlay
  if (showSpinToWin) {
    const targetReward = showSpinToWin;
    const rarity = RARITY_STYLES[targetReward?.rarity] || RARITY_STYLES.common;
    const rarityColor = targetReward?.rarity === "legendary" ? "text-amber-400" : "text-blue-400";

    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8 overflow-hidden">
        {/* Header */}
        <div className="w-full flex items-center pt-3 pb-2">
          <button onClick={() => { setShowSpinToWin(null); setSpinReelItems([]); }} className="flex items-center gap-1 hover:opacity-80">
            <ChevronLeft className="w-7 h-7" />
            <span className="font-black text-sm">BACK</span>
          </button>
        </div>

        <h1 className="text-3xl font-black mt-2 mb-1">🎰 SPIN TO WIN</h1>
        <p className="text-neutral-400 text-xs mb-3 text-center">
          Land on the <span className={`${rarityColor} font-bold`}>{targetReward.rarity}</span> item to win!
        </p>

        {/* CE Display */}
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-5 flex items-center gap-2">
          <span className="text-orange-400 text-xs font-black">
            🔥 Win Chance: {Math.round(chanceEnhancer)}%
          </span>
        </div>

        {/* Target item preview */}
        <div className="mb-5 text-center">
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider mb-2">You're spinning for</p>
          <div className="w-20 h-20 rounded-2xl overflow-hidden bg-neutral-800 mx-auto mb-2 border-2 border-amber-500/50 shadow-lg shadow-amber-500/20">
            {targetReward.image_url ? (
              <img src={targetReward.image_url} alt={targetReward.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl">🎁</div>
            )}
          </div>
          <p className="font-black text-sm">{targetReward.title}</p>
          <span className={`${rarity.bg} ${rarity.text} px-3 py-0.5 rounded-md font-bold text-[10px] inline-block mt-1`}>
            {targetReward.rarity.charAt(0).toUpperCase() + targetReward.rarity.slice(1)}
          </span>
        </div>

        {/* Spin Reel */}
        {spinReelItems.length > 0 && (
          <div className="w-full max-w-sm mb-6 relative">
            {/* Pointer indicator */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-2 z-20">
              <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-400" />
            </div>
            {/* Bottom pointer */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 -mb-2 z-20">
              <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[14px] border-l-transparent border-r-transparent border-b-yellow-400" />
            </div>
            
            {/* Reel container with mask */}
            <div className="overflow-hidden rounded-2xl border-2 border-neutral-700 bg-neutral-900 py-3"
              style={{ 
                maskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 15%, black 85%, transparent 100%)"
              }}
            >
              <div ref={reelRef} className="flex gap-2 pl-[140px]" style={{ willChange: "transform" }}>
                {spinReelItems.map((item, i) => {
                  const isLanded = !spinAnimating && i === spinWinnerIndex;
                  const isTarget = item.isTarget;
                  const borderColor = isLanded
                    ? (spinState === "won" ? "border-green-500 shadow-green-500/40 shadow-lg" : "border-red-500 shadow-red-500/30 shadow-lg")
                    : isTarget
                    ? (targetReward.rarity === "legendary" ? "border-amber-500/40" : "border-blue-500/40")
                    : "border-neutral-700";
                  
                  return (
                    <div
                      key={i}
                      className={`w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all duration-500 ${borderColor} ${
                        !spinAnimating && spinState !== "idle" && i !== spinWinnerIndex ? "opacity-40" : ""
                      }`}
                    >
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-neutral-800 flex items-center justify-center text-2xl">🎁</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Result message */}
        {spinState === "won" && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-4 text-center animate-scale-in">
            <p className="text-green-400 font-black text-xl">🎉 YOU WON!</p>
            <p className="text-neutral-300 text-sm mt-1">Click below to claim your prize</p>
            {isPremiumVip && targetReward.rarity === "legendary" && Number(targetReward.cashout_value) > 0 && (
              <p className="text-green-300 text-xs mt-2">
                💰 You can also cash out <span className="font-black text-green-400">${Number(targetReward.cashout_value).toFixed(2)}</span> instead!
              </p>
            )}
          </div>
        )}
        {spinState === "lost" && !canRespin && landedItem && (
          <div className="bg-neutral-800 border border-neutral-700 rounded-2xl p-4 mb-4 text-center animate-scale-in">
            <p className="text-neutral-300 font-black text-sm mb-2">You landed on:</p>
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-700 mx-auto mb-2 border-2 border-neutral-500">
              {landedItem.image_url ? (
                <img src={landedItem.image_url} alt={landedItem.title} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
              )}
            </div>
            <p className="text-white font-bold text-sm">{landedItem.title}</p>
            <p className="text-neutral-500 text-xs mt-1">🪙 {landedItem.minutes_cost} Minutes</p>
          </div>
        )}
        {spinState === "lost" && canRespin && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl p-4 mb-4 text-center animate-scale-in">
            <p className="text-purple-400 font-black text-lg">👑 Premium VIP Perk!</p>
            <p className="text-neutral-300 text-sm">You get one more shot at this legendary item</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="w-full max-w-xs space-y-3 mt-auto">
          {spinState === "idle" && (
            <button
              onClick={() => executeItemSpin(targetReward)}
              className="w-full py-4 rounded-full font-black text-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:scale-105 active:scale-95 transition-all shadow-lg shadow-orange-500/30"
            >
              🎰 SPIN NOW!
            </button>
          )}
          {spinState === "spinning" && (
            <button disabled className="w-full py-4 rounded-full font-black text-lg bg-neutral-700 text-neutral-400 cursor-wait animate-pulse">
              SPINNING...
            </button>
          )}
          {spinState === "won" && (
            <>
              <button
                onClick={() => {
                  const isSpinOrAd = targetReward.type === "Spins" || targetReward.type === "Ad Points";
                  if (isSpinOrAd) {
                    handleInstantRedeem(targetReward);
                    setShowSpinToWin(null);
                    setSpinReelItems([]);
                  } else {
                    setShowSpinToWin(null);
                    setSpinReelItems([]);
                    setSelectedReward(targetReward);
                    setShowShipping(true);
                  }
                }}
                className="w-full py-4 rounded-full font-black text-lg bg-green-600 hover:bg-green-700 text-white transition-all shadow-lg"
              >
                {targetReward.type === "Spins" ? "🎰 CLAIM SPIN TOKENS" : targetReward.type === "Ad Points" ? "⚡ CLAIM AD POINTS" : "🎁 REDEEM ITEM"}
              </button>
              {isPremiumVip && targetReward.rarity === "legendary" && Number(targetReward.cashout_value) > 0 && (
                <button
                  onClick={() => {
                    setShowPaypalPrompt(targetReward);
                    setPaypalEmail("");
                  }}
                  className="w-full py-4 rounded-full font-black text-lg bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-105 active:scale-95 transition-all shadow-lg"
                >
                  💰 CASH OUT ${Number(targetReward.cashout_value).toFixed(2)}
                </button>
              )}
            </>
          )}
          {canRespin && (
            <button
              onClick={handleRespin}
              className="w-full py-4 rounded-full font-black text-lg bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <RotateCw className="w-5 h-5" /> SPIN AGAIN (VIP)
            </button>
          )}
          {spinState === "lost" && !canRespin && landedItem && (
            <>
              <button
                onClick={() => {
                  setShowSpinToWin(null);
                  setSpinReelItems([]);
                  setSelectedReward(landedItem);
                  setShowShipping(true);
                }}
                disabled={(userMinutes ?? 0) < landedItem.minutes_cost}
                className={`w-full py-4 rounded-full font-black text-lg transition-all shadow-lg ${
                  (userMinutes ?? 0) >= landedItem.minutes_cost
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                }`}
              >
                🎁 Redeem {landedItem.title}
              </button>
              <button
                onClick={async () => {
                  // Deduct the target item's minutes as the loss penalty
                  try {
                    const { error } = await supabase.functions.invoke("earn-minutes", {
                      body: { type: "deduct", userId: user!.id, amount: targetReward.minutes_cost },
                    });
                    if (error) throw error;
                    toast("😔 You lost 🪙 " + targetReward.minutes_cost + " minutes");
                    queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
                  } catch (e) {
                    toast.error("Failed to process loss");
                  }
                  setShowSpinToWin(null);
                  setSpinReelItems([]);
                }}
                className="w-full py-3 rounded-full font-black text-sm bg-red-900/40 border border-red-500/30 text-red-400 hover:bg-red-900/60 transition-all"
              >
                Take the Loss (−🪙 {targetReward.minutes_cost} Minutes)
              </button>
            </>
          )}
        </div>

        {/* PayPal Email Prompt Modal (inside spin overlay) */}
        {showPaypalPrompt && (
          <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center px-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 w-full max-w-sm space-y-4">
              <h3 className="font-black text-lg text-center text-white">💰 Enter Your PayPal</h3>
              <p className="text-neutral-400 text-sm text-center">
                We'll send <span className="text-green-400 font-black">${Number(showPaypalPrompt.cashout_value).toFixed(2)}</span> to your PayPal account.
              </p>
              <input
                type="email"
                placeholder="your@paypal-email.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
              />
              <button
                disabled={cashingOut || !paypalEmail.includes("@")}
                onClick={async () => {
                  setCashingOut(true);
                  try {
                    const { error } = await supabase.functions.invoke("redeem-reward", {
                      body: {
                        action: "cashout-legendary",
                        rewardId: showPaypalPrompt.id,
                        paypalEmail: paypalEmail.trim(),
                      },
                    });
                    if (error) throw error;
                    toast.success(`💰 Cashed out $${Number(showPaypalPrompt.cashout_value).toFixed(2)}! Payment will be sent to ${paypalEmail.trim()}`);
                    queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
                    queryClient.invalidateQueries({ queryKey: ["public-rewards"] });
                    setShowSpinToWin(null);
                    setSpinReelItems([]);
                    setShowPaypalPrompt(null);
                  } catch (e: any) {
                    toast.error(e.message || "Cashout failed");
                  }
                  setCashingOut(false);
                }}
                className={`w-full py-4 rounded-full font-black text-lg transition-all shadow-lg ${
                  !paypalEmail.includes("@") || cashingOut
                    ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-105 active:scale-95"
                }`}
              >
                {cashingOut ? "Processing..." : `💰 CONFIRM CASHOUT`}
              </button>
              <button
                onClick={() => setShowPaypalPrompt(null)}
                className="w-full py-3 text-neutral-400 font-bold text-sm hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Instant redeem handler for Spins / Ad Points
  const handleInstantRedeem = async (reward: any) => {
    setInstantRedeeming(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-reward", {
        body: { action: "redeem-instant", rewardId: reward.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const label = reward.type === "Spins" ? "spin tokens" : "ad points";
      toast.success(`🎉 +${data.grantAmount} ${label} added to your account!`);
      queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
      setSelectedReward(null);
    } catch (e: any) {
      toast.error(e.message || "Redemption failed");
    } finally {
      setInstantRedeeming(false);
    }
  };

  const handleRedeemGiftCard = async (sampleId: string, brand: string) => {
    setRedeemingGiftCard(sampleId);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-giftcard", {
        body: { action: "redeem", giftCardId: sampleId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRedeemedCode({ code: data.code, brand: data.brand, value: data.value_amount });
      toast.success(`🎉 Gift card redeemed!`);
      queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
      queryClient.invalidateQueries({ queryKey: ["store-gift-cards"] });
    } catch (e: any) {
      toast.error(e.message || "Redemption failed");
    } finally {
      setRedeemingGiftCard(null);
    }
  };

  // Redeemed code display
  if (redeemedCode) {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-3xl font-black mb-2">GIFT CARD REDEEMED!</h1>
        <p className="text-neutral-400 mb-6">{redeemedCode.brand} ${redeemedCode.value.toFixed(2)}</p>
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 w-full max-w-xs text-center">
          <p className="text-neutral-500 text-xs font-bold mb-2">YOUR CODE</p>
          <p className="text-2xl font-mono font-black text-green-400 tracking-wider mb-4 break-all">{redeemedCode.code}</p>
          <button
            onClick={() => {
              navigator.clipboard.writeText(redeemedCode.code);
              setCopiedCode(true);
              setTimeout(() => setCopiedCode(false), 2000);
            }}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-neutral-800 hover:bg-neutral-700 font-bold text-sm transition-colors"
          >
            {copiedCode ? <><Check className="w-4 h-4 text-green-400" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
          </button>
        </div>
        <p className="text-neutral-400 text-[10px] font-bold mt-4">You can revisit this code anytime in My Rewards → Giftcards</p>
        <button
          onClick={() => { setRedeemedCode(null); setShowGiftCards(true); }}
          className="mt-6 text-neutral-400 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back to Gift Cards
        </button>
      </div>
    );
  }

  // Gift cards browse view
  if (showGiftCards) {
    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => setShowGiftCards(false)} className="flex items-center gap-1 hover:opacity-80">
            <ArrowLeft className="w-6 h-6" />
            <span className="font-bold text-sm">BACK</span>
          </button>
          <h1 className="flex-1 text-xl font-black tracking-widest text-right">GIFT CARDS</h1>
        </div>

        <div className="px-4 mb-4">
          <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-center">
            <p className="text-neutral-400 text-sm">Your Balance</p>
            <p className="text-green-400 font-black text-2xl">🪙 {userMinutes ?? 0} Minutes</p>
          </div>
        </div>

        <div className="flex-1 px-4 pb-6">
          {!giftCardsData?.length ? (
            <div className="text-center py-16">
              <CreditCard className="w-16 h-16 mx-auto mb-3 text-neutral-600" />
              <p className="text-neutral-500 font-bold">No gift cards available right now</p>
              <p className="text-neutral-600 text-sm">Check back later!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {giftCardsData.map((card: any, i: number) => (
                <div key={i} className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 flex items-center gap-4">
                  {card.image_url ? (
                    <img src={card.image_url} alt={card.brand} className="w-16 h-16 rounded-xl object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-neutral-800 flex items-center justify-center text-3xl">🎁</div>
                  )}
                  <div className="flex-1">
                    <p className="font-black text-lg">{card.brand}</p>
                    <p className="text-green-400 font-bold text-sm">${Number(card.value_amount).toFixed(2)} Gift Card</p>
                    <p className="text-neutral-500 text-xs">🪙 {card.minutes_cost} Minutes • {card.count} left</p>
                  </div>
                  <button
                    onClick={() => handleRedeemGiftCard(card.sample_id, card.brand)}
                    disabled={redeemingGiftCard !== null || (userMinutes ?? 0) < card.minutes_cost}
                    className={`px-4 py-2 rounded-full font-black text-sm transition-all ${
                      (userMinutes ?? 0) >= card.minutes_cost
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                    }`}
                  >
                    {redeemingGiftCard === card.sample_id ? "..." : "REDEEM"}
                  </button>
                </div>
              ))}
            </div>
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
    const isSpinsOrAdPoints = selectedReward.type === "Spins" || selectedReward.type === "Ad Points";
    const isInstantType = isSpinsOrAdPoints && selectedReward.rarity === "common";
    const isRareOrLegendary = !isInstantType && (selectedReward.rarity === "rare" || selectedReward.rarity === "legendary");
    const canSpinThis = !isInstantType && (selectedReward.rarity === "rare" || (selectedReward.rarity === "legendary" && isPremiumVip));
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
        <div className="px-4 mb-4 md:max-w-md md:mx-auto lg:max-w-lg">
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
            <div className="flex gap-2 flex-wrap">
              {sizes.map((size: string) => (
                <span key={size} className="bg-green-600 text-white font-black text-sm px-3 py-2 rounded-lg flex items-center justify-center whitespace-nowrap">
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
          {isInstantType && (
            <div className="mt-3 bg-purple-500/10 border border-purple-500/30 rounded-xl px-4 py-3">
              <p className="text-purple-400 font-black text-sm">
                {selectedReward.type === "Spins" ? "🎰" : "⚡"} You'll receive: <span className="text-white">{selectedReward.grant_amount || 0} {selectedReward.type === "Spins" ? "Spin Tokens" : "Ad Points"}</span>
              </p>
              <p className="text-neutral-400 text-[10px] mt-1">
                {selectedReward.type === "Spins"
                  ? "Spin tokens can be used in Spin to Win (Events). They bypass the daily limit!"
                  : "Ad points let you promote your content to other users."}
              </p>
            </div>
          )}
          {!isInstantType && isPremiumVip && displayShippingFee === 0 && Number(selectedReward.shipping_fee) > 0 && (
            <p className="text-purple-400 text-xs font-bold mt-1">👑 FREE SHIPPING (Premium VIP)</p>
          )}
          {selectedReward.rarity === "legendary" && Number(selectedReward.cashout_value) > 0 && (
            <div className="mt-3 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
              <p className="text-green-400 font-black text-sm">
                💰 Or Cash Out 🔺${Number(selectedReward.cashout_value).toFixed(2)}!
              </p>
              <p className="text-neutral-400 text-[10px] mt-1">
                Legendary items have real monetary value that can be cashed out if you win! The value increases the more it sits unredeemed.
              </p>
            </div>
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
              disabled={(userMinutes ?? 0) < selectedReward.minutes_cost}
              className={`w-full font-black text-lg py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 ${
                (userMinutes ?? 0) < selectedReward.minutes_cost
                  ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                  : selectedReward.rarity === "legendary"
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-black shadow-amber-900/30"
                    : "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-900/30"
              }`}
            >
              {(userMinutes ?? 0) < selectedReward.minutes_cost
                ? `🪙 Need ${selectedReward.minutes_cost} Minutes to Spin`
                : <>🎰 Spin to Win
                  {isPremiumVip && selectedReward.rarity === "legendary" && (
                    <span className="text-xs bg-black/20 px-2 py-0.5 rounded-full">+ Re-spin</span>
                  )}
                </>
              }
            </button>
          )}
          {isRareOrLegendary && !canSpinThis && selectedReward.rarity === "legendary" && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-4 text-center space-y-2">
              <p className="text-amber-400 font-black text-base">👑 PREMIUM VIP ONLY</p>
              <p className="text-neutral-300 text-sm leading-snug">
                Legendary items can only be won through <span className="text-amber-400 font-bold">Spin to Win</span> by <span className="text-amber-400 font-bold">Premium VIP</span> members.
              </p>
              <p className="text-neutral-500 text-xs">
                Upgrade to Premium VIP ($9.99/mo) to unlock legendary spins, cash-out rewards, re-spins & more.
              </p>
            </div>
          )}

          {!isRareOrLegendary && selectedReward.type !== "Spins" && selectedReward.type !== "Ad Points" && (
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

          {isInstantType && (
            <button
              onClick={() => handleInstantRedeem(selectedReward)}
              disabled={instantRedeeming || (userMinutes ?? 0) < selectedReward.minutes_cost}
              className={`w-full font-black text-xl py-4 rounded-xl transition-colors shadow-lg ${
                (userMinutes ?? 0) >= selectedReward.minutes_cost
                  ? selectedReward.type === "Spins"
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-purple-900/30 hover:scale-105 active:scale-95"
                    : "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-blue-900/30 hover:scale-105 active:scale-95"
                  : "bg-neutral-700 text-neutral-400 cursor-not-allowed"
              }`}
            >
              {instantRedeeming
                ? "Redeeming..."
                : selectedReward.type === "Spins"
                  ? `🎰 Redeem ${selectedReward.grant_amount || 0} Spin${(selectedReward.grant_amount || 0) !== 1 ? "s" : ""}`
                  : `⚡ Redeem ${selectedReward.grant_amount || 0} Ad Points`
              }
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
        <h1 className="text-2xl font-black tracking-widest uppercase" style={{ letterSpacing: '0.15em' }}>
          REWARD STORE
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

      {/* Gift Cards Button */}
      {giftCardsData && giftCardsData.length > 0 && (
        <div className="px-4 mb-3">
          <button
            onClick={() => setShowGiftCards(true)}
            className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-sm py-3 rounded-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
          >
            <CreditCard className="w-5 h-5" />
            🎁 GIFT CARDS ({giftCardsData.reduce((a: number, c: any) => a + c.count, 0)} Available)
          </button>
        </div>
      )}
      {/* My Goal Items */}
      {wishlistItems.length > 0 && (
        <div className="px-4 mb-4">
          <h3 className="font-black text-sm text-pink-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Target className="w-4 h-4" /> My Goal Items
          </h3>
          <div className="space-y-2">
            {(wishlistItems as any[]).map((item: any, index: number) => {
              const isRejected = item.status === "rejected";
              const isFirstActive = !isRejected && index === (wishlistItems as any[]).findIndex((w: any) => w.status === "active");
              const progress = isRejected ? 0 : Math.min(100, ((userMinutes ?? 0) / item.minutes_cost) * 100);
              const canRedeem = !isRejected && isFirstActive && (userMinutes ?? 0) >= item.minutes_cost;

              return (
                <div key={item.id} className={`bg-neutral-900 border rounded-xl p-3 flex items-center gap-3 ${isRejected ? "border-red-500/30 opacity-70" : isFirstActive ? "border-pink-500/50" : "border-neutral-700/50"}`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-neutral-800 flex items-center justify-center text-2xl flex-shrink-0">🎁</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-white truncate">{item.title}</p>
                      {isRejected && (
                        <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          REJECTED
                        </span>
                      )}
                      {!isRejected && isFirstActive && (
                        <span className="bg-pink-500/20 text-pink-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          NEXT UP
                        </span>
                      )}
                      {!isRejected && !isFirstActive && (
                        <span className="bg-neutral-700/50 text-neutral-500 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          QUEUED
                        </span>
                      )}
                    </div>
                    {isRejected ? (
                      <p className="text-red-400/80 text-xs mt-1">This item was rejected — it doesn't meet our guidelines. Try picking a different item.</p>
                    ) : (
                      <>
                        <p className="text-neutral-500 text-xs">🪙 {item.minutes_cost} Minutes needed</p>
                        <div className="mt-1.5 h-2 bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${canRedeem ? "bg-green-500" : "bg-pink-500"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          {canRedeem ? "✅ Ready to spin! (Guaranteed win!)" : isFirstActive ? `${Math.round(progress)}% — ${item.minutes_cost - (userMinutes ?? 0)} more to go` : `${Math.round(progress)}% — complete previous items first`}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {canRedeem && (
                      <button
                        onClick={() => {
                          const fakeReward = {
                            id: item.id,
                            title: item.title,
                            image_url: item.image_url,
                            rarity: "rare",
                            minutes_cost: item.minutes_cost,
                            cashout_value: 0,
                            type: "Product",
                            _isWishlist: true,
                            _wishlistSourceUrl: item.source_url,
                          };
                          handleSpinToWin(fakeReward);
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-black text-[10px] px-3 py-1.5 rounded-lg transition-colors"
                      >
                        🎰 SPIN
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await supabase.from("wishlist_items").update({ status: "removed" } as any).eq("id", item.id);
                        refetchWishlist();
                        toast.success("Item removed from goals");
                      }}
                      className="text-neutral-600 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {filteredRewards.map((reward: any) => (
                <RewardCard
                  key={reward.id}
                  reward={reward}
                  onClick={() => setSelectedReward(reward)}
                  isPremiumVip={isPremiumVip}
                />
              ))}
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
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-6">
                  {categoryCards.map((cat: any) => {
                    const isVipCategory = cat.show_as === "As VIP Reward";
                    const isLocked = isVipCategory && !subscribed;

                    return (
                      <button
                        key={cat.id}
                        onClick={() => {
                          if (isLocked) {
                            toast("👑 VIP members only! Subscribe to unlock exclusive rewards.", {
                              icon: "🔒",
                              action: {
                                label: "Become VIP",
                                onClick: () => navigate("/videocall", { state: { openVip: true } }),
                              },
                              duration: 5000,
                            });
                            return;
                          }
                          setSelectedCategory(cat.id);
                        }}
                        className={`relative rounded-2xl overflow-hidden bg-neutral-800 aspect-square group text-left ${isLocked ? "cursor-not-allowed" : ""}`}
                      >
                        {cat.image_url ? (
                          <img src={cat.image_url} alt={cat.name} className={`w-full h-full object-cover transition-transform duration-300 ${isLocked ? "blur-[6px] scale-105" : "group-hover:scale-105"}`} />
                        ) : (
                          <div className={`w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-900 flex items-center justify-center ${isLocked ? "blur-[6px]" : ""}`}>
                            <span className="text-4xl">📦</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                        {/* VIP Lock Overlay */}
                        {isLocked && (
                          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
                            <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-full p-3 mb-2 shadow-lg shadow-amber-500/30">
                              <Crown className="w-6 h-6 text-black" />
                            </div>
                            <p className="font-black text-xs text-amber-400 tracking-wider">VIP ONLY</p>
                          </div>
                        )}

                        <div className="absolute top-3 left-3 z-20">
                          <div className="flex items-center gap-1.5">
                            {isVipCategory && <Crown className="w-4 h-4 text-amber-400" />}
                            <p className="font-black text-base text-white drop-shadow-lg">{cat.name}</p>
                          </div>
                        </div>
                        <div className="absolute bottom-3 left-3 z-20">
                          <span className="bg-black/60 backdrop-blur-sm text-white font-bold text-xs px-3 py-1.5 rounded-lg">
                            {isLocked ? "🔒 Unlock with VIP" : `${cat.count} Items`}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {(!categoryCards || categoryCards.length === 0) && rewards && rewards.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {rewards.map((reward: any) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      onClick={() => setSelectedReward(reward)}
                      isPremiumVip={isPremiumVip}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* PayPal Email Prompt Modal */}
      {showPaypalPrompt && (
        <div className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center px-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-3xl p-6 w-full max-w-sm space-y-4">
            <h3 className="font-black text-lg text-center text-white">💰 Enter Your PayPal</h3>
            <p className="text-neutral-400 text-sm text-center">
              We'll send <span className="text-green-400 font-black">${Number(showPaypalPrompt.cashout_value).toFixed(2)}</span> to your PayPal account.
            </p>
            <input
              type="email"
              placeholder="your@paypal-email.com"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              className="w-full bg-white/10 border-2 border-white/20 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/40 focus:outline-none focus:border-green-500/50"
            />
            <button
              disabled={cashingOut || !paypalEmail.includes("@")}
              onClick={async () => {
                setCashingOut(true);
                try {
                  const { error } = await supabase.functions.invoke("redeem-reward", {
                    body: {
                      action: "cashout-legendary",
                      rewardId: showPaypalPrompt.id,
                      paypalEmail: paypalEmail.trim(),
                    },
                  });
                  if (error) throw error;
                  toast.success(`💰 Cashed out $${Number(showPaypalPrompt.cashout_value).toFixed(2)}! Payment will be sent to ${paypalEmail.trim()}`);
                  queryClient.invalidateQueries({ queryKey: ["user-minutes-balance"] });
                  queryClient.invalidateQueries({ queryKey: ["public-rewards"] });
                  setShowSpinToWin(null);
                  setSpinReelItems([]);
                  setShowPaypalPrompt(null);
                } catch (e: any) {
                  toast.error(e.message || "Cashout failed");
                }
                setCashingOut(false);
              }}
              className={`w-full py-4 rounded-full font-black text-lg transition-all shadow-lg ${
                !paypalEmail.includes("@") || cashingOut
                  ? "bg-neutral-700 text-neutral-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:scale-105 active:scale-95"
              }`}
            >
              {cashingOut ? "Processing..." : `💰 CONFIRM CASHOUT`}
            </button>
            <button
              onClick={() => setShowPaypalPrompt(null)}
              className="w-full py-3 text-neutral-400 font-bold text-sm hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


export default RewardStorePage;
