import { useState } from "react";
import { usePublicRewards, usePublicCategories, usePublicMilestones } from "@/hooks/useCrud";
import { Badge } from "@/components/ui/badge";
import { X, ArrowLeft, ChevronLeft, ChevronRight, Crown, Star, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const RARITY_STYLES: Record<string, { bg: string; text: string }> = {
  common: { bg: "bg-neutral-700", text: "text-white" },
  rare: { bg: "bg-blue-600", text: "text-white" },
  legendary: { bg: "bg-amber-500", text: "text-black" },
};

const RewardStorePage = () => {
  const navigate = useNavigate();
  const { data: rewards, isLoading: loadingRewards } = usePublicRewards();
  const { data: categories } = usePublicCategories();
  const { data: milestones } = usePublicMilestones();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedReward, setSelectedReward] = useState<any | null>(null);

  const filteredRewards = selectedCategory
    ? rewards?.filter((r: any) => r.category_id === selectedCategory)
    : rewards;

  // Group rewards by category for the grid view
  const categoryCards = categories?.map((cat: any) => {
    const count = rewards?.filter((r: any) => r.category_id === cat.id).length ?? 0;
    return { ...cat, count };
  });

  // Product detail view
  if (selectedReward) {
    const rarity = RARITY_STYLES[selectedReward.rarity] || RARITY_STYLES.common;
    const sizes = selectedReward.sizes?.split(",").map((s: string) => s.trim()).filter(Boolean) || [];

    return (
      <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => setSelectedReward(null)} className="flex items-center gap-1 text-white hover:text-neutral-300 transition-colors">
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
            {selectedReward.image_url ? (
              <img src={selectedReward.image_url} alt={selectedReward.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <span className="text-6xl">🎁</span>
              </div>
            )}
            {/* Rarity badge */}
            <span className={`absolute bottom-3 right-3 ${rarity.bg} ${rarity.text} px-4 py-1.5 rounded-lg font-black text-sm`}>
              {selectedReward.rarity.charAt(0).toUpperCase() + selectedReward.rarity.slice(1)}
            </span>
            {/* Nav arrows */}
            <button className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 rounded-full p-1.5 transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

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
            <div className="flex gap-2 text-2xl">
              🇺🇸 🇬🇧
            </div>
          </div>
        )}

        {/* Brief */}
        {selectedReward.brief && (
          <div className="px-4 mb-4">
            <p className="text-neutral-400 text-sm">{selectedReward.brief}</p>
          </div>
        )}

        {/* Minutes cost */}
        <div className="px-4 mb-4">
          <p className="text-neutral-400 text-sm">
            Cost: <span className="text-white font-bold">🪙 {selectedReward.minutes_cost} Minutes</span>
          </p>
        </div>

        {/* Redeem button */}
        <div className="mt-auto px-4 pb-6">
          <button className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-xl py-4 rounded-xl transition-colors shadow-lg shadow-green-900/30">
            Redeem This Product
          </button>
        </div>
      </div>
    );
  }

  // Main store view - category grid
  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <button onClick={() => navigate(-1)} className="text-red-500 hover:text-red-400 transition-colors">
          <X className="w-8 h-8" strokeWidth={3} />
        </button>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-1">
          <span>⚡</span> Reward Store <span>⚡</span>
        </h1>
        <div className="w-8" />
      </div>

      {/* Categories Grid */}
      {loadingRewards ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
        </div>
      ) : selectedCategory ? (
        /* Rewards list for selected category */
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
                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    {/* Title */}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="font-black text-sm leading-tight text-white drop-shadow-lg">{reward.title}</p>
                      <p className="text-xs text-neutral-300 mt-0.5">🪙 {reward.minutes_cost} min</p>
                    </div>
                    {/* Rarity */}
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
        /* Category grid */
        <div className="flex-1 px-4 pb-6">
          {!categoryCards?.length && !rewards?.length ? (
            <p className="text-neutral-500 text-center py-10">No rewards available yet. Start chatting to unlock!</p>
          ) : (
            <>
              {/* Category cards */}
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
                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      {/* Category info */}
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

              {/* "All Rewards" section if no categories */}
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

      {/* Milestones section */}
      {milestones && milestones.length > 0 && !selectedCategory && (
        <div className="px-4 pb-8">
          <h2 className="text-xl font-black mb-3 flex items-center gap-2">
            <Target className="w-5 h-5 text-yellow-400" />
            Milestones
          </h2>
          <div className="space-y-3">
            {milestones.map((ms: any) => (
              <div key={ms.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-yellow-400 font-black text-lg">{ms.unlock_minutes}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-white">{ms.title}</p>
                  {ms.brief && <p className="text-xs text-neutral-500 mt-0.5 line-clamp-1">{ms.brief}</p>}
                  <div className="flex gap-1 mt-1.5">
                    {ms.vip_only && (
                      <span className="bg-amber-500/10 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded">VIP</span>
                    )}
                    {ms.milestone_rewards?.map((mr: any) => (
                      <span key={mr.id} className="bg-neutral-800 text-neutral-400 text-[10px] font-bold px-2 py-0.5 rounded">
                        {mr.rewards?.title}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] text-neutral-600 font-bold">UNLOCK</p>
                  <p className="text-yellow-400 font-black">{ms.unlock_minutes} min</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardStorePage;
