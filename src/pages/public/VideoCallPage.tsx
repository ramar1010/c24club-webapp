import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
import { useCallMinutes } from "@/hooks/useCallMinutes";
import CapReachedPopup from "@/components/videocall/CapReachedPopup";
import RedeemPanel from "@/components/videocall/RedeemPanel";
import NavIcon from "@/components/videocall/NavIcon";
import FullScreenOverlay from "@/components/videocall/FullScreenOverlay";
import RewardStorePage from "@/pages/public/RewardStorePage";
import ProfilePage from "@/pages/public/ProfilePage";
import PinTopicsOverlay from "@/components/videocall/PinTopicsOverlay";

import c24Logo from "@/assets/videocall/c24-logo.png";
import nextBtn from "@/assets/videocall/next-btn.png";
import storeIcon from "@/assets/videocall/store.png";
import redeemIcon from "@/assets/videocall/redeem.png";
import topicsIcon from "@/assets/videocall/topics-bubble.png";
import promoIcon from "@/assets/videocall/promo-star.png";
import profileIcon from "@/assets/videocall/profile-avatar.png";
import vipIcon from "@/assets/videocall/vip-rocket.png";

type GenderFilter = "girls" | "both" | "guys";

const genderMap: Record<GenderFilter, string> = {
  girls: "Female",
  both: "Both",
  guys: "Male",
};

const VideoCallPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("both");
  const [adPoints] = useState(40);
  const [showRedeem, setShowRedeem] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"store" | "profile" | "topics" | null>(null);
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
  } = useCallMinutes({
    userId: memberId,
    partnerId: currentPartnerId,
    isConnected: callState === "connected",
  });

  const isMobile = useIsMobile();

  const { data: pinnedTopics = [] } = useQuery({
    queryKey: ["my_pinned_topics", memberId],
    enabled: memberId !== "anonymous",
    queryFn: async () => {
      const { data: pins } = await supabase
        .from("pinned_topics")
        .select("topic_id")
        .eq("user_id", memberId);
      if (!pins || pins.length === 0) return [];
      const topicIds = pins.map((p) => p.topic_id);
      const { data: topics } = await supabase
        .from("topics")
        .select("id, name")
        .in("id", topicIds);
      return topics || [];
    },
  });

  if (!loading && !user) {
    return <Navigate to="/" replace />;
  }

  const isActive = callState !== "idle";
  const timerMin = Math.floor(elapsedSeconds / 60);
  const timerSec = elapsedSeconds % 60;
  const timerDisplay = `${String(timerMin).padStart(2, "0")}:${String(timerSec).padStart(2, "0")}`;

  const handleStart = () => startCall();
  const handleNext = async () => {
    await flushMinutes();
    next();
  };
  const handleBack = () => {
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
            <span>{totalMinutes} Minutes</span>
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

      {/* Video Area - Desktop: side by side, Mobile: overlay */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 mx-3 mb-2 min-h-0">
        {/* Local Video */}
        <div className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
          {!isActive && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={c24Logo}
                alt="C24 Club"
                className="w-48 md:w-56 drop-shadow-lg"
              />
              <p className="text-[10px] text-neutral-400 -mt-1">
                The Omegle That Rewards You!
              </p>
              <button
                onClick={handleStart}
                className="bg-red-600 hover:bg-red-700 text-white font-black text-xl px-10 py-2.5 rounded-lg transition-colors shadow-lg"
              >
                START
              </button>
              <span className="text-neutral-500 text-[10px] tracking-wide font-bold">
                C24CLUB.COM
              </span>
            </div>
          )}

          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={`absolute inset-0 w-full h-full object-cover ${isActive ? "block" : "hidden"}`}
          />

          {/* Call timer */}
          {callState === "connected" && (
            <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-mono font-bold">{timerDisplay}</span>
            </div>
          )}

          {/* X button to leave call */}
          {isActive && (
            <button
              onClick={stop}
              className="absolute top-2 left-2 z-20 bg-black/60 hover:bg-red-600 backdrop-blur-sm rounded-full p-1.5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {/* Waiting overlay - mobile only (desktop shows in partner box) */}
          <div className="md:hidden absolute inset-0 bg-black/60 flex items-center justify-center z-10" style={{ display: callState === "waiting" ? "flex" : "none" }}>
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm text-neutral-300">Finding a partner...</p>
            </div>
          </div>

          {/* NEXT Button - mobile only, shown only during active call */}
          {isActive && (
            <button
              onClick={handleNext}
              className="md:hidden absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors z-20"
            >
              <span className="font-bold text-sm">NEXT</span>
              <img src={nextBtn} alt="Next" className="w-9 h-9" />
            </button>
          )}

          {/* Partner overlay - mobile only */}
          {isMobile && (
            <div className="absolute top-2 right-2 z-10 w-[30%] aspect-[3/4] rounded-lg border border-neutral-600 bg-neutral-800 overflow-hidden shadow-xl">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${callState === "connected" ? "block" : "hidden"}`}
              />
              {callState !== "connected" && (
                <div className="w-full h-full flex items-center justify-center">
                  <p className="text-neutral-600 text-[10px] text-center px-1">
                    {callState === "connecting" ? "Connecting..." : callState === "waiting" ? "Searching..." : ""}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Pinned Topics - bottom of local video */}
          {pinnedTopics.length > 0 && isActive && (
            <div className="absolute bottom-2 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
              {pinnedTopics.map((topic: { id: string; name: string }) => (
                <span
                  key={topic.id}
                  className="bg-red-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg"
                >
                  📌 {topic.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Partner Video - desktop only */}
        {!isMobile && (
          <div className="flex flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden items-center justify-center">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" ? "block" : "hidden"}`}
            />
            {callState !== "connected" && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-neutral-400 text-sm">
                  {callState === "waiting" ? "Finding a partner..." : callState === "connecting" ? "Connecting..." : "Waiting to start..."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* NEXT Button - desktop only, shown only during active call */}
      {isActive && (
        <div className="hidden md:flex justify-center mb-4">
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg px-6 py-2 transition-colors"
          >
            <span className="font-bold">NEXT</span>
            <img src={nextBtn} alt="Next" className="w-8 h-8" />
          </button>
        </div>
      )}

      {/* Redeem Panel or Nav */}
      {showRedeem ? (
        <div className="px-3 pb-4">
          <RedeemPanel
            totalMinutes={totalMinutes}
            onClose={() => setShowRedeem(false)}
          />
        </div>
      ) : (
        <>
          {/* Quick Nav Icons - Row 1 */}
          <div className="flex justify-center gap-8 px-4 pt-2 pb-3">
            <NavIcon src={storeIcon} label="STORE" onClick={() => isActive ? setOverlayPage("store") : navigate("/store")} />
            <NavIcon
              src={redeemIcon}
              label="REDEEM"
              onClick={() => setShowRedeem(true)}
              highlight
            />
            <NavIcon src={topicsIcon} label="TOPICS" onClick={() => setOverlayPage("topics")} />
          </div>

          {/* Quick Nav Icons - Row 2 */}
          <div className="flex justify-center gap-8 px-4 pb-4">
            <NavIcon src={promoIcon} label="PROMO" />
            <NavIcon src={profileIcon} label="PROFILE" onClick={() => isActive ? setOverlayPage("profile") : navigate("/profile")} />
            <NavIcon src={vipIcon} label="VIP" />
          </div>

          {/* Gender Filter */}
          <div className="flex justify-center items-center gap-8 pb-6 text-sm font-bold tracking-wider">
            <button
              onClick={() => setGenderFilter("girls")}
              className={`uppercase transition-colors ${
                genderFilter === "girls"
                  ? "text-yellow-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">
                CONNECT TO
              </span>
              GIRLS
            </button>
            <button
              onClick={() => setGenderFilter("both")}
              className={`uppercase transition-colors text-lg ${
                genderFilter === "both"
                  ? "text-white font-extrabold"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              BOTH
            </button>
            <button
              onClick={() => setGenderFilter("guys")}
              className={`uppercase transition-colors ${
                genderFilter === "guys"
                  ? "text-yellow-400"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">
                CONNECT TO
              </span>
              GUYS
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
      {overlayPage === "topics" && (
        <PinTopicsOverlay userId={memberId} onClose={() => { setOverlayPage(null); queryClient.invalidateQueries({ queryKey: ["my_pinned_topics"] }); }} />
      )}

      {/* Cap Reached Popup */}
      {showCapPopup && capInfo && (
        <CapReachedPopup
          isVip={capInfo.isVip}
          cap={capInfo.cap}
          onDismiss={dismissCapPopup}
        />
      )}
    </div>
  );
};

export default VideoCallPage;
