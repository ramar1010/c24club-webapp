import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

interface DiscoverTeaserProps {
  myGender: string | null;
  myUserId: string;
  onOpenDiscover: () => void;
}

const DiscoverTeaser = ({ myGender, myUserId, onOpenDiscover }: DiscoverTeaserProps) => {
  const oppositeGender = myGender?.toLowerCase() === "female" ? "Male" : "Female";

  const { data: members = [] } = useQuery({
    queryKey: ["discover-teaser", oppositeGender, myUserId],
    enabled: !!myGender,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, image_url, country")
        .eq("is_discoverable", true)
        .eq("image_status", "approved")
        .eq("gender", oppositeGender)
        .neq("id", myUserId)
        .order("last_active_at", { ascending: false })
        .limit(6);
      return (data ?? []).filter((m) => m.image_url);
    },
  });

  if (members.length === 0) return null;

  return (
    <div className="w-full max-w-xs mt-4">
      <button
        onClick={onOpenDiscover}
        className="flex items-center gap-1.5 mx-auto mb-2 text-amber-400 text-xs font-bold hover:text-amber-300 transition-colors"
      >
        <Sparkles className="w-3.5 h-3.5" />
        People waiting to chat
      </button>
      <div className="grid grid-cols-3 gap-1.5">
        {members.slice(0, 6).map((m) => (
          <button
            key={m.id}
            onClick={onOpenDiscover}
            className="relative aspect-[3/4] rounded-lg overflow-hidden group cursor-pointer border border-white/10 hover:border-white/30 transition-colors"
          >
            <img
              src={m.image_url!}
              alt={m.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-1.5 pt-4">
              <p className="text-white text-[10px] font-bold truncate">{m.name}</p>
              {m.country && (
                <p className="text-white/50 text-[8px] truncate">{m.country}</p>
              )}
            </div>
          </button>
        ))}
      </div>
      <button
        onClick={onOpenDiscover}
        className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
      >
        Open Discover →
      </button>
    </div>
  );
};

export default DiscoverTeaser;
