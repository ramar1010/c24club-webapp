import { useState } from "react";
import { Heart, MessageCircle, ChevronDown, ChevronUp, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTimeAgo, isOnlineNow } from "@/hooks/useDiscover";
import type { IncomingInterest } from "@/hooks/useDiscover";
import { toast } from "@/hooks/use-toast";

interface IncomingInterestsProps {
  interests: IncomingInterest[];
  myInterests: Map<string, string | null>;
  onInterestBack: (userId: string) => void;
  sendingInterest: string | null;
}

const IncomingInterests = ({ interests, myInterests, onInterestBack, sendingInterest }: IncomingInterestsProps) => {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleVideoChat = async (targetId: string) => {
    if (!user) return;
    try {
      // Create a direct call invite
      await supabase.from("direct_call_invites").insert({
        inviter_id: user.id,
        invitee_id: targetId,
      } as any);
      // Navigate to video call page
      navigate("/video-call");
      toast({ title: "📹 Starting video chat", description: "Join the call — we'll connect you when your match joins!" });
    } catch {
      navigate("/video-call");
    }
  };

  if (interests.length === 0) return null;

  const unreadCount = interests.filter(i => !myInterests.has(i.user_id)).length;

  return (
    <div className="mx-4 mt-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 rounded-xl bg-pink-500/10 border border-pink-500/30 hover:bg-pink-500/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-400 fill-pink-400" />
          <span className="text-white text-sm font-bold">Interested in You</span>
          {unreadCount > 0 && (
            <span className="bg-pink-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
              {unreadCount}
            </span>
          )}
          <span className="text-white/40 text-xs">{interests.length} total</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2 max-h-[300px] overflow-y-auto">
          {interests.map((interest) => {
            const alreadyLikedBack = myInterests.has(interest.user_id);
            const isMutual = alreadyLikedBack;

            return (
              <div
                key={interest.user_id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isMutual
                    ? "bg-pink-500/10 border-pink-500/30"
                    : "bg-white/5 border-white/10"
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white/10 shrink-0">
                  {interest.image_url ? (
                    <img src={interest.image_url} alt={interest.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/30 font-bold text-lg">
                      {interest.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-bold text-sm truncate">{interest.name}</p>
                    {isMutual && (
                      <span className="text-[10px] bg-pink-500/80 text-white px-1.5 py-0.5 rounded-full font-bold">💕 Match</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-white/40 text-xs">
                    {interest.country && <span>{interest.country}</span>}
                    <span>·</span>
                    <span>{getTimeAgo(interest.created_at)}</span>
                  </div>
                  {interest.icebreaker_message && (
                    <div className="flex items-center gap-1 mt-1">
                      <MessageCircle className="w-3 h-3 text-blue-400 shrink-0" />
                      <p className="text-blue-300 text-xs truncate">"{interest.icebreaker_message}"</p>
                    </div>
                  )}
                </div>

                {/* Action */}
                {!alreadyLikedBack ? (
                  <button
                    onClick={() => onInterestBack(interest.user_id)}
                    disabled={sendingInterest === interest.user_id}
                    className="shrink-0 flex items-center gap-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    {sendingInterest === interest.user_id ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Heart className="w-3.5 h-3.5" />
                        Like Back
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => handleVideoChat(interest.user_id)}
                    className="shrink-0 flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    Video Chat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IncomingInterests;
