import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
import BannedScreen from "@/components/BannedScreen";
import { useCallMinutes } from "@/hooks/useCallMinutes";
import { useAdPoints } from "@/hooks/useAdPoints";
import CapReachedPopup from "@/components/videocall/CapReachedPopup";
import RedeemPanel from "@/components/videocall/RedeemPanel";
import NavIcon from "@/components/videocall/NavIcon";
import FullScreenOverlay from "@/components/videocall/FullScreenOverlay";
import RewardStorePage from "@/pages/public/RewardStorePage";
import ProfilePage from "@/pages/public/ProfilePage";
import PinTopicsOverlay from "@/components/videocall/PinTopicsOverlay";
import PromoPanel from "@/components/videocall/PromoPanel";
import PromoAdOverlay from "@/components/videocall/PromoAdOverlay";
import VipFeaturesOverlay from "@/components/videocall/VipFeaturesOverlay";
import MinutesFrozenPopup from "@/components/videocall/MinutesFrozenPopup";
import VipSettingsOverlay from "@/components/videocall/VipSettingsOverlay";
import SendGiftOverlay from "@/components/videocall/SendGiftOverlay";
import PinnedSocialsDisplay from "@/components/videocall/PinnedSocialsDisplay";
import ReportUserOverlay from "@/components/videocall/ReportUserOverlay";
import { useVipStatus } from "@/hooks/useVipStatus";
import { toast } from "sonner";

import c24Logo from "@/assets/videocall/c24-logo.png";
import nextBtn from "@/assets/videocall/next-btn.png";
import storeIcon from "@/assets/videocall/store.png";
import redeemIcon from "@/assets/videocall/redeem.png";
import topicsIcon from "@/assets/videocall/topics-bubble.png";
import promoIcon from "@/assets/videocall/promo-star.png";
import profileIcon from "@/assets/videocall/profile-avatar.png";
import vipIcon from "@/assets/videocall/vip-rocket.png";
import giftIcon from "@/assets/videocall/gift-icon.svg";
import reportIconImg from "@/assets/videocall/report-icon.png";

type GenderFilter = "girls" | "both" | "guys";

const genderMap: Record<GenderFilter, string> = {
  girls: "Female",
  both: "Both",
  guys: "Male",
};

const VideoCallPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading, banInfo, recheckBan } = useAuth();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("both");
  const [showRedeem, setShowRedeem] = useState(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [showReportOverlay, setShowReportOverlay] = useState(false);
  
  const [showPromoAd, setShowPromoAd] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"store" | "profile" | "topics" | "promo" | "vip" | "vip-settings" | null>(null);
  const memberId = user?.id ?? "anonymous";

  const {
    callState,
    error,
    currentPartnerId,
    localVideoRef,
    remoteVideoRef,
    startCall,
    next,
    stop,
  } = useWebRTC({
    memberId,
    genderPreference: genderMap[genderFilter],
  });

  const {
    totalMinutes,
    elapsedSeconds,
    showCapPopup,
    capInfo,
    dismissCapPopup,
    flushMinutes,
    freezeInfo,
  } = useCallMinutes({
    userId: memberId,
    partnerId: currentPartnerId,
    isConnected: callState === "connected",
  });

  const [showFrozenPopup, setShowFrozenPopup] = useState(false);
  const frozenPopupShownRef = useRef(false);

  // Show frozen popup once when freeze is detected
  useEffect(() => {
    if (freezeInfo.isFrozen && !frozenPopupShownRef.current) {
      const snoozedUntil = localStorage.getItem("freeze_popup_snoozed_until");
      if (snoozedUntil && Date.now() < Number(snoozedUntil)) return;
      frozenPopupShownRef.current = true;
      setShowFrozenPopup(true);
    }
  }, [freezeInfo.isFrozen]);

  const { adPoints, awardAdPoints, refreshBalance } = useAdPoints({
    userId: memberId,
    isConnected: callState === "connected",
    elapsedSeconds,
  });

  const { vipTier, subscribed, startCheckout, openPortal, checkSubscription } = useVipStatus(user?.id ?? null);

  // Reset gender filter if not VIP
  useEffect(() => {
    if (!subscribed && genderFilter !== "both") {
      setGenderFilter("both");
    }
  }, [subscribed, genderFilter]);

  const isMobile = useIsMobile();

  const fetchPinnedTopics = async (userId: string) => {
    const { data: pins } = await supabase
      .from("pinned_topics")
      .select("topic_id")
      .eq("user_id", userId);
    if (!pins || pins.length === 0) return [];
    const topicIds = pins.map((p) => p.topic_id);
    const { data: topics } = await supabase
      .from("topics")
      .select("id, name")
      .in("id", topicIds);
    return topics || [];
  };

  const { data: pinnedTopics = [] } = useQuery({
    queryKey: ["my_pinned_topics", memberId],
    enabled: memberId !== "anonymous",
    queryFn: () => fetchPinnedTopics(memberId),
  });

  const { data: partnerPinnedTopics = [] } = useQuery({
    queryKey: ["partner_pinned_topics", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: () => fetchPinnedTopics(currentPartnerId!),
  });

  // Check if partner is VIP (gift icon shows for all VIP users)
  const { data: partnerGiftEnabled } = useQuery({
    queryKey: ["partner_is_vip", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("is_vip")
        .eq("user_id", currentPartnerId!)
        .maybeSingle();
      return mm?.is_vip ?? false;
    },
  });

  // Fetch partner's pinned socials
  const { data: partnerPinnedSocials = [] } = useQuery({
    queryKey: ["partner_pinned_socials", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      const { data } = await supabase
        .from("vip_settings")
        .select("pinned_socials")
        .eq("user_id", currentPartnerId!)
        .maybeSingle();
      return (data?.pinned_socials as string[]) ?? [];
    },
  });

  // Check for unban/checkout/gift success in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("unban") === "success" && banInfo) {
      recheckBan();
      window.history.replaceState({}, "", "/videocall");
    }
    if (params.get("checkout") === "success") {
      checkSubscription();
      window.history.replaceState({}, "", "/videocall");
    }
    if (params.get("unfreeze") === "success") {
      supabase.functions.invoke("unfreeze-purchase", { body: { action: "apply" } });
      window.history.replaceState({}, "", "/videocall");
    }
    if (params.get("gift") === "success") {
      const sessionId = params.get("session_id");
      if (sessionId) {
        supabase.functions.invoke("gift-minutes", {
          body: { action: "verify", session_id: sessionId },
        }).then(({ data }) => {
          if (data?.success) {
            toast.success(`Gift sent! ${data.minutes_gifted} minutes gifted.${data.sender_bonus > 0 ? ` You got +${data.sender_bonus} minutes bonus!` : ""}`);
          }
        });
      }
      window.history.replaceState({}, "", "/videocall");
    }
  }, [banInfo, recheckBan, checkSubscription]);

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  if (!loading && banInfo) {
    return <BannedScreen reason={banInfo.reason} banType={banInfo.ban_type} createdAt={banInfo.created_at} />;
  }

  const isActive = callState !== "idle";
  const timerMin = Math.floor(elapsedSeconds / 60);
  const timerSec = elapsedSeconds % 60;
  const timerDisplay = `${String(timerMin).padStart(2, "0")}:${String(timerSec).padStart(2, "0")}`;

  const handleStart = () => startCall();
  const handleNext = async () => {
    // Award ad points for this call before moving to next
    await awardAdPoints(elapsedSeconds);
    await flushMinutes();
    next();
    // Show a promo ad between skips
    setShowPromoAd(true);
  };
  const handleBack = () => {
    awardAdPoints(elapsedSeconds).catch(() => {});
    flushMinutes().catch(() => {});
    stop().catch(() => {});
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="p-1 hover:bg-white/10 rounded-full transition-colors"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-1.5 text-2xl font-black">
            <span>⏱️</span>
            {freezeInfo.isFrozen ? (
              <span className="text-blue-300">🥶 {totalMinutes} Frozen</span>
            ) : (
              <span>{totalMinutes} Minutes</span>
            )}
          </div>
          <div className="flex items-center justify-end gap-1 text-sm text-yellow-400 font-bold">
            <span>⭐</span>
            <span>{adPoints} Ad Points</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mx-4 mb-2 px-4 py-2 bg-red-900/60 border border-red-700 rounded-lg text-sm text-center">
          {error}
        </div>
      )}

      {/* Video Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 mx-3 mb-2 min-h-0">
        {/* Local Video */}
        <div className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
          {!isActive && (
            <div className="flex flex-col items-center gap-3">
              <img src={c24Logo} alt="C24 Club" className="w-48 md:w-56 drop-shadow-lg" />
              <p className="text-[10px] text-neutral-400 -mt-1">The Omegle That Rewards You!</p>
              <button onClick={handleStart} className="bg-red-600 hover:bg-red-700 text-white font-black text-xl px-10 py-2.5 rounded-lg transition-colors shadow-lg">
                START
              </button>
              <span className="text-neutral-500 text-[10px] tracking-wide font-bold">C24CLUB.COM</span>
            </div>
          )}

          <video ref={localVideoRef} autoPlay muted playsInline
            className={`absolute inset-0 w-full h-full object-cover ${isActive ? "block" : "hidden"}`} />

          {/* Promo Ad - shown inside local video box between skips */}
          {showPromoAd && (
            <PromoAdOverlay
              viewerId={memberId}
              onDismiss={() => setShowPromoAd(false)}
            />
          )}
          {callState === "connected" && (
            <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-mono font-bold">{timerDisplay}</span>
            </div>
          )}

          {isActive && (
            <button onClick={stop} className="absolute top-2 left-2 z-20 bg-black/60 hover:bg-red-600 backdrop-blur-sm rounded-full p-1.5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}

          <div className="md:hidden absolute inset-0 bg-black/60 flex items-center justify-center z-10" style={{ display: callState === "waiting" ? "flex" : "none" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-neutral-300">Finding a partner...</p>
            </div>
          </div>

          {/* Report button - mobile, on local video top-right area below partner overlay */}
          {callState === "connected" && currentPartnerId && isMobile && (
            <button
              onClick={() => setShowReportOverlay(true)}
              className="absolute top-2 left-2 z-20 w-8 h-8 rounded-full overflow-hidden hover:scale-110 transition-transform shadow-lg"
              title="Report User"
            >
              <img src={reportIconImg} alt="Report" className="w-full h-full object-cover" />
            </button>
          )}

          {/* Gift icon - shows when partner is VIP */}
          {callState === "connected" && partnerGiftEnabled && currentPartnerId && (
            <button
              onClick={() => setShowGiftOverlay(true)}
              className="absolute bottom-3 left-3 z-20 animate-bounce"
            >
              <img src={giftIcon} alt="Send Gift" className="w-12 h-12 drop-shadow-lg" />
            </button>
          )}

          {isActive && (
            <button onClick={handleNext} className="md:hidden absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors z-20">
              <span className="font-bold text-sm">NEXT</span>
              <img src={nextBtn} alt="Next" className="w-9 h-9" />
            </button>
          )}

          {isMobile && (
            <div className="absolute top-2 right-2 z-10 w-[30%] aspect-[3/4] rounded-lg border border-neutral-600 bg-neutral-800 overflow-hidden shadow-xl">
              <video ref={remoteVideoRef} autoPlay playsInline
                className={`w-full h-full object-cover ${callState === "connected" ? "block" : "hidden"}`} />
              {callState !== "connected" && (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-neutral-600 text-[10px] text-center px-1">
                    {callState === "connecting" ? "Connecting..." : callState === "waiting" ? "Searching..." : ""}
                  </p>
                </div>
              )}
              {partnerPinnedTopics.length > 0 && callState === "connected" && (
                <div className="absolute bottom-1 left-1 z-20 flex flex-wrap gap-1 max-w-[90%]">
                  {partnerPinnedTopics.map((topic: { id: string; name: string }) => (
                    <span key={topic.id} className="bg-blue-600/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                      📌 {topic.name}
                    </span>
                  ))}
                </div>
              )}
              {partnerPinnedSocials.length > 0 && callState === "connected" && (
                <div className="absolute top-1 left-1 z-20">
                  <PinnedSocialsDisplay pinnedSocials={partnerPinnedSocials} />
                </div>
              )}
            </div>
          )}

          {pinnedTopics.length > 0 && isActive && (
            <div className="absolute bottom-2 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
              {pinnedTopics.map((topic: { id: string; name: string }) => (
                <span key={topic.id} className="bg-red-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                  📌 {topic.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Partner Video - desktop */}
        {!isMobile && (
          <div className="flex flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden items-center justify-center">
            <video ref={remoteVideoRef} autoPlay playsInline
              className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" ? "block" : "hidden"}`} />
            {callState !== "connected" && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-neutral-400 text-sm">
                  {callState === "waiting" ? "Finding a partner..." : callState === "connecting" ? "Connecting..." : "Waiting to start..."}
                </p>
              </div>
            )}
            {partnerPinnedTopics.length > 0 && callState === "connected" && (
              <div className="absolute bottom-2 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
                {partnerPinnedTopics.map((topic: { id: string; name: string }) => (
                  <span key={topic.id} className="bg-blue-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                    📌 {topic.name}
                  </span>
                ))}
              </div>
            )}
            {partnerPinnedSocials.length > 0 && callState === "connected" && (
              <div className="absolute top-2 right-2 z-20">
                <PinnedSocialsDisplay pinnedSocials={partnerPinnedSocials} />
              </div>
            )}
            {callState === "connected" && currentPartnerId && (
              <button
                onClick={() => setShowReportOverlay(true)}
                className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full overflow-hidden hover:scale-110 transition-transform shadow-lg"
                title="Report User"
              >
                <img src={reportIconImg} alt="Report" className="w-full h-full object-cover" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* NEXT Button - desktop */}
      {isActive && (
        <div className="hidden md:flex justify-center mb-4">
          <button onClick={handleNext} className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg px-6 py-2 transition-colors">
            <span className="font-bold">NEXT</span>
            <img src={nextBtn} alt="Next" className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Panels */}
      {showRedeem ? (
        <div className="px-3 pb-4">
          <RedeemPanel totalMinutes={totalMinutes} onClose={() => setShowRedeem(false)} />
        </div>
      ) : (
        <>
          <div className="flex justify-center gap-8 px-4 pt-2 pb-3">
            <NavIcon src={storeIcon} label="STORE" onClick={() => isActive ? setOverlayPage("store") : navigate("/store")} />
            <NavIcon src={redeemIcon} label="REDEEM" onClick={() => setShowRedeem(true)} highlight />
            <NavIcon src={topicsIcon} label="TOPICS" onClick={() => setOverlayPage("topics")} />
          </div>
          <div className="flex justify-center gap-8 px-4 pb-4">
            <NavIcon src={promoIcon} label="PROMO" onClick={() => setOverlayPage("promo" as any)} />
            <NavIcon src={profileIcon} label="PROFILE" onClick={() => isActive ? setOverlayPage("profile") : navigate("/profile")} />
            <NavIcon src={vipIcon} label={subscribed ? "VIP ✓" : "VIP"} onClick={() => setOverlayPage("vip" as any)} />
          </div>
          <div className="flex justify-center items-center gap-8 pb-6 text-sm font-bold tracking-wider">
            <button onClick={() => {
              if (!subscribed) { setOverlayPage("vip"); return; }
              setGenderFilter("girls");
            }} className={`uppercase transition-colors ${genderFilter === "girls" ? "text-yellow-400" : "text-neutral-400 hover:text-white"}`}>
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">CONNECT TO</span>GIRLS
              {!subscribed && <span className="text-[8px] block text-yellow-500 mt-0.5">🔒 VIP</span>}
            </button>
            <button onClick={() => setGenderFilter("both")} className={`uppercase transition-colors text-lg ${genderFilter === "both" ? "text-white font-extrabold" : "text-neutral-400 hover:text-white"}`}>
              BOTH
            </button>
            <button onClick={() => {
              if (!subscribed) { setOverlayPage("vip"); return; }
              setGenderFilter("guys");
            }} className={`uppercase transition-colors ${genderFilter === "guys" ? "text-yellow-400" : "text-neutral-400 hover:text-white"}`}>
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">CONNECT TO</span>GUYS
              {!subscribed && <span className="text-[8px] block text-yellow-500 mt-0.5">🔒 VIP</span>}
            </button>
          </div>
        </>
      )}

      {/* Full-screen overlay pages */}
      {overlayPage === "store" && (
        <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <RewardStorePage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      )}
      {overlayPage === "profile" && (
        <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <ProfilePage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      )}
      {overlayPage === "promo" && (
        <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <PromoPanel
            userId={memberId}
            adPoints={adPoints}
            onClose={() => setOverlayPage(null)}
            onAdPointsChange={refreshBalance}
          />
        </FullScreenOverlay>
      )}
      {overlayPage === "topics" && (
        <PinTopicsOverlay userId={memberId} onClose={() => { setOverlayPage(null); queryClient.invalidateQueries({ queryKey: ["my_pinned_topics"] }); }} />
      )}
      {overlayPage === "vip" && (
        <VipFeaturesOverlay
          onClose={() => setOverlayPage(null)}
          currentTier={vipTier}
          onPurchase={startCheckout}
          onManage={() => { setOverlayPage("vip-settings"); return Promise.resolve(); }}
        />
      )}
      {overlayPage === "vip-settings" && (
        <VipSettingsOverlay
          onClose={() => setOverlayPage(null)}
          userId={memberId}
          vipTier={vipTier}
          genderFilter={genderFilter}
          onGenderFilterChange={(g) => setGenderFilter(g as GenderFilter)}
        />
      )}

      {/* Cap Reached Popup */}
      {showCapPopup && capInfo && (
        <CapReachedPopup isVip={capInfo.isVip} cap={capInfo.cap} onDismiss={dismissCapPopup} />
      )}

      {/* Minutes Frozen Popup */}
      {showFrozenPopup && (
        <MinutesFrozenPopup
          onDismiss={() => setShowFrozenPopup(false)}
          onSnooze={() => {
            localStorage.setItem("freeze_popup_snoozed_until", String(Date.now() + 24 * 60 * 60 * 1000));
            setShowFrozenPopup(false);
          }}
          onGoToChallenges={() => {
            setShowFrozenPopup(false);
            setOverlayPage("profile");
          }}
          isVip={subscribed}
          onPurchaseVip={startCheckout}
        />
      )}

      {/* Send Gift Overlay */}
      {showGiftOverlay && currentPartnerId && (
        <SendGiftOverlay
          recipientId={currentPartnerId}
          onClose={() => setShowGiftOverlay(false)}
        />
      )}

      {/* Report User Overlay */}
      {showReportOverlay && currentPartnerId && (
        <ReportUserOverlay
          reporterId={memberId}
          reportedUserId={currentPartnerId}
          onClose={() => setShowReportOverlay(false)}
        />
      )}
    </div>
  );
};

export default VideoCallPage;
