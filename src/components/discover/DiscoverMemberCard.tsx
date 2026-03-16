import { useState } from "react";
import { Heart, DollarSign, Sparkles, MessageCircle, Link2, Video } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isOnlineNow, isNewListing, getTimeAgo } from "@/hooks/useDiscover";
import { toast } from "@/hooks/use-toast";
import IcebreakerPicker from "./IcebreakerPicker";

interface DiscoverMemberCardProps {
  member: {
    id: string;
    name: string;
    image_url: string | null;
    gender: string | null;
    country: string | null;
    last_active_at: string | null;
    bio: string | null;
    created_at: string;
  };
  alreadyInterested: boolean;
  isMutualMatch: boolean;
  sendingInterest: boolean;
  mutualSocials: string[] | undefined;
  onInterest: (id: string, icebreaker?: string) => void;
  myGender: string | null;
}

const DiscoverMemberCard = ({
  member,
  alreadyInterested,
  isMutualMatch,
  sendingInterest,
  mutualSocials,
  onInterest,
  myGender,
}: DiscoverMemberCardProps) => {
  const [showIcebreaker, setShowIcebreaker] = useState(false);
  const [showSocials, setShowSocials] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = isOnlineNow(member.last_active_at);
  const isNew = isNewListing(member.created_at);
  const isFemale = member.gender?.toLowerCase() === "female";

  const handleVideoChat = async () => {
    if (!user) return;
    try {
      await supabase.from("direct_call_invites").insert({
        inviter_id: user.id,
        invitee_id: member.id,
      } as any);
      navigate("/video-call");
      toast({ title: "📹 Starting video chat", description: "Join the call — we'll connect you when your match joins!" });
    } catch {
      navigate("/video-call");
    }
  };

  const handleIcebreakerSend = (message: string) => {
    setShowIcebreaker(false);
    onInterest(member.id, message);
  };

  return (
    <>
      <div className="relative group rounded-xl overflow-hidden bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
        {/* Badges */}
        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {online && (
            <span className="flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Online
            </span>
          )}
          {isNew && (
            <span className="flex items-center gap-1 bg-amber-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              <Sparkles className="w-2.5 h-2.5" />
              New
            </span>
          )}
          {isMutualMatch && (
            <span className="flex items-center gap-1 bg-pink-500/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm">
              💕 Match!
            </span>
          )}
        </div>

        {/* Photo */}
        <div className="aspect-[3/4] overflow-hidden">
          {member.image_url ? (
            <img
              src={member.image_url}
              alt={member.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 text-4xl font-bold">
              {member.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Info overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-12">
          {/* Bio */}
          {member.bio && (
            <p className="text-white/70 text-[11px] mb-1.5 line-clamp-2 italic">"{member.bio}"</p>
          )}

          <div className="flex items-end justify-between gap-1">
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate">{member.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {member.country && (
                  <span className="text-white/50 text-xs">{member.country}</span>
                )}
                <span className={`text-xs ${online ? "text-emerald-400" : "text-white/40"}`}>
                  {online ? "Online now" : getTimeAgo(member.last_active_at)}
                </span>
              </div>
              {isFemale && (
                <div className="flex items-center gap-1 mt-1 text-emerald-400 text-xs">
                  <DollarSign className="w-3 h-3" />
                  <span>Earns by chatting</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 shrink-0">
              {/* Video Chat button for mutual matches */}
              {isMutualMatch && (
                <button
                  onClick={handleVideoChat}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-500/80 hover:bg-emerald-500 text-white transition-all"
                  title="Video Chat"
                >
                  <Video className="w-4 h-4" />
                </button>
              )}

              {/* Mutual match socials button */}
              {isMutualMatch && mutualSocials && mutualSocials.length > 0 && (
                <button
                  onClick={() => setShowSocials(!showSocials)}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-purple-500/80 hover:bg-purple-500 text-white transition-all"
                  title="View socials"
                >
                  <Link2 className="w-4 h-4" />
                </button>
              )}

              {/* Icebreaker button (only if not already interested) */}
              {!alreadyInterested && (
                <button
                  onClick={() => setShowIcebreaker(true)}
                  className="w-9 h-9 rounded-full flex items-center justify-center bg-white/10 hover:bg-blue-500/80 text-white/60 hover:text-white transition-all"
                  title="Send a message"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              )}

              {/* Heart button */}
              <button
                onClick={() => !alreadyInterested && onInterest(member.id)}
                disabled={alreadyInterested || sendingInterest}
                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                  alreadyInterested
                    ? "bg-pink-500 text-white"
                    : "bg-white/15 hover:bg-pink-500 text-white/70 hover:text-white"
                }`}
              >
                {sendingInterest ? (
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Heart className={`w-4 h-4 ${alreadyInterested ? "fill-current" : ""}`} />
                )}
              </button>
            </div>
          </div>

          {/* Socials reveal (mutual match) */}
          {showSocials && mutualSocials && (
            <div className="mt-2 p-2 rounded-lg bg-purple-500/20 border border-purple-500/30">
              <p className="text-purple-300 text-[10px] font-bold mb-1">🔗 Their Socials</p>
              <div className="flex flex-wrap gap-1">
                {mutualSocials.map((social, i) => (
                  <span key={i} className="text-white text-[11px] bg-white/10 px-2 py-0.5 rounded-full">{social}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Icebreaker modal */}
      {showIcebreaker && (
        <IcebreakerPicker
          memberName={member.name}
          onSend={handleIcebreakerSend}
          onClose={() => setShowIcebreaker(false)}
        />
      )}
    </>
  );
};

export default DiscoverMemberCard;
