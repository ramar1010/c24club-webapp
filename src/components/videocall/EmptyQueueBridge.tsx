import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Search } from "lucide-react";

interface EmptyQueueBridgeProps {
  myUserId: string;
  myGender: string | null;
  onDmUser: (memberId: string) => void;
  onOpenDiscover: () => void;
}

/**
 * Shown when the random-chat queue stays quiet. Instead of letting the user bounce,
 * we bridge them into DMs with recently-active opposite-gender members.
 */
const EmptyQueueBridge = ({ myUserId, myGender, onDmUser, onOpenDiscover }: EmptyQueueBridgeProps) => {
  const oppositeGender = myGender?.toLowerCase() === "female" ? "male" : "female";

  const { data: members = [] } = useQuery({
    queryKey: ["empty-queue-bridge", oppositeGender, myUserId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("members")
        .select("id, name, image_url, last_active_at")
        .eq("is_discoverable", true)
        .eq("image_status", "approved")
        .ilike("gender", oppositeGender)
        .neq("id", myUserId)
        .not("image_url", "is", null)
        .order("last_active_at", { ascending: false, nullsFirst: false })
        .limit(6);
      return data ?? [];
    },
  });

  if (members.length === 0) return null;

  const label = oppositeGender === "female" ? "girls" : "guys";

  return (
    <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-b from-pink-500/10 to-transparent p-3">
      <div className="flex items-start gap-2 mb-3">
        <Search className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
        <p className="text-white text-xs font-semibold leading-snug">
          It's quiet right now — don't leave. These {label} were online recently. Send a message and
          they get notified instantly.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {members.map((m) => (
          <div
            key={m.id}
            className="relative aspect-[3/4] rounded-xl overflow-hidden border border-white/10"
          >
            <img src={m.image_url!} alt={m.name} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 to-transparent p-1.5 pt-5">
              <p className="text-white text-[10px] font-bold truncate">{m.name}</p>
              <button
                onClick={() => onDmUser(m.id)}
                className="mt-1 flex items-center justify-center gap-1 w-full py-1 rounded-md bg-pink-600 hover:bg-pink-500 text-white text-[10px] font-bold transition-colors"
              >
                <MessageCircle className="w-3 h-3" />
                Message
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={onOpenDiscover}
        className="mt-2.5 w-full py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
      >
        Browse everyone on Discover →
      </button>
    </div>
  );
};

export default EmptyQueueBridge;
