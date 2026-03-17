import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";
import { useRef, useEffect } from "react";

interface DiscoverTeaserProps {
  myGender: string | null;
  myUserId: string;
  onOpenDiscover: () => void;
}

const DiscoverTeaser = ({ myGender, myUserId, onOpenDiscover }: DiscoverTeaserProps) => {
  const oppositeGender = myGender?.toLowerCase() === "female" ? "male" : "female";
  const scrollRef = useRef<HTMLDivElement>(null);

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
        .limit(10);

      if (myGender) {
        query = query.eq("gender", oppositeGender);
      }

      const { data } = await query;
      return (data ?? []).filter((m) => m.image_url);
    },
  });

  // Auto-scroll carousel
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || members.length === 0) return;

    let scrollPos = 0;
    const speed = 0.5; // px per frame

    const animate = () => {
      scrollPos += speed;
      // Reset to start when reaching end
      if (scrollPos >= el.scrollWidth - el.clientWidth) {
        scrollPos = 0;
      }
      el.scrollLeft = scrollPos;
      rafId = requestAnimationFrame(animate);
    };

    let rafId = requestAnimationFrame(animate);

    // Pause on hover
    const pause = () => cancelAnimationFrame(rafId);
    const resume = () => { rafId = requestAnimationFrame(animate); };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);
    el.addEventListener("touchstart", pause);
    el.addEventListener("touchend", resume);

    return () => {
      cancelAnimationFrame(rafId);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
    };
  }, [members.length]);

  if (members.length === 0) return null;

  return (
    <div className="w-full mt-2 animate-fade-in">
      <button
        onClick={onOpenDiscover}
        className="flex items-center gap-1.5 mx-auto mb-2 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        People waiting to chat
      </button>

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-hidden px-2"
      >
        {members.map((m) => (
          <button
            key={m.id}
            onClick={onOpenDiscover}
            className="flex-none w-20 group cursor-pointer"
          >
            <div className="relative w-20 h-24 rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-colors">
              <img
                src={m.image_url!}
                alt={m.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1 pt-3">
                <p className="text-white text-[9px] font-bold truncate">{m.name}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={onOpenDiscover}
        className="mt-2 mx-auto block px-6 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
      >
        Open Discover →
      </button>
    </div>
  );
};

export default DiscoverTeaser;
