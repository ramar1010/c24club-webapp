import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Search, X } from "lucide-react";

interface EmptyQueueBridgeProps {
  myUserId: string;
  myGender: string | null;
  onDmUser: (memberId: string) => void;
  onOpenDiscover: () => void;
  /** Called when the user closes the popup (lets the parent unlock lower-priority popups). */
  onDismiss?: () => void;
}

/**
 * Popup shown when the random-chat queue stays quiet. Instead of letting the user bounce,
 * we bridge them into DMs with recently-active opposite-gender members.
 * Rendered as a centered modal via portal so it overlays the video box rather than
 * displacing its content.
 */
const EmptyQueueBridge = ({ myUserId, myGender, onDmUser, onOpenDiscover, onDismiss }: EmptyQueueBridgeProps) => {
  const [dismissed, setDismissed] = useState(false);
  const oppositeGender = myGender?.toLowerCase() === "female" ? "male" : "female";

  // Reset the dismiss flag if the component re-mounts with a new user/gender.
  useEffect(() => {
    setDismissed(false);
  }, [myUserId, myGender]);

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

  if (dismissed || members.length === 0) return null;

  const label = oppositeGender === "female" ? "girls" : "guys";

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl border border-pink-500/40 bg-gradient-to-b from-pink-500/15 to-[#1a0f1a] p-5 shadow-2xl">
        <button
          onClick={() => { setDismissed(true); onDismiss?.(); }}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-2 mb-4 pr-8">
          <Search className="w-5 h-5 text-pink-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white text-base font-bold leading-snug">It's quiet right now</h3>
            <p className="text-white/80 text-xs leading-snug mt-1">
              Don't leave — these {label} were online recently. Send a message and they get notified
              instantly.
            </p>
          </div>
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
          className="mt-4 w-full py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
        >
          Browse everyone on Discover →
        </button>
      </div>
    </div>,
    document.body
  );
};

export default EmptyQueueBridge;
