import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Heart, DollarSign, Sparkles, Link2, Video, MessageCircle, Gift, Crown, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isOnlineNow, isNewListing, getTimeAgo, isFakeOnline } from "@/hooks/useDiscover";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useVipStatus } from "@/hooks/useVipStatus";
import VipCallGate, { shouldBlockCall } from "./VipCallGate";

import PinnedSocialsDisplay from "../videocall/PinnedSocialsDisplay";
import DirectCallModal from "./DirectCallModal";
import DiscoverGiftModal from "./DiscoverGiftModal";

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
  isOwner?: boolean;
  isVip?: boolean;
  isModerator?: boolean;
  isSelf?: boolean;
}

const DiscoverMemberCard = ({
  member,
  alreadyInterested,
  isMutualMatch,
  sendingInterest,
  mutualSocials,
  onInterest,
  myGender,
  isOwner,
  isVip,
  isModerator,
  isSelf,
}: DiscoverMemberCardProps) => {
  const [showSocials, setShowSocials] = useState(false);
  const [directCall, setDirectCall] = useState<{ inviteId: string } | null>(null);
  const [showGift, setShowGift] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showVipGate, setShowVipGate] = useState(false);
  const { user } = useAuth();
  const { vipTier, startCheckout } = useVipStatus(user?.id ?? null);
  const navigate = useNavigate();
  const realOnline = isOnlineNow(member.last_active_at);
  const isNew = isNewListing(member.created_at);
  const isFemale = member.gender?.toLowerCase() === "female";
  const online = realOnline || (!isSelf && isFakeOnline(member.id, member.gender));

  // Track profile view (fire-and-forget, once per mount)
  const viewTracked = useRef(false);
  useEffect(() => {
    if (user && !isSelf && member.id && !viewTracked.current) {
      viewTracked.current = true;
      supabase.from("discover_profile_views").insert({
        viewer_id: user.id,
        viewed_member_id: member.id,
      } as any).then(() => {});
    }
  }, [user, isSelf, member.id]);

  const handleVideoChat = async () => {
    if (!user) return;
    // Block non-premium males from calling females
    if (shouldBlockCall(myGender, member.gender, vipTier)) {
      setShowVipGate(true);
      return;
    }
    try {
      const { data, error } = await supabase.from("direct_call_invites").insert({
        inviter_id: user.id,
        invitee_id: member.id,
      } as any).select("id").single();

      if (error) throw error;

      setDirectCall({ inviteId: data.id });
      toast({ title: "📹 Starting video chat", description: `Calling ${member.name}...` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const openFullImage = () => {
    if (member.image_url) setShowFullImage(true);
  };

  return (
    <>
      <div
        className={`relative group rounded-xl overflow-hidden bg-white/5 border ${isSelf ? "border-cyan-500/50 ring-1 ring-cyan-500/30" : isOwner ? "border-amber-500/50 ring-1 ring-amber-500/30" : "border-white/10"} hover:border-white/20 transition-colors ${member.image_url ? "cursor-pointer" : ""}`}
        onClick={openFullImage}
      >
        {/* Badges */}
        <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-10 flex flex-col gap-0.5 sm:gap-1">
          {online && (
            <span className="flex items-center gap-0.5 bg-emerald-500/90 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white animate-pulse" />
              Online
            </span>
          )}
          {isNew && (
            <span className="flex items-center gap-0.5 bg-amber-500/90 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              New
            </span>
          )}
          {isMutualMatch && (
            <span className="flex items-center gap-0.5 bg-pink-500/90 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full backdrop-blur-sm">
              💕 Match!
            </span>
          )}
          {isOwner && (
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
              <Crown className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Owner
            </span>
          )}
          {isVip && !isOwner && (
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
              <Sparkles className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              VIP
            </span>
          )}
          {isModerator && !isOwner && (
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
              <Shield className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
              Mod
            </span>
          )}
          {isSelf && (
            <span className="flex items-center gap-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-[8px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
              👤 You
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
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 sm:p-3 pt-10 sm:pt-12">
          {member.bio && (
            <p className="text-white/70 text-[10px] sm:text-[11px] mb-1 sm:mb-1.5 line-clamp-2 italic">"{member.bio}"</p>
          )}

          <div className="min-w-0 mb-1.5 sm:mb-2">
            <p className="font-bold text-white text-xs sm:text-sm truncate">
              {member.name}
              {isOwner && <Crown className="inline w-3 h-3 sm:w-3.5 sm:h-3.5 ml-1 text-amber-400" />}
            </p>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {member.country && (
                <span className="text-white/50 text-[10px] sm:text-xs">{member.country}</span>
              )}
              <span className={`text-[10px] sm:text-xs ${online ? "text-emerald-400" : "text-white/40"}`}>
                {online ? "Online" : getTimeAgo(member.last_active_at)}
              </span>
            </div>
            {isFemale && (
              <div className="flex items-center gap-1 mt-0.5 text-emerald-400 text-[10px] sm:text-xs">
                <DollarSign className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                <span>Earns by chatting</span>
              </div>
            )}
          </div>

          {!isSelf && (
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Video Chat */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                void handleVideoChat();
              }}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-emerald-500/80 hover:bg-emerald-500 text-white transition-all"
              title="Request Video Chat"
            >
              <Video className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            {/* DM */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/messages?to=${member.id}`);
              }}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-blue-500/80 hover:bg-blue-500 text-white transition-all"
              title="Send Message"
            >
              <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            {/* Socials */}
            {mutualSocials && mutualSocials.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSocials(!showSocials);
                }}
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-purple-500/80 hover:bg-purple-500 text-white transition-all"
                title="View socials"
              >
                <Link2 className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
            )}

            {/* Gift */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowGift(true);
              }}
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center bg-amber-500/80 hover:bg-amber-500 text-white transition-all"
              title="Gift Minutes"
            >
              <Gift className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>

            {/* Heart */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!alreadyInterested) onInterest(member.id);
              }}
              disabled={alreadyInterested || sendingInterest}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                alreadyInterested
                  ? "bg-pink-500 text-white"
                  : "bg-white/15 hover:bg-pink-500 text-white/70 hover:text-white"
              }`}
            >
              {sendingInterest ? (
                <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Heart className={`w-3 h-3 sm:w-4 sm:h-4 ${alreadyInterested ? "fill-current" : ""}`} />
              )}
            </button>
          </div>
          )}

          {/* Socials reveal */}
          {showSocials && mutualSocials && (
            <div
              className="mt-2"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <PinnedSocialsDisplay pinnedSocials={mutualSocials} />
            </div>
          )}
        </div>
      </div>

      {/* Direct call modal */}
      {directCall && user && (
        <DirectCallModal
          myUserId={user.id}
          partnerId={member.id}
          partnerName={member.name}
          inviteId={directCall.inviteId}
          isInitiator={true}
          onClose={() => setDirectCall(null)}
        />
      )}

      {/* Gift modal */}
      {showGift && (
        <DiscoverGiftModal
          recipientId={member.id}
          recipientName={member.name}
          onClose={() => setShowGift(false)}
        />
      )}

      {/* VIP call gate modal */}
      {showVipGate && (
        <VipCallGate
          onClose={() => setShowVipGate(false)}
          onSubscribe={async () => {
            setShowVipGate(false);
            const { VIP_TIERS } = await import("@/config/vip-tiers");
            void startCheckout(VIP_TIERS.premium.price_id);
          }}
        />
      )}

      {/* Full image viewer */}
      {showFullImage && member.image_url && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFullImage(false);
          }}
        >
          <button
            onClick={() => setShowFullImage(false)}
            className="absolute top-4 right-4 z-[101] bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <div className="relative max-w-md w-full rounded-2xl overflow-hidden bg-black/80 border border-white/10">
            <img
              src={member.image_url}
              alt={member.name}
              className="w-full max-h-[70vh] object-contain"
            />
            <div className="p-4 text-center">
              <p className="text-white font-bold text-lg">{member.name}</p>
              {member.country && <p className="text-white/50 text-sm">{member.country}</p>}
              {member.bio && (
                <p className="text-white/70 text-sm mt-1.5 italic">"{member.bio}"</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default DiscoverMemberCard;
