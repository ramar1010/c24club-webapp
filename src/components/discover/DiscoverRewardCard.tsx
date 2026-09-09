import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface DiscoverReward {
  id: string;
  title: string;
  image_url: string | null;
  rarity: string;
  minutes_cost: number;
}

/** Rewards to sprinkle between Discover profile cards, targeted to the viewer's gender. */
export const useDiscoverRewards = (myGender: string | null) => {
  const gender = myGender?.toLowerCase() || null;

  return useQuery({
    queryKey: ["discover-inline-rewards", gender],
    staleTime: 120_000,
    queryFn: async (): Promise<DiscoverReward[]> => {
      const { data } = await supabase
        .from("rewards")
        .select("id, title, image_url, rarity, minutes_cost, type, sub_type, target_gender")
        .eq("visible", true)
        .order("minutes_cost", { ascending: true })
        .limit(40);

      if (!data) return [];

      const filtered = data.filter((r) => {
        const isGiftCard = r.type === "giftcard" || r.sub_type === "giftcard";
        if (isGiftCard) return true;
        if (!r.target_gender) return true;
        return !!gender && r.target_gender.toLowerCase() === gender;
      });

      const withImages = filtered.filter((r) => r.image_url);
      for (let i = withImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [withImages[i], withImages[j]] = [withImages[j], withImages[i]];
      }
      return withImages.slice(0, 12) as DiscoverReward[];
    },
  });
};

const DiscoverRewardCard = ({ reward }: { reward: DiscoverReward }) => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate("/store")}
      className="relative aspect-[3/4] w-full rounded-xl overflow-hidden group border border-amber-400/30 hover:border-amber-400/70 transition-colors text-left"
    >
      {reward.image_url ? (
        <img
          src={reward.image_url}
          alt={reward.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full bg-white/5 flex items-center justify-center">
          <Gift className="w-8 h-8 text-white/30" />
        </div>
      )}

      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">
        <Gift className="w-2.5 h-2.5" />
        REWARD
      </div>
      {reward.rarity === "legendary" && (
        <div className="absolute top-1.5 right-1.5 bg-black/70 text-amber-400 text-[9px] font-black px-1.5 py-0.5 rounded-full">
          ★
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent p-2 pt-6">
        <p className="text-white text-xs font-bold truncate">{reward.title}</p>
        <p className="text-amber-400 text-[10px] font-semibold">{reward.minutes_cost} min</p>
        <span className="mt-1.5 block w-full py-1 rounded-md bg-amber-500 group-hover:bg-amber-400 text-black text-[10px] font-bold text-center transition-colors">
          Redeem
        </span>
      </div>
    </button>
  );
};

export default DiscoverRewardCard;
