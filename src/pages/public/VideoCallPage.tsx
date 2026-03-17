import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
import BannedScreen from "@/components/BannedScreen";
import { useCallMinutes } from "@/hooks/useCallMinutes";
import { useAnchorEarning } from "@/hooks/useAnchorEarning";
import AnchorEarningPanel from "@/components/videocall/AnchorEarningPanel";
import { useBlackScreenDetection } from "@/hooks/useBlackScreenDetection";
import { useLocalBlackScreenDetection } from "@/hooks/useLocalBlackScreenDetection";
import { useNsfwDetection } from "@/hooks/useNsfwDetection";
import { useAdPoints } from "@/hooks/useAdPoints";
import CapReachedPopup from "@/components/videocall/CapReachedPopup";
import SkipPenaltyPopup from "@/components/videocall/SkipPenaltyPopup";
import MinuteLossToast from "@/components/videocall/MinuteLossToast";
import RedeemPanel from "@/components/videocall/RedeemPanel";
import NavIcon from "@/components/videocall/NavIcon";
import FullScreenOverlay from "@/components/videocall/FullScreenOverlay";
import RewardStorePage from "@/pages/public/RewardStorePage";
import ProfilePage from "@/pages/public/ProfilePage";
import MyRewardsPage from "@/pages/public/MyRewardsPage";
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
import QuickStartGuide from "@/components/videocall/QuickStartGuide";
import NotifyMeToggle from "@/components/videocall/NotifyMeToggle";
import VoiceModeAvatar from "@/components/videocall/VoiceModeAvatar";
import VoiceModeExplainerPopup from "@/components/videocall/VoiceModeExplainerPopup";
import FemaleRetentionModal, { type FemaleRetentionModalRef } from "@/components/videocall/FemaleRetentionModal";
import DiscoverOverlayContent from "@/components/discover/DiscoverOverlayContent";
import DiscoverTeaser from "@/components/videocall/DiscoverTeaser";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import { useUnreadCount } from "@/hooks/useMessages";

import c24Logo from "@/assets/videocall/c24-logo.png";
import nextBtn from "@/assets/videocall/next-btn.png";
import storeIcon from "@/assets/videocall/store.png";
import redeemIcon from "@/assets/videocall/redeem.png";
import topicsIcon from "@/assets/videocall/topics-bubble.png";
import promoIcon from "@/assets/videocall/promo-star.png";
import profileIcon from "@/assets/videocall/profile-avatar.png";
import vipIcon from "@/assets/videocall/vip-rocket.png";
import giftIcon from "@/assets/videocall/gift-icon.svg";
import discoverIcon from "@/assets/discover-icon.png";
import reportIconImg from "@/assets/videocall/report-icon.png";
import frozenEmoji from "@/assets/videocall/frozen-emoji.png";

type GenderFilter = "girls" | "both" | "guys";

const genderMap: Record<GenderFilter, string> = {
  girls: "Female",
  both: "Both",
  guys: "Male"
};

const VideoCallPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, loading, banInfo, recheckBan } = useAuth();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("both");
  const [showRedeem, setShowRedeem] = useState(false);
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const mobileNavInitializedRef = useRef(false);
  const [showGiftOverlay, setShowGiftOverlay] = useState(false);
  const [showAnchorPanel, setShowAnchorPanel] = useState(false);
  const [showAnchorBanner, setShowAnchorBanner] = useState(() => {
    // Hide anchor banner on mobile for first-time female users to reduce clutter
    if (window.innerWidth < 768 && !localStorage.getItem("anchor_banner_seen")) {
      return false;
    }
    return true;
  });
  const [showReportOverlay, setShowReportOverlay] = useState(false);
  const [showUnfreezePartnerPopup, setShowUnfreezePartnerPopup] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [showVoiceModeExplainer, setShowVoiceModeExplainer] = useState(false);
  const voiceModeExplainerShownRef = useRef(false);
  const [pulseAnchorBtn, setPulseAnchorBtn] = useState(false);
  const retentionModalRef = useRef<FemaleRetentionModalRef>(null);
  const [showQuickStart, setShowQuickStart] = useState(() => {
    return !sessionStorage.getItem("c24_quickstart_seen");
  });
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const { data: unreadDmCount = 0 } = useUnreadCount();

  // Skip penalty state
  const [showSkipPenaltyPopup, setShowSkipPenaltyPopup] = useState(false);
  const [showMinuteLossToast, setShowMinuteLossToast] = useState(false);
  const skipPenaltyCountRef = useRef(0); // tracks how many times penalty shown
  const connectionStartRef = useRef<number | null>(null); // track when connection started

  const [showPromoAd, setShowPromoAd] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"store" | "profile" | "topics" | "promo" | "vip" | "vip-settings" | "my-rewards" | "discover" | null>(null);
  const memberId = user?.id ?? "anonymous";
  const prevUserIdRef = useRef(memberId);

  // Fetch member gender (needed for WebRTC + notifications)
  const { data: memberGender } = useQuery({
    queryKey: ["member_gender", memberId],
    enabled: memberId !== "anonymous",
    queryFn: async () => {
      const { data } = await supabase.from("members").select("gender").eq("id", memberId).maybeSingle();
      return data?.gender ?? null;
    }
  });

  // Check if user has taken a selfie (image_url exists = selfie submitted, regardless of approval status)
  const { data: hasSelfie, refetch: refetchDiscoverable } = useQuery({
    queryKey: ["member_discoverable", memberId],
    enabled: memberId !== "anonymous",
    queryFn: async () => {
      const { data } = await supabase.from("members").select("image_url").eq("id", memberId).maybeSingle();
      return !!data?.image_url;
    }
  });

  const needsSelfie = hasSelfie === false;

  const isFemale = memberGender?.toLowerCase() === "female";

  const hasAutoStartedRef = useRef(false);

  const {
    callState,
    error,
    currentPartnerId,
    partnerVoiceMode,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    startCall,
    next,
    stop
  } = useWebRTC({
    memberId,
    genderPreference: genderMap[genderFilter],
    memberGender: memberGender ?? undefined,
    voiceMode: isFemale ? voiceMode : false
  });

  // If the authenticated user changes (e.g. admin login in same browser), stop the call
  useEffect(() => {
    if (prevUserIdRef.current !== memberId && prevUserIdRef.current !== "anonymous") {
      console.log("[VideoCall] User changed, stopping call to prevent cross-account issues");
      stop();
    }
    prevUserIdRef.current = memberId;
  }, [memberId, stop]);

  // Capture user's IP on load and store it in their member record
  useEffect(() => {
    if (!user) return;
    supabase.functions.invoke("get-client-ip").then(({ data }) => {
      if (data?.ip) {
        supabase.from("members").update({ last_ip: data.ip } as any).eq("id", user.id).then(() => {});
      }
    }).catch(() => {});
  }, [user]);

  const { partnerBlackScreen } = useBlackScreenDetection({
    remoteVideoRef,
    localStreamRef,
    isConnected: callState === "connected" && !partnerVoiceMode
  });

  const { localBlackScreen } = useLocalBlackScreenDetection({
    localVideoRef,
    isActive: callState !== "idle" && !(isFemale && voiceMode)
  });

  const NSFW_BAN_THRESHOLD = 5;
  const nsfwTargetUserId =
  callState === "connected" && currentPartnerId && currentPartnerId !== memberId ?
  currentPartnerId :
  "anonymous";

  const { isNsfwBlurred, nsfwStrikes } = useNsfwDetection({
    remoteVideoRef,
    isConnected: callState === "connected",
    userId: nsfwTargetUserId,
    viewerUserId: memberId
  });

  const banAttemptPartnerRef = useRef<string | null>(null);

  // Auto-ban the offending remote user exactly when strike threshold is reached.
  useEffect(() => {
    if (!currentPartnerId || currentPartnerId === memberId) {
      banAttemptPartnerRef.current = null;
      return;
    }

    const targetUserId = currentPartnerId;

    if (nsfwStrikes < NSFW_BAN_THRESHOLD) {
      if (banAttemptPartnerRef.current === targetUserId) {
        banAttemptPartnerRef.current = null;
      }
      return;
    }

    if (banAttemptPartnerRef.current === targetUserId) return;
    banAttemptPartnerRef.current = targetUserId;

    const banUser = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("nsfw-ban", {
          body: { targetUserId }
        });

        if (error) {
          banAttemptPartnerRef.current = null;
          throw error;
        }

        console.log("[NSFW] Ban result:", data);
      } catch (err) {
        console.error("[NSFW] Failed to ban offending user:", err);
      }
    };

    banUser();
  }, [nsfwStrikes, currentPartnerId, memberId]);

  const {
    totalMinutes,
    elapsedSeconds,
    showCapPopup,
    capInfo,
    dismissCapPopup,
    flushMinutes,
    freezeInfo,
    refreshBalance: refreshMinutesBalance
  } = useCallMinutes({
    userId: memberId,
    partnerId: currentPartnerId,
    isConnected: callState === "connected",
    voiceMode: isFemale ? voiceMode : false
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
    elapsedSeconds
  });

  const { vipTier, subscribed, startCheckout, openPortal, checkSubscription } = useVipStatus(user?.id ?? null);
  

  // Show voice mode explainer once per session when female connects with voice mode
  useEffect(() => {
    if (callState === "connected" && isFemale && voiceMode && !voiceModeExplainerShownRef.current) {
      voiceModeExplainerShownRef.current = true;
      setShowVoiceModeExplainer(true);
    }
  }, [callState, isFemale, voiceMode]);

  // Fetch partner gender for anchor system
  const { data: partnerGenderData } = useQuery({
    queryKey: ["partner_gender", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      const { data } = await supabase.from("members").select("gender").eq("id", currentPartnerId!).maybeSingle();
      return data?.gender ?? null;
    }
  });

  // Anchor earning system (female-only)
  const anchor = useAnchorEarning({
    userId: memberId,
    isOnCall: callState === "waiting" || callState === "connected",
    partnerGender: partnerGenderData
  });

  // Auto-start anchor earning for eligible female users
  useEffect(() => {
    if (anchor.status === "idle" && !hasAutoStartedRef.current) {
      hasAutoStartedRef.current = true;
      anchor.joinAnchor();
      // On mobile first visit, keep the panel collapsed to reduce clutter
      const isMobileFirstVisit = window.innerWidth < 768 && !localStorage.getItem("anchor_banner_seen");
      setShowAnchorPanel(!isMobileFirstVisit);
      setShowAnchorBanner(true);
    }
  }, [anchor.status]);


  // Reset gender filter if not VIP
  useEffect(() => {
    if (!subscribed && genderFilter !== "both") {
      setGenderFilter("both");
    }
  }, [subscribed, genderFilter]);

  // Track when connection starts for skip penalty
  useEffect(() => {
    if (callState === "connected") {
      connectionStartRef.current = Date.now();
    } else {
      connectionStartRef.current = null;
    }
  }, [callState]);

  // Auto-close Discover overlay when a match is found
  useEffect(() => {
    if (callState === "connected" && overlayPage === "discover") {
      setOverlayPage(null);
      toast("Match found! 🎉", { description: "You've been connected to someone!" });
    }
  }, [callState, overlayPage]);

  const isMobile = useIsMobile();

  // Default to fullscreen video on mobile for females
  useEffect(() => {
    if (isMobile && isFemale && !mobileNavInitializedRef.current) {
      mobileNavInitializedRef.current = true;
      setMobileNavHidden(true);
    }
  }, [isMobile, isFemale]);

  const fetchPinnedTopics = async (userId: string) => {
    const { data: pins } = await supabase.
    from("pinned_topics").
    select("topic_id").
    eq("user_id", userId);
    if (!pins || pins.length === 0) return [];
    const topicIds = pins.map((p) => p.topic_id);
    const { data: topics } = await supabase.
    from("topics").
    select("id, name").
    in("id", topicIds);
    return topics || [];
  };

  const { data: pinnedTopics = [] } = useQuery({
    queryKey: ["my_pinned_topics", memberId],
    enabled: memberId !== "anonymous",
    queryFn: () => fetchPinnedTopics(memberId)
  });

  const { data: partnerPinnedTopics = [] } = useQuery({
    queryKey: ["partner_pinned_topics", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: () => fetchPinnedTopics(currentPartnerId!)
  });

  // Check if partner is VIP (gift icon shows for all VIP users)
  const { data: partnerGiftEnabled } = useQuery({
    queryKey: ["partner_is_vip", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      const { data: mm } = await supabase.
      from("member_minutes").
      select("is_vip").
      eq("user_id", currentPartnerId!).
      maybeSingle();
      return mm?.is_vip ?? false;
    }
  });

  // Check if partner is frozen
  const { data: partnerIsFrozen } = useQuery({
    queryKey: ["partner_is_frozen", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      const { data: mm } = await supabase.
      from("member_minutes").
      select("is_frozen").
      eq("user_id", currentPartnerId!).
      maybeSingle();
      return mm?.is_frozen ?? false;
    }
  });

  // Fetch partner's pinned socials — only show if partner is VIP
  const { data: partnerPinnedSocials = [] } = useQuery({
    queryKey: ["partner_pinned_socials", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      // Check if partner is VIP first
      const { data: mm } = await supabase.
      from("member_minutes").
      select("is_vip").
      eq("user_id", currentPartnerId!).
      maybeSingle();
      if (!mm?.is_vip) return [];

      const { data } = await supabase.
      from("vip_settings").
      select("pinned_socials").
      eq("user_id", currentPartnerId!).
      maybeSingle();
      return data?.pinned_socials as string[] ?? [];
    }
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
    if (params.get("unfreeze_partner") === "success") {
      const partnerId = params.get("partner_id");
      if (partnerId) {
        supabase.functions.invoke("unfreeze-purchase", {
          body: { action: "apply_for_partner", partner_id: partnerId }
        }).then(() => {
          toast.success("🥶 You unfroze their minutes! What a hero!");
          queryClient.invalidateQueries({ queryKey: ["partner_is_frozen"] });
        });
      }
      window.history.replaceState({}, "", "/videocall");
    }
    if (params.get("gift") === "success") {
      const sessionId = params.get("session_id");
      if (sessionId) {
        supabase.functions.invoke("gift-minutes", {
          body: { action: "verify", session_id: sessionId }
        }).then(({ data }) => {
          if (data?.success) {
            toast.success(`Gift sent! ${data.minutes_gifted} minutes gifted.${data.sender_bonus > 0 ? ` You got +${data.sender_bonus} minutes bonus!` : ""}`);
          }
        });
      }
      window.history.replaceState({}, "", "/videocall");
    }
  }, [banInfo, recheckBan, checkSubscription]);

  // Auto-open VIP overlay when navigated with openVip state
  const location = useLocation();
  useEffect(() => {
    if ((location.state as any)?.openVip) {
      setOverlayPage("vip");
      // Clear the state so it doesn't re-trigger
      window.history.replaceState({}, "", "/videocall");
    }
  }, [location.state]);

  const doLeave = useCallback(() => {
    awardAdPoints(elapsedSeconds).catch(() => {});
    flushMinutes().catch(() => {});
    stop().catch(() => {});
    navigate("/");
  }, [awardAdPoints, elapsedSeconds, flushMinutes, stop, navigate]);

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
    // --- Skip Penalty Logic ---
    const connectedDurationMs = connectionStartRef.current ?
    Date.now() - connectionStartRef.current :
    Infinity;
    const connectedDurationSec = connectedDurationMs / 1000;
    const isQuickSkip = connectedDurationSec < 5;

    // Only penalize non-VIP users
    if (isQuickSkip && !subscribed) {
      // Deduct 2 minutes server-side (only if they have minutes)
      if (totalMinutes > 0) {
        const { data: penaltyData } = await supabase.functions.invoke("earn-minutes", {
          body: { type: "deduct", userId: memberId, amount: 2 }
        });

        if (penaltyData?.success) {
          refreshMinutesBalance();
        }
      }

      skipPenaltyCountRef.current += 1;

      if (skipPenaltyCountRef.current <= 3) {
        setShowSkipPenaltyPopup(true);
      } else {
        setShowMinuteLossToast(true);
      }
    }

    // Award ad points for this call before moving to next
    await awardAdPoints(elapsedSeconds);
    await flushMinutes();
    next();
    // Show a promo ad between skips — respect VIP setting
    const { data: vipSettings } = await supabase.
    from("vip_settings").
    select("show_promo_ads").
    eq("user_id", memberId).
    maybeSingle();
    const promoAdsEnabled = vipSettings?.show_promo_ads ?? true;
    if (promoAdsEnabled) {
      setShowPromoAd(true);
    }
  };

  const handleBack = () => {
    // Intercept for female retention modal (once per session)
    if (isFemale && retentionModalRef.current?.tryShow()) {
      return; // modal shown, wait for user decision
    }
    doLeave();
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-between px-3 py-2 md:relative">
        <div className="flex items-center gap-2 md:absolute md:left-3 md:top-1/2 md:-translate-y-1/2">
          <button
            onClick={handleBack}
            className="p-1 hover:bg-white/10 rounded-full transition-colors">
            
            <ChevronLeft className="w-8 h-8" />
          </button>
        </div>

        <div className="text-right md:text-center md:flex-1">
          <div className="flex items-center justify-end md:justify-center gap-1.5 text-2xl md:text-3xl font-black">
            <span>⏱️</span>
            {freezeInfo.isFrozen ?
            <span className="text-blue-300">🥶 {totalMinutes} Frozen</span> :

            <span>{totalMinutes} Minutes</span>
            }
          </div>
          {freezeInfo.isFrozen &&
          <div className="text-blue-400 text-xs font-bold animate-pulse cursor-pointer hover:text-blue-300 transition-colors"
          onClick={() => setShowFrozenPopup(true)}>
              unfreeze me
            </div>
          }
          {callState === "connected" &&
          <div className="flex items-center justify-end md:justify-center gap-1 text-[10px] text-green-400 font-mono font-bold">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span>{timerDisplay}</span>
            </div>
          }
          <div className="flex items-center justify-end md:justify-center gap-1 text-sm md:text-lg text-yellow-400 font-bold">
            <span>⭐</span>
            <span>{adPoints} Ad Points</span>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error &&
      <div className="mx-4 mb-2 px-4 py-2 bg-red-900/60 border border-red-700 rounded-lg text-sm text-center">
          {error}
        </div>
      }

      {/* Video Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 mx-3 mb-2 min-h-0 md:justify-center md:items-center md:max-w-4xl md:mx-auto md:w-full md:flex-none">
        {/* Local Video */}
        <div className="flex-1 md:flex-none md:w-[420px] md:aspect-[3/4] rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
          {!isActive &&
          <div className="flex flex-col items-center gap-3">
              <img src={c24Logo} alt="C24 Club" className="w-48 md:w-56 drop-shadow-lg" />
              
              {/* Voice Mode toggle - females only */}
              {isFemale &&
            <button
              onClick={() => setVoiceMode(!voiceMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-colors ${
              voiceMode ?
              "bg-pink-600 text-white shadow-lg shadow-pink-500/30" :
              "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white border border-neutral-600"}`
              }>
              
                  <span>{voiceMode ? "🎙️" : "📹"}</span>
                  <span>{voiceMode ? "Voice Mode ON" : "Voice Mode (Hide Face)"}</span>
                </button>
            }

              {needsSelfie ?
            <button
              onClick={() => setShowSelfieCapture(true)}
              className="bg-pink-500 hover:bg-pink-600 text-white font-black text-lg px-8 py-3 rounded-xl transition-colors shadow-lg flex items-center gap-2">
              
                  📸 Take a Selfie to Start
                </button> :

            <button onClick={handleStart} className="bg-red-600 hover:bg-red-700 text-white font-black text-xl px-10 py-2.5 rounded-lg transition-colors shadow-lg">
                  START
                </button>
            }
              {needsSelfie &&
            <p className="text-white/50 text-xs text-center max-w-[250px]">
                  Quick selfie so others can discover you — takes 3 seconds!
                </p>
            }
            </div>
          }

          {/* Quick Start Guide overlay */}
          {!isActive && showQuickStart &&
          <QuickStartGuide onDismiss={() => {
            setShowQuickStart(false);
            sessionStorage.setItem("c24_quickstart_seen", "1");
          }} />
          }

          {/* Voice mode: show avatar instead of local video (desktop only — on mobile this box shows partner) */}
          {!isMobile && isFemale && voiceMode && isActive &&
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-600/30 border-2 border-pink-500/40 flex items-center justify-center mb-3">
                <span className="text-4xl md:text-5xl">🎙️</span>
              </div>
              <span className="text-pink-400 text-xs font-bold">Voice Mode Active</span>
            </div>
          }

          {/* Partner video (big box) on mobile, local video on desktop */}
          {isMobile ?
          <>
              {partnerVoiceMode && callState === "connected" &&
            <VoiceModeAvatar videoRef={remoteVideoRef} className="z-20 absolute inset-0" />
            }
              <video ref={remoteVideoRef} autoPlay playsInline
            className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" && !partnerVoiceMode ? "opacity-100" : "opacity-0 pointer-events-none"} ${isNsfwBlurred ? "blur-[30px]" : ""}`} />
              {isNsfwBlurred && callState === "connected" &&
            <div className="absolute inset-0 z-30 bg-black/60 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl">🚫</span>
                  <p className="text-white font-black text-sm mt-2">CONTENT BLURRED</p>
                  <p className="text-red-400 text-xs font-bold mt-1">Partner strike {Math.min(nsfwStrikes, 5)}/5</p>
                </div>
            }
              {partnerBlackScreen && callState === "connected" && !isNsfwBlurred && !partnerVoiceMode &&
            <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-4xl">📵</span>
                  <p className="text-white font-black text-sm mt-2">PARTNER IS FACELESS</p>
                  <p className="text-neutral-400 text-xs text-center px-4 mt-1">Tap Next to skip</p>
                </div>
            }
              {partnerPinnedTopics.length > 0 && callState === "connected" &&
            <div className="absolute bottom-10 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
                  {partnerPinnedTopics.map((topic: {id: string;name: string;}) =>
              <span key={topic.id} className="bg-blue-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                      📌 {topic.name}
                    </span>
              )}
                </div>
            }
            </> :

          <video ref={localVideoRef} autoPlay muted playsInline
          className={`absolute inset-0 w-full h-full object-cover ${isActive && !(isFemale && voiceMode) ? "block" : "hidden"}`} />
          }

          {/* Promo Ad - shown inside local video box between skips */}
          {showPromoAd &&
          <PromoAdOverlay
            viewerId={memberId}
            onDismiss={() => setShowPromoAd(false)} />

          }
          {isActive &&
          <button onClick={stop} className="absolute top-2 left-2 z-20 bg-black/60 hover:bg-red-600 backdrop-blur-sm rounded-full p-1.5 transition-colors">
              <X className="w-5 h-5" />
            </button>
          }

          {/* Warning to local user when their camera is black - desktop only (on mobile it's in the small box) */}
          {!isMobile && localBlackScreen && isActive && callState === "connected" &&
          <div className="absolute inset-0 z-30 bg-black/80 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-5xl">📵</span>
              <p className="text-white font-black text-base mt-2 text-center px-4">YOUR CAMERA IS OFF</p>
              <p className="text-yellow-400 text-sm text-center px-6 mt-1 animate-pulse font-bold">
                Turn on your camera to see your partner
              </p>
            </div>
          }

          {callState === "waiting" && isMobile &&
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 overflow-y-auto">
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-sm text-neutral-300">Finding a partner...</p>
                <DiscoverTeaser
                  myGender={memberGender ?? null}
                  myUserId={memberId}
                  onOpenDiscover={() => setOverlayPage("discover")}
                />
              </div>
            </div>
          }

          {/* Report button - mobile below timer, desktop top-left of partner video */}
          {callState === "connected" && currentPartnerId && isMobile &&
          <button
            onClick={() => setShowReportOverlay(true)}
            className="absolute top-12 left-2 z-20 w-8 h-8 rounded-full overflow-hidden hover:scale-110 transition-transform shadow-lg"
            title="Report User">
            
              <img src={reportIconImg} alt="Report" className="w-full h-full object-cover" />
            </button>
          }

          {/* Pinned socials - mobile, below report icon */}
          {isMobile && partnerPinnedSocials.length > 0 && callState === "connected" &&
          <div className="absolute top-[5.5rem] left-2 z-20">
              <PinnedSocialsDisplay pinnedSocials={partnerPinnedSocials} />
            </div>
          }

          {/* Frozen icon - mobile, below socials/report */}
          {isMobile && callState === "connected" && partnerIsFrozen && currentPartnerId &&
          <button
            onClick={() => setShowUnfreezePartnerPopup(true)}
            className="absolute left-2 z-20 w-10 h-10 hover:scale-110 transition-transform drop-shadow-lg"
            style={{ top: partnerPinnedSocials.length > 0 ? "calc(5.5rem + 2.5rem)" : "5.5rem" }}
            title="This user is frozen">
            
              <img src={frozenEmoji} alt="Frozen" className="w-full h-full object-contain" />
            </button>
          }

          {/* Gift icon - shows when partner is VIP */}
          {callState === "connected" && partnerGiftEnabled && currentPartnerId &&
          <button
            onClick={() => setShowGiftOverlay(true)}
            className="absolute bottom-3 left-3 z-20 animate-bounce">
            
              <img src={giftIcon} alt="Send Gift" className="w-12 h-12 drop-shadow-lg" />
            </button>
          }

          {isActive &&
          <button onClick={handleNext} className="md:hidden absolute bottom-3 right-3 flex flex-col items-center bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors z-20">
              <span className="font-bold text-sm">NEXT</span>
              <img src={nextBtn} alt="Next" className="w-9 h-9" />
            </button>
          }

          {isMobile &&
          <div className="absolute top-2 right-2 z-10 w-[30%] aspect-[3/4] rounded-lg border border-neutral-600 bg-neutral-800 overflow-hidden shadow-xl">
              {/* Local video (me) - small box on mobile */}
              {isFemale && voiceMode && isActive ?
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center">
                  <span className="text-2xl">🎙️</span>
                  <span className="text-pink-400 text-[7px] font-bold">Voice Mode</span>
                </div> :

            <video ref={localVideoRef} autoPlay muted playsInline
            className={`w-full h-full object-cover ${isActive ? "block" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />
            }
              {callState !== "connected" &&
            <div className="w-full h-full flex items-center justify-center">
                  <p className="text-neutral-600 text-[10px] text-center px-1">
                    {callState === "connecting" ? "Connecting..." : callState === "waiting" ? "Searching..." : ""}
                  </p>
                </div>
            }
              {pinnedTopics.length > 0 && isActive &&
            <div className="absolute bottom-1 left-1 z-20 flex flex-wrap gap-1 max-w-[90%]">
                  {pinnedTopics.map((topic: {id: string;name: string;}) =>
              <span key={topic.id} className="bg-red-600/80 backdrop-blur-sm text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-lg">
                      📌 {topic.name}
                    </span>
              )}
                </div>
            }
            </div>
          }

          {!isMobile && pinnedTopics.length > 0 && isActive &&
          <div className="absolute bottom-10 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
              {pinnedTopics.map((topic: {id: string;name: string;}) =>
            <span key={topic.id} className="bg-red-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                  📌 {topic.name}
                </span>
            )}
            </div>
          }
          {/* Watermark */}
          <span className="absolute bottom-3 left-3 md:right-3 md:left-auto z-10 text-white/15 text-2xl md:text-3xl font-black tracking-widest pointer-events-none select-none">
            C24CLUB
          </span>
        </div>

        {/* Partner Video - desktop */}
        {!isMobile &&
        <div className="flex-none w-[420px] aspect-[3/4] rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
            {/* Partner voice mode avatar - desktop */}
            {partnerVoiceMode && callState === "connected" &&
          <VoiceModeAvatar videoRef={remoteVideoRef} className="z-20" />
          }
            <video ref={remoteVideoRef} autoPlay playsInline
          className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" && !partnerVoiceMode ? "block" : "hidden"} ${isNsfwBlurred ? "blur-[30px]" : ""}`} />
            {isNsfwBlurred && callState === "connected" &&
          <div className="absolute inset-0 z-30 bg-black/60 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl">🚫</span>
                <p className="text-white font-black text-sm mt-2">CONTENT BLURRED</p>
                <p className="text-red-400 text-xs font-bold mt-1">Partner strike {Math.min(nsfwStrikes, 5)}/5 — nudity detected</p>
                {nsfwStrikes >= 3 &&
            <p className="text-yellow-400 text-xs font-bold mt-1 animate-pulse">⚠️ Warning: Ban at 5 strikes</p>
            }
              </div>
          }
            {partnerBlackScreen && callState === "connected" && !isNsfwBlurred && !partnerVoiceMode &&
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl">📵</span>
                <p className="text-white font-black text-sm mt-2">PARTNER IS FACELESS</p>
                <p className="text-neutral-400 text-xs text-center px-6 mt-1">Their camera is off or covered. Press Next to skip.</p>
              </div>
          }
            {localBlackScreen && callState === "connected" && !partnerBlackScreen && !isNsfwBlurred &&
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl">🙈</span>
                <p className="text-white font-black text-sm mt-2">PARTNER HIDDEN</p>
                <p className="text-yellow-400 text-xs text-center px-6 mt-1">Since you're faceless, we won't show you the opposing user's face.</p>
                <p className="text-neutral-400 text-xs text-center px-6 mt-1">Turn on your camera to see them.</p>
              </div>
          }
            {callState !== "connected" &&
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10 overflow-y-auto">
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                  <p className="text-neutral-400 text-sm">
                    {callState === "waiting" ? "Finding a partner..." : callState === "connecting" ? "Connecting..." : "Waiting to start..."}
                  </p>
                  {callState === "waiting" &&
                    <DiscoverTeaser
                      myGender={memberGender ?? null}
                      myUserId={memberId}
                      onOpenDiscover={() => setOverlayPage("discover")}
                    />
                  }
                </div>
              </div>
          }
            {partnerPinnedTopics.length > 0 && callState === "connected" &&
          <div className="absolute bottom-2 left-2 z-20 flex flex-wrap gap-1.5 max-w-[70%]">
                {partnerPinnedTopics.map((topic: {id: string;name: string;}) =>
            <span key={topic.id} className="bg-blue-600/80 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-lg">
                    📌 {topic.name}
                  </span>
            )}
              </div>
          }
            {partnerPinnedSocials.length > 0 && callState === "connected" &&
          <div className="absolute top-2 right-2 z-20">
                <PinnedSocialsDisplay pinnedSocials={partnerPinnedSocials} />
              </div>
          }
            {callState === "connected" && currentPartnerId &&
          <button
            onClick={() => setShowReportOverlay(true)}
            className="absolute top-2 left-2 z-20 w-9 h-9 rounded-full overflow-hidden hover:scale-110 transition-transform shadow-lg"
            title="Report User">
            
                <img src={reportIconImg} alt="Report" className="w-full h-full object-cover" />
              </button>
          }
            {/* Frozen icon - desktop, below report icon */}
            {callState === "connected" && partnerIsFrozen && currentPartnerId &&
          <button
            onClick={() => setShowUnfreezePartnerPopup(true)}
            className="absolute top-14 left-2 z-20 w-10 h-10 hover:scale-110 transition-transform drop-shadow-lg"
            title="This user is frozen">
            
                <img src={frozenEmoji} alt="Frozen" className="w-full h-full object-contain" />
              </button>
          }
            {/* NEXT Button - inside partner box, bottom-right, above overlays */}
            {isActive &&
          <button onClick={handleNext} className="absolute bottom-3 right-3 z-40 flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-5 py-2 transition-colors">
                <span className="font-bold text-sm">NEXT</span>
                <img src={nextBtn} alt="Next" className="w-8 h-8" />
              </button>
          }
          </div>
        }
      </div>


      {/* Mobile slide toggle – swipe up/down or tap */}
      {isMobile && !showRedeem &&
      <div
        className="flex justify-center py-3 md:hidden cursor-grab active:cursor-grabbing"
        onTouchStart={(e) => {
          const startY = e.touches[0].clientY;
          const el = e.currentTarget;
          const handleMove = (ev: TouchEvent) => {
            const dy = ev.touches[0].clientY - startY;
            if (Math.abs(dy) > 20) {
              setMobileNavHidden(dy < 0); // swipe up = hide, swipe down = show
              el.removeEventListener("touchmove", handleMove);
            }
          };
          el.addEventListener("touchmove", handleMove, { passive: true });
          el.addEventListener("touchend", () => el.removeEventListener("touchmove", handleMove), { once: true });
        }}
        onClick={() => setMobileNavHidden(!mobileNavHidden)}
      >
          {mobileNavHidden ? (
            <span className="text-[10px] text-neutral-400 font-medium tracking-wide animate-pulse">↓ View more ↓</span>
          ) : (
            <div className="w-12 h-1.5 rounded-full bg-neutral-500" />
          )}
        </div>
      }

      {/* Anchor "Tap Me" Banner (female users only) */}
      {showAnchorBanner && anchor.status !== "not_eligible" && anchor.status !== "loading" &&
      <div className="mx-3 md:mx-auto md:w-[420px] relative">
          {/* First-time coach mark tooltip */}
          {!sessionStorage.getItem("tapme_tooltip_dismissed") && anchor.status !== "active" &&
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
              <div className="bg-white text-gray-900 text-xs font-bold px-4 py-2 rounded-lg shadow-lg whitespace-nowrap">
                👇 Tap here to start earning cash!
                <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white" />
              </div>
            </div>
        }
          {/* Hide button */}
          <div className="mb-1 flex justify-end">
            <button
            onClick={() => {setShowAnchorBanner(false);localStorage.setItem("anchor_banner_seen", "1");}}
            className="text-neutral-500 hover:text-neutral-300 text-xs px-2 py-1 flex items-center gap-1"
            title="Hide earning banner">
            
              👁‍🗨 Hide Earning Banner
            </button>
          </div>
          <button
          id="anchor-tap-me-btn"
          onClick={() => {
            setShowAnchorPanel(!showAnchorPanel);
            sessionStorage.setItem("tapme_tooltip_dismissed", "1");
            // Auto-join if idle
            if (anchor.status === "idle" || anchor.status === "slots_full") {
              anchor.joinAnchor();
            }
            // Log tap event for analytics
            if (user?.id) {
              supabase.from("tap_me_events").insert({ user_id: user.id }).then(() => {});
            }
          }}
          className={`w-full mb-1 rounded-xl transition-all relative ${pulseAnchorBtn ? "animate-[pulse_0.6s_ease-in-out_5] ring-4 ring-pink-400 ring-opacity-75" : "hover:scale-[1.02]"}`}
          style={{ animation: pulseAnchorBtn ? undefined : "tapme-glow 2s ease-in-out infinite" }}>
          
            {/* Floating coin particles - above content */}
            <div className="absolute inset-0 z-10 overflow-visible pointer-events-none">
              <span className="absolute text-lg animate-[float-coin_3s_ease-in-out_infinite]" style={{ left: "10%", top: "-10px" }}>💰</span>
              <span className="absolute text-lg animate-[float-coin_2.5s_ease-in-out_infinite_0.5s]" style={{ right: "8%", top: "-8px" }}>💵</span>
              <span className="absolute text-sm animate-[float-coin_3.5s_ease-in-out_infinite_1s]" style={{ left: "50%", top: "-12px" }}>✨</span>
            </div>
            {/* Main Tap Me row */}
            <div className="bg-gradient-to-r from-pink-600 via-fuchsia-500 to-pink-600 py-3 px-4 flex items-center justify-between relative rounded-t-xl" style={{ backgroundSize: "200% 100%", animation: "shimmer-bg 3s linear infinite" }}>
              <span className="text-white text-base font-black tracking-wide drop-shadow-lg">
                🎉💰 TAP ME!
              </span>
              <span className="text-white font-black text-sm">
                {anchor.status === "active" ?
              <>Earning: <span className="text-green-300 text-base">${anchor.cashBalance.toFixed(2)}</span></> :

              <>Earn up to <span className="text-green-300 text-base">${anchor.settings?.power_rate_cash ?? 1.5}/hr</span></>
              }
              </span>
            </div>
            {/* Schedule rows */}
            <div className={`py-1.5 px-3 flex items-center justify-between ${anchor.mode === "chill" ? "bg-gradient-to-r from-purple-700/90 to-indigo-600/90" : "bg-gradient-to-r from-purple-900/60 to-indigo-800/60"}`}>
              <span className={`text-xs font-bold ${anchor.mode === "chill" ? "text-purple-200 animate-pulse" : "text-purple-300/70"}`}>
                {anchor.mode === "chill" ? "✨ CHILL HOURS (NOW)" : "✨ CHILL: 12 AM – 7 PM EST"}
              </span>
              <span className={`text-xs font-bold ${anchor.mode === "chill" ? "text-white" : "text-white/60"}`}>
                🎁 Mystery Reward / {anchor.settings?.chill_reward_time ?? 45}min
              </span>
            </div>
            <div className={`py-1.5 px-3 flex items-center justify-between ${anchor.status !== "active" ? "rounded-b-xl" : ""} ${anchor.mode === "power" ? "bg-gradient-to-r from-red-600/90 to-orange-500/90" : "bg-gradient-to-r from-red-900/60 to-orange-800/60"}`}>
              <span className={`text-xs font-bold ${anchor.mode === "power" ? "text-yellow-200 animate-pulse" : "text-yellow-300/70"}`}>
                {anchor.mode === "power" ? "🔥 POWER HOUR (LIVE!)" : "⚡ POWER: 7 PM – 12 AM EST"}
              </span>
              <span className={`text-xs font-bold ${anchor.mode === "power" ? "text-white" : "text-white/60"}`}>
                💵 ${anchor.settings?.power_rate_cash ?? 1.5} / {anchor.settings?.power_rate_time ?? 30}min
              </span>
            </div>
            {/* Minutes paused notice */}
            {anchor.status === "active" &&
          <div className="bg-gray-900/90 py-1 px-3 text-center rounded-b-xl">
                <span className="text-white/90 text-[10px] font-semibold">
                  Chat with guys or "wait for a partner" to earn!
                </span>
              </div>
          }
          </button>
          {showAnchorPanel &&
        <AnchorEarningPanel
          status={anchor.status}
          mode={anchor.mode}
          elapsedSeconds={anchor.elapsedSeconds}
          thresholdSeconds={anchor.thresholdSeconds}
          cashBalance={anchor.cashBalance}
          queuePosition={anchor.queuePosition}
          rewardEarned={anchor.rewardEarned}
          cashEarned={anchor.cashEarned}
          settings={anchor.settings}
          settingsLoaded={anchor.settingsLoaded}
          verificationRequired={anchor.verificationRequired}
          verificationWord={anchor.verificationWord}
          payouts={anchor.payouts}
          onJoin={anchor.joinAnchor}
          onLeave={anchor.leaveAnchor}
          onCashout={anchor.cashout}
          onDismissReward={anchor.dismissReward}
          onDismissCash={anchor.dismissCashEarned}
          onSubmitVerification={anchor.submitVerification} />

        }
        </div>
      }

      {/* Show Earning Banner button (when hidden) */}
      {!showAnchorBanner && anchor.status !== "not_eligible" && anchor.status !== "loading" &&
      <div className="mx-3 md:mx-auto md:w-[420px]">
          <button
          onClick={() => {setShowAnchorBanner(true);localStorage.setItem("anchor_banner_seen", "1");}}
          className="w-full mb-2 flex items-center justify-center gap-1 rounded-full bg-neutral-800/80 border border-neutral-700 px-3 py-1 text-xs text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors">
          
            <span>👁</span> Show Earning Dashboard
          </button>
        </div>
      }

      {/* Panels */}
      {showRedeem ?
      <div className="px-3 pb-4">
          <RedeemPanel totalMinutes={totalMinutes} onClose={() => setShowRedeem(false)} />
        </div> :

      <div className={`transition-all duration-300 overflow-hidden ${isMobile && mobileNavHidden ? "max-h-0 opacity-0" : "max-h-[300px] opacity-100"} md:max-h-none md:opacity-100`}>
          <div className="flex justify-center gap-5 md:gap-10 px-4 pt-2 pb-3 flex-wrap">
            <NavIcon src={storeIcon} label="REDEEM" onClick={() => isActive ? setOverlayPage("store") : navigate("/store")} shake />
            <NavIcon src={redeemIcon} label="MY REWARDS" onClick={() => isActive ? setOverlayPage("my-rewards") : navigate("/my-rewards")} highlight />
            <NavIcon src={topicsIcon} label="TOPICS" onClick={() => setOverlayPage("topics")} />
            <NavIcon src={promoIcon} label="PROMO" onClick={() => setOverlayPage("promo" as any)} />
            <NavIcon src={profileIcon} label="PROFILE" onClick={() => isActive ? setOverlayPage("profile") : navigate("/profile")} />
            <NavIcon src={vipIcon} label={subscribed ? "VIP ✓" : "VIP"} onClick={() => setOverlayPage("vip" as any)} />
            <NavIcon src={discoverIcon} label="DISCOVER" onClick={() => isActive ? setOverlayPage("discover") : navigate("/discover")} badge={unreadDmCount > 0 ? `${unreadDmCount > 9 ? "9+" : unreadDmCount} DMs` : null} />
          </div>
          <div className="flex justify-center items-center gap-8 md:gap-14 pb-6 md:pt-4 text-sm md:text-lg font-bold tracking-wider">
            <button onClick={() => {
            if (!subscribed) {setOverlayPage("vip");return;}
            setGenderFilter("girls");
          }} className={`uppercase transition-colors ${genderFilter === "girls" ? "text-yellow-400" : "text-neutral-400 hover:text-white"}`}>
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">CONNECT TO</span>GIRLS
            </button>
            <button onClick={() => setGenderFilter("both")} className={`uppercase transition-colors text-lg ${genderFilter === "both" ? "text-white font-extrabold" : "text-neutral-400 hover:text-white"}`}>
              BOTH
            </button>
            <button onClick={() => {
            if (!subscribed) {setOverlayPage("vip");return;}
            setGenderFilter("guys");
          }} className={`uppercase transition-colors ${genderFilter === "guys" ? "text-yellow-400" : "text-neutral-400 hover:text-white"}`}>
              <span className="text-[10px] block text-neutral-500 font-normal tracking-wide">CONNECT TO</span>GUYS
            </button>
          </div>
        </div>
      }

      {/* Full-screen overlay pages */}
      {overlayPage === "store" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <RewardStorePage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      }
      {overlayPage === "my-rewards" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <MyRewardsPage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      }
      {overlayPage === "profile" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <ProfilePage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      }
      {overlayPage === "promo" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <PromoPanel
          userId={memberId}
          adPoints={adPoints}
          onClose={() => setOverlayPage(null)}
          onAdPointsChange={refreshBalance} />
        
        </FullScreenOverlay>
      }
      {overlayPage === "topics" &&
      <PinTopicsOverlay userId={memberId} onClose={() => {setOverlayPage(null);queryClient.invalidateQueries({ queryKey: ["my_pinned_topics"] });}} />
      }
      {overlayPage === "vip" &&
      <VipFeaturesOverlay
        onClose={() => setOverlayPage(null)}
        currentTier={vipTier}
        onPurchase={startCheckout}
        onManage={() => {setOverlayPage("vip-settings");return Promise.resolve();}} />

      }
      {overlayPage === "vip-settings" &&
      <VipSettingsOverlay
        onClose={() => setOverlayPage(null)}
        userId={memberId}
        vipTier={vipTier}
        genderFilter={genderFilter}
        onGenderFilterChange={(g) => setGenderFilter(g as GenderFilter)} />

      }
      {overlayPage === "discover" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <DiscoverOverlayContent onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      }

      {/* Skip Penalty Popup (first 3 times) */}
      {showSkipPenaltyPopup &&
      <SkipPenaltyPopup
        minutesLost={2}
        onDismiss={() => setShowSkipPenaltyPopup(false)}
        onUpgrade={() => {
          setShowSkipPenaltyPopup(false);
          setOverlayPage("vip");
        }} />

      }

      {/* Floating minute loss toast (after 3 times) */}
      {showMinuteLossToast &&
      <MinuteLossToast minutesLost={2} onDone={() => setShowMinuteLossToast(false)} />
      }

      {/* Cap Reached Popup */}
      {showCapPopup && capInfo &&
      <CapReachedPopup isVip={capInfo.isVip} cap={capInfo.cap} onDismiss={dismissCapPopup} voiceMode={isFemale && voiceMode} />
      }

      {/* Voice Mode Explainer Popup */}
      {showVoiceModeExplainer &&
      <VoiceModeExplainerPopup onDismiss={() => setShowVoiceModeExplainer(false)} />
      }

      {/* Minutes Frozen Popup */}
      {showFrozenPopup &&
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
        onPurchaseVip={startCheckout} />

      }

      {/* Send Gift Overlay */}
      {showGiftOverlay && currentPartnerId &&
      <SendGiftOverlay
        recipientId={currentPartnerId}
        onClose={() => setShowGiftOverlay(false)} />

      }

      {/* Report User Overlay */}
      {showReportOverlay && currentPartnerId &&
      <ReportUserOverlay
        reporterId={memberId}
        reportedUserId={currentPartnerId}
        remoteVideoRef={remoteVideoRef}
        onClose={() => setShowReportOverlay(false)} />

      }

      {/* Unfreeze Partner Popup */}
      {showUnfreezePartnerPopup && currentPartnerId &&
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-6">
          <div className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full text-center relative">
            <button
            onClick={() => setShowUnfreezePartnerPopup(false)}
            className="absolute top-3 left-3 text-white hover:text-neutral-300">
            
              <ChevronLeft className="w-7 h-7" />
            </button>

            <img src={frozenEmoji} alt="Frozen" className="w-20 h-20 mx-auto mb-4" />

            <h2 className="text-white font-black text-2xl leading-tight mb-3">
              The user is frozen<br />they need your help!
            </h2>

            <p className="text-neutral-300 text-sm mb-6">
              Their earning rate is reduced to{" "}
              <span className="text-blue-400 font-black">2 minutes</span> per user instead of 10 or 30 minutes.
            </p>

            <button
            onClick={async () => {
              try {
                const { data, error } = await supabase.functions.invoke("unfreeze-purchase", {
                  body: { action: "purchase_for_partner", partner_id: currentPartnerId }
                });
                if (error) throw error;
                if (data?.url) {
                  window.open(data.url, "_blank");
                }
                setShowUnfreezePartnerPopup(false);
              } catch (e: any) {
                toast.error(e.message || "Failed to start checkout");
              }
            }}
            className="w-full py-4 rounded-xl border-2 border-blue-500 bg-blue-500/10 hover:bg-blue-500/20 transition-colors">
            
              <span className="text-white font-black text-2xl block">Unfreeze Them</span>
              <span className="text-blue-300 font-bold text-lg">$1.99</span>
            </button>
          </div>
        </div>
      }

      {/* Female Retention Modal */}
      <FemaleRetentionModal
        ref={retentionModalRef}
        isFemale={isFemale}
        callState={callState}
        isMobile={isMobile}
        onStayAndEarn={() => {
          setPulseAnchorBtn(true);
          setShowAnchorBanner(true);
          setTimeout(() => setPulseAnchorBtn(false), 3000);
          const anchorBanner = document.getElementById("anchor-tap-me-btn");
          anchorBanner?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
        onLeaveAnyway={doLeave} />
      

      {/* Mandatory Selfie Capture Modal */}
      <SelfieCaptureModal
        open={showSelfieCapture}
        onClose={() => setShowSelfieCapture(false)}
        onComplete={() => {
          setShowSelfieCapture(false);
          refetchDiscoverable();
        }} />
      
    </div>);

};

export default VideoCallPage;