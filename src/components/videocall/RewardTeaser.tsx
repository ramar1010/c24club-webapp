import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Gift } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";

interface RewardTeaserProps {
  myGender: string | null;
  onOpenStore: () => void;
}

const RewardCard = ({
  r,
  onOpenStore,
}: {
  r: { id: string; title: string; image_url: string | null; rarity: string; minutes_cost: number };
  onOpenStore: () => void;
}) => (
  <button
    onClick={onOpenStore}
    className="relative aspect-[3/4] w-full rounded-lg overflow-hidden group cursor-pointer border border-white/10 hover:border-amber-400/40 transition-colors"
  >
    {r.image_url ? (
      <img
        src={r.image_url}
        alt={r.title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
    ) : (
      <div className="w-full h-full bg-white/5 flex items-center justify-center">
        <Gift className="w-6 h-6 text-white/30" />
      </div>
    )}
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-4">
      <p className="text-white text-[10px] font-bold truncate">{r.title}</p>
      <p className="text-amber-400 text-[8px] font-semibold">{r.minutes_cost} min</p>
    </div>
    {r.rarity === "legendary" && (
      <div className="absolute top-1 right-1 bg-amber-500 text-black text-[7px] font-black px-1 rounded">
        ★
      </div>
    )}
  </button>
);

const RewardTeaser = ({ myGender, onOpenStore }: RewardTeaserProps) => {
  const gender = myGender?.toLowerCase() || null;

  const { data: rewards = [] } = useQuery({
    queryKey: ["reward-teaser", gender],
    staleTime: 120_000,
    queryFn: async () => {
      // Fetch gender-targeted rewards + gift cards (type='giftcard' or sub_type='giftcard')
      const { data } = await supabase
        .from("rewards")
        .select("id, title, image_url, rarity, minutes_cost, type, sub_type, target_gender")
        .eq("visible", true)
        .order("minutes_cost", { ascending: true })
        .limit(20);

      if (!data) return [];

      return data.filter((r) => {
        // Always include gift cards for both genders
        const isGiftCard = r.type === "giftcard" || r.sub_type === "giftcard";
        if (isGiftCard) return true;

        // Include items with matching target_gender or null (untagged)
        if (!r.target_gender) return true;
        if (gender && r.target_gender === gender) return true;

        return false;
      }).slice(0, 12);
    },
  });

  if (rewards.length === 0) return null;

  return (
    <div className="w-full max-w-[260px] mt-3">
      <button
        onClick={onOpenStore}
        className="flex items-center gap-1.5 mx-auto mb-1.5 text-emerald-400 text-[10px] font-bold hover:text-emerald-300 transition-colors"
      >
        <Gift className="w-3 h-3" />
        Rewards you can redeem
      </button>

      <Carousel
        opts={{ align: "start", loop: true }}
        plugins={[Autoplay({ delay: 3000, stopOnInteraction: false })]}
        className="w-full"
      >
        <CarouselContent className="-ml-1.5">
          {rewards.map((r) => (
            <CarouselItem key={r.id} className="basis-1/3 pl-1.5">
              <RewardCard r={r} onOpenStore={onOpenStore} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <button
        onClick={onOpenStore}
        className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
      >
        Browse Store →
      </button>
    </div>
  );
};

export default RewardTeaser;
