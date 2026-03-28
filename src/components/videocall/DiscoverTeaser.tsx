import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, MessageCircle } from "lucide-react";
import Autoplay from "embla-carousel-autoplay";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import RewardTeaser from "@/components/videocall/RewardTeaser";

interface DiscoverTeaserProps {
  myGender: string | null;
  myUserId: string;
  onOpenDiscover: () => void;
  onOpenStore?: () => void;
  onOpenMessages?: () => void;
}

const MemberCard = ({
  m,
  onOpenDiscover,
  onDm,
}: {
  m: { id: string; name: string; image_url: string | null; country: string | null };
  onOpenDiscover: () => void;
  onDm: (e: React.MouseEvent) => void;
}) => (
  <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden group border border-white/10 hover:border-white/30 transition-colors">
    <button
      onClick={onOpenDiscover}
      className="w-full h-full cursor-pointer"
    >
      <img
        src={m.image_url!}
        alt={m.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        loading="lazy"
      />
    </button>
    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-2 pt-6">
      <p className="text-white text-xs font-bold truncate">{m.name}</p>
      {m.country && (
        <p className="text-white/50 text-[9px] truncate">{m.country}</p>
      )}
      <button
        onClick={onDm}
        className="mt-1.5 flex items-center justify-center gap-1 w-full py-1 rounded-md bg-pink-600/90 hover:bg-pink-500 text-white text-[10px] font-bold transition-colors"
      >
        <MessageCircle className="w-3 h-3" />
        DM
      </button>
    </div>
  </div>
);

const DiscoverTeaser = ({ myGender, myUserId, onOpenDiscover, onOpenStore, onOpenMessages }: DiscoverTeaserProps) => {
  const oppositeGender = myGender?.toLowerCase() === "female" ? "male" : "female";
  const [showRewards, setShowRewards] = useState(false);

  // Alternate between discover and rewards every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setShowRewards((prev) => !prev);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ["discover-teaser", oppositeGender, myUserId],
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from("members")
        .select("id, name, image_url, country")
        .eq("is_discoverable", true)
        .eq("image_status", "approved")
        .neq("id", myUserId)
        .order("last_active_at", { ascending: false })
        .limit(8);

      if (myGender) {
        query = query.eq("gender", oppositeGender);
      }

      const { data } = await query;
      return (data ?? []).filter((m) => m.image_url);
    },
  });

  const hasMembers = members.length > 0;

  const handleDm = (memberId: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    // Store the target partner ID for the messages overlay to pick up
    window.dispatchEvent(new CustomEvent("open-dm-to-user", { detail: { partnerId: memberId } }));
    onOpenMessages?.();
  };

  // If showing rewards phase and we have an onOpenStore handler
  if (showRewards && onOpenStore) {
    return (
      <div className="transition-opacity duration-500 animate-in fade-in">
        <RewardTeaser myGender={myGender} onOpenStore={onOpenStore} />
      </div>
    );
  }

  if (!hasMembers) {
    // Fall back to rewards if no discover members
    if (onOpenStore) {
      return <RewardTeaser myGender={myGender} onOpenStore={onOpenStore} />;
    }
    return null;
  }

  return (
    <div className="w-full max-w-[360px] mt-3 transition-opacity duration-500 animate-in fade-in">
      <button
        onClick={onOpenDiscover}
        className="flex items-center gap-1.5 mx-auto mb-2 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        People waiting to chat
      </button>

      <Carousel
        opts={{ align: "start", loop: true }}
        plugins={[Autoplay({ delay: 3000, stopOnInteraction: false })]}
        className="w-full"
      >
        <CarouselContent className="-ml-2">
          {members.slice(0, 8).map((m) => (
            <CarouselItem key={m.id} className="basis-1/3 pl-2">
              <MemberCard m={m} onOpenDiscover={onOpenDiscover} onDm={handleDm(m.id)} />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <button
        onClick={onOpenDiscover}
        className="mt-2.5 w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
      >
        Open Discover →
      </button>
    </div>
  );
};

export default DiscoverTeaser;
