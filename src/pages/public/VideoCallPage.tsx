import { useState, useCallback, useRef, useEffect } from "react";
import { resetIfStaleWeek, stampWeek } from "@/lib/weekUtils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronLeft, X } from "lucide-react";
import { useWebRTC } from "@/hooks/useWebRTC";
import { useAuth } from "@/hooks/useAuth";
import BannedScreen from "@/components/BannedScreen";
import { useCallMinutes } from "@/hooks/useCallMinutes";
import { useSpeedConnectChallenge } from "@/hooks/useSpeedConnectChallenge";
import { useWelcomeBonus } from "@/hooks/useWelcomeBonus";
import AnchorEarningPanel from "@/components/videocall/AnchorEarningPanel";

import { useAnchorEarning } from "@/hooks/useAnchorEarning";
import { useBlackScreenDetection } from "@/hooks/useBlackScreenDetection";
import { useLocalBlackScreenDetection } from "@/hooks/useLocalBlackScreenDetection";
import { usePreBlur } from "@/hooks/usePreBlur";
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
import MessagesPage from "@/pages/public/MessagesPage";
import WeeklyChallengesPage from "@/pages/public/WeeklyChallengesPage";
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
import DiscoverOverlayContent from "@/components/discover/DiscoverOverlayContent";
import DiscoverTeaser from "@/components/videocall/DiscoverTeaser";
import SelfieCaptureModal from "@/components/discover/SelfieCaptureModal";
import CameraUnlockButton from "@/components/videocall/CameraUnlockButton";
import CameraConsentModal from "@/components/videocall/CameraConsentModal";
import { useUnreadCount } from "@/hooks/useMessages";
import { captureBestieScreenshot } from "@/lib/bestieScreenshot";
import BlueEyesSnapButton from "@/components/videocall/BlueEyesSnapButton";
import ChallengeCarousel from "@/components/videocall/ChallengeCarousel";
import { useNsfwDetection } from "@/hooks/useNsfwDetection";
import NsfwConfirmOverlay from "@/components/videocall/NsfwConfirmOverlay";
import BehaviorWarningOverlay from "@/components/videocall/BehaviorWarningOverlay";
import { useLocalFaceCheck } from "@/hooks/useLocalFaceCheck";
import { useCameraTilt } from "@/hooks/useCameraTilt";
import QuietHoursBanner from "@/components/videocall/QuietHoursBanner";
import PickItemModal from "@/components/videocall/PickItemModal";
import GoalItemPicker from "@/components/videocall/GoalItemPicker";
import GoalProgressTracker from "@/components/videocall/GoalProgressTracker";
import LuckySpinWidget from "@/components/videocall/LuckySpinWidget";
import PowerHourCountdown from "@/components/videocall/PowerHourCountdown";
import AppDownloadPopup from "@/components/videocall/AppDownloadPopup";
import AppDownloadMiniBanner from "@/components/videocall/AppDownloadMiniBanner";

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
import dmIcon from "@/assets/videocall/dm-icon.png";

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
  const [femaleHasSlot, setFemaleHasSlot] = useState(false);
  const [femaleQueued, setFemaleQueued] = useState(false);
  const [femaleQueuePosition, setFemaleQueuePosition] = useState(0);
  
  const [showReportOverlay, setShowReportOverlay] = useState(false);
  const [showUnfreezePartnerPopup, setShowUnfreezePartnerPopup] = useState(false);
  const [voiceMode, setVoiceMode] = useState(() => {
    const gender = localStorage.getItem("user_gender");
    return gender === "female";
  });
  const [showQuickStart, setShowQuickStart] = useState(() => {
    return !sessionStorage.getItem("c24_quickstart_seen");
  });
  const [showSelfieCapture, setShowSelfieCapture] = useState(false);
  const [showPickItem, setShowPickItem] = useState(false);
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  const [showRedeemTooltip, setShowRedeemTooltip] = useState(false);
  const [cameraUnlockRequest, setCameraUnlockRequest] = useState<{ id: string; recipient_cut_cents: number } | null>(null);
  const [cameraUnlocked, setCameraUnlocked] = useState(false);
  const { data: unreadDmCount = 0 } = useUnreadCount();

  // Skip penalty state
  const [showSkipPenaltyPopup, setShowSkipPenaltyPopup] = useState(false);
  const [showMinuteLossToast, setShowMinuteLossToast] = useState(false);
  const skipPenaltyCountRef = useRef(0); // tracks how many times penalty shown
  const connectionStartRef = useRef<number | null>(null); // track when connection started
  const [showAppDownloadPopup, setShowAppDownloadPopup] = useState(false);
  const appDownloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showPromoAd, setShowPromoAd] = useState(false);
  const [overlayPage, setOverlayPage] = useState<"store" | "profile" | "topics" | "promo" | "vip" | "vip-settings" | "my-rewards" | "discover" | "messages" | "challenges" | null>(null);
  const [dmTargetId, setDmTargetId] = useState<string | undefined>(undefined);
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
  const { data: selfieData, refetch: refetchDiscoverable } = useQuery({
    queryKey: ["member_discoverable", memberId],
    enabled: memberId !== "anonymous",
    queryFn: async () => {
      const { data } = await supabase.from("members").select("image_url, image_thumb_url").eq("id", memberId).maybeSingle();
      return { hasImage: !!data?.image_url, imageUrl: data?.image_thumb_url || data?.image_url || null };
    }
  });
  const hasSelfie = selfieData?.hasImage ?? false;
  const mySelfieUrl = selfieData?.imageUrl ?? null;

  const needsSelfie = hasSelfie === false;

  const isFemale = memberGender?.toLowerCase() === "female";

  // Wishlist items count for female "Pick Item" feature
  const { data: wishlistCount = 0, refetch: refetchWishlist } = useQuery({
    queryKey: ["wishlist_count", memberId],
    enabled: memberId !== "anonymous" && isFemale,
    queryFn: async () => {
      const { count } = await supabase
        .from("wishlist_items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", memberId)
        .eq("status", "active");
      return count ?? 0;
    },
  });

  // Auto-show Goal Picker for new females (once) — after selfie completed, no goal yet
  useEffect(() => {
    if (!isFemale || memberId === "anonymous") return;
    if (!hasSelfie) return;
    if (wishlistCount > 0) return;
    const key = `c24_goal_picker_shown_${memberId}`;
    if (localStorage.getItem(key)) return;
    const t = setTimeout(() => {
      setShowGoalPicker(true);
      localStorage.setItem(key, "1");
    }, 1500);
    return () => clearTimeout(t);
  }, [isFemale, memberId, hasSelfie, wishlistCount]);

  const {
    callState,
    hasStartedMatchmaking,
    error,
    currentPartnerId,
    partnerVoiceMode,
    partnerGender,
    localVideoRef,
    remoteVideoRef,
    localStreamRef,
    startCall,
    next,
    stop,
    enableCamera,
    startPreview
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

  // Capture user's IP on load and store it in their member record (uses cached IP from check-ip-ban)
  useEffect(() => {
    if (!user) return;
    const cachedIp = sessionStorage.getItem("client_ip");
    if (cachedIp) {
      supabase.from("members").update({ last_ip: cachedIp } as any).eq("id", user.id).then(() => {});
    }
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

  const { isBlurred: isPreBlurred } = usePreBlur(callState === "connected", currentPartnerId, 4000);

  const { isNsfwBlurred, showConfirmPrompt, confirmBan, dismissStrikes } = useNsfwDetection({
    remoteVideoRef,
    isConnected: callState === "connected",
    userId: currentPartnerId || "",
    viewerUserId: memberId,
  });

  // Anti-flasher: ensure the local user keeps their face in frame
  const { noFaceWarning } = useLocalFaceCheck({
    localVideoRef,
    isActive: callState === "connected" && !(isFemale && voiceMode),
  });

  // Anti-flasher: detect downward camera tilt on mobile
  const { tiltWarning } = useCameraTilt({
    isActive: callState === "connected" && isMobile,
  });

  const localBehaviorWarning: "no-face" | "tilt" | null = noFaceWarning
    ? "no-face"
    : tiltWarning
      ? "tilt"
      : null;

  const anchorEarning = useAnchorEarning({
    userId: memberId,
    isOnCall: callState === "connected",
    isStarted: hasStartedMatchmaking,
    partnerGender: partnerGender,
  });

  const femaleEarning = isFemale && femaleHasSlot && !anchorEarning.verificationRequired;

  const {
    totalMinutes,
    giftedMinutes,
    elapsedSeconds,
    showCapPopup,
    capInfo,
    dismissCapPopup,
    flushMinutes,
    freezeInfo,
    refreshBalance: refreshMinutesBalance
  } = useCallMinutes({
    userId: memberId,
    partnerId: currentPartnerId || (femaleEarning && callState !== "idle" ? "queue" : null),
    isConnected: callState === "connected" || (femaleEarning && callState !== "idle"),
    voiceMode: isFemale ? voiceMode : false
  });

  const [showFrozenPopup, setShowFrozenPopup] = useState(false);
  const frozenPopupShownRef = useRef(false);

  // First-call welcome bonus (50/25/10 mins) — fires once per call after 30s connected
  useWelcomeBonus({
    userId: memberId,
    isConnected: callState === "connected",
    elapsedSeconds,
    onAwarded: () => {
      refreshMinutesBalance();
    },
  });

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

  // Speed Connect challenge: find active speed_connect challenge from DB
  const { data: speedConnectChallenge } = useQuery({
    queryKey: ["speed_connect_challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      const all = data || [];
      return all.find((c: any) => {
        try {
          const action = JSON.parse(c.auto_track_action || "null");
          return action?.type === "auto_speed_connect";
        } catch { return false; }
      }) || null;
    },
  });

  const speedConnectConfig = speedConnectChallenge ? (() => {
    try {
      const action = JSON.parse(speedConnectChallenge.auto_track_action || "null");
      return {
        challengeId: speedConnectChallenge.id,
        slug: speedConnectChallenge.slug || "speed-connect",
        targetPeople: action?.target || 20,
        timeLimitMinutes: speedConnectChallenge.target_minutes || 30,
      };
    } catch { return null; }
  })() : null;

  const speedConnect = useSpeedConnectChallenge({
    userId: user?.id,
    currentPartnerId,
    isConnected: callState === "connected",
    challengeConfig: speedConnectConfig,
  });

  const { vipTier, subscribed, startCheckout, openPortal, checkSubscription } = useVipStatus(user?.id ?? null);

  // Poll for gift/camera unlock updates without Realtime sockets
  useEffect(() => {
    if (memberId === "anonymous") return;

    const seenGiftIds = new Set<string>();
    const seenCameraStatuses = new Set<string>();
    let firstPoll = true;
    let firstCameraPoll = true;

    const pollUpdates = async () => {
      const { data: gifts } = await supabase
        .from("gift_transactions")
        .select("id, status, minutes_amount")
        .eq("recipient_id", memberId)
        .eq("status", "completed")
        .order("updated_at", { ascending: false })
        .limit(3);

      gifts?.forEach((gift: any) => {
        if (seenGiftIds.has(gift.id)) return;
        seenGiftIds.add(gift.id);
        // Skip toasts on first poll — those are old gifts
        if (firstPoll) return;
        const minutes = gift.minutes_amount || 0;
        const cashValue = (minutes * 0.01).toFixed(2);
        toast.success(`🎁 Someone gifted you ${minutes} minutes = $${cashValue}!`, {
          description: "Cash out via PayPal now!",
          action: {
            label: "Cash Out",
            onClick: () => setOverlayPage("my-rewards"),
          },
          duration: 10000,
        });
      });
      firstPoll = false;

      if (!isFemale) {
        const { data: requesterRows } = await supabase
          .from("camera_unlock_requests")
          .select("id, status")
          .eq("requester_id", memberId)
          .in("status", ["accepted", "declined"])
          .order("updated_at", { ascending: false })
          .limit(1);

        const req = requesterRows?.[0] as any;
        if (req) {
          const key = `${req.id}:${req.status}`;
          if (!seenCameraStatuses.has(key)) {
            seenCameraStatuses.add(key);
            if (!firstCameraPoll) {
              if (req.status === "accepted") {
                toast.success("📹 Camera unlocked! Your partner accepted.", { duration: 5000 });
                setCameraUnlocked(true);
              } else if (req.status === "declined") {
                toast("Partner declined the camera request. You'll be refunded.", { duration: 5000 });
              }
            }
          }
        }
      }

      if (isFemale && currentPartnerId) {
        const { data: recipientRows } = await supabase
          .from("camera_unlock_requests")
          .select("id, status, recipient_cut_cents, requester_id")
          .eq("recipient_id", memberId)
          .eq("status", "paid")
          .order("updated_at", { ascending: false })
          .limit(1);

        const req = recipientRows?.[0] as any;
        if (req && req.requester_id === currentPartnerId) {
          const key = `${req.id}:${req.status}`;
          if (!seenCameraStatuses.has(key)) {
            seenCameraStatuses.add(key);
            if (!firstCameraPoll) {
              setCameraUnlockRequest({
                id: req.id,
                recipient_cut_cents: req.recipient_cut_cents,
              });
            }
          }
        }
      }
      firstCameraPoll = false;
    };

    pollUpdates();
    const poll = setInterval(pollUpdates, 5000);

    return () => clearInterval(poll);
  }, [memberId, isFemale, currentPartnerId]);

  // Handle camera unlock verification from success page redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("camera_unlock") === "success") {
      toast.success("Payment verified! Waiting for partner to accept...", { duration: 5000 });
      window.history.replaceState({}, "", "/videocall");
    }
  }, []);

  // Show power hour countdown when arriving from email link
  const [showPowerHourCountdown, setShowPowerHourCountdown] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "power_hour") {
      setShowPowerHourCountdown(true);
      window.history.replaceState({}, "", "/videocall");
    }
  }, []);

  const { data: hideCarousel } = useQuery({
    queryKey: ["lucky-spin-carousel-setting"],
    queryFn: async () => {
      const { data } = await supabase.from("lucky_spin_settings").select("hide_carousel").limit(1).single();
      return data?.hide_carousel ?? false;
    },
    staleTime: 60000,
  });

  // Default voice mode ON for females on first load (they can toggle it off)
  useEffect(() => {
    if (isFemale && !voiceMode && !sessionStorage.getItem("c24_voice_mode_toggled")) {
      setVoiceMode(true);
    }
  }, [isFemale]);

  // Start camera preview on page load (before clicking START)
  const previewStartedRef = useRef(false);
  useEffect(() => {
    if (memberId !== "anonymous" && !previewStartedRef.current && !(isFemale && voiceMode)) {
      previewStartedRef.current = true;
      startPreview();
    }
  }, [memberId, isFemale, voiceMode, startPreview]);


  // Manage female anchor slot via backend queue/session logic
  // DISABLED: Anchor earning system is hidden/deactivated — no polling needed
  useEffect(() => {
    setFemaleHasSlot(false);
    setFemaleQueued(false);
    setFemaleQueuePosition(0);
  }, [isFemale, memberId]);

  // Listen for DM toast clicks to open messages overlay instead of navigating away
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setOverlayPage("messages");
    };
    window.addEventListener("open-dm-overlay", handler);
    return () => window.removeEventListener("open-dm-overlay", handler);
  }, []);

  // Pause the random chat stack before opening a direct call so camera/mic can be reused cleanly
  useEffect(() => {
    const handler = () => {
      setOverlayPage(null);
      stop();
    };

    window.addEventListener("prepare-direct-call", handler);
    return () => window.removeEventListener("prepare-direct-call", handler);
  }, [stop]);


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

  // Toast for females connected to same gender
  useEffect(() => {
    if (callState === "connected" && isFemale && partnerGender?.toLowerCase() === "female") {
      toast.info("You don't earn cashable minutes when connected to the same gender", {
        duration: 5000,
      });
    }
  }, [callState, isFemale, partnerGender]);

  // Auto-close Discover overlay when a match is found
  useEffect(() => {
    if (callState === "connected" && overlayPage === "discover") {
      setOverlayPage(null);
      toast("Match found! 🎉", { description: "You've been connected to someone!" });
    }
  }, [callState, overlayPage]);

  // Show app download popup after 7s of waiting
  useEffect(() => {
    if (callState === "waiting") {
      appDownloadTimerRef.current = setTimeout(() => {
        const shown = parseInt(localStorage.getItem("c24_app_popup_count") || "0", 10);
        const isAndroid = /android/i.test(navigator.userAgent);
        if (shown < 5 && isAndroid) {
          setShowAppDownloadPopup(true);
          localStorage.setItem("c24_app_popup_count", String(shown + 1));
        }
      }, 7000);
    } else {
      if (appDownloadTimerRef.current) {
        clearTimeout(appDownloadTimerRef.current);
        appDownloadTimerRef.current = null;
      }
      setShowAppDownloadPopup(false);
    }
    return () => {
      if (appDownloadTimerRef.current) clearTimeout(appDownloadTimerRef.current);
    };
  }, [callState]);

  // ─── Bestie Challenge: auto-track call time & screenshot ───
  const { data: activeBestiePair } = useQuery({
    queryKey: ["bestie_active_pair", memberId, currentPartnerId],
    enabled: !!memberId && !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      // Check if current partner is our bestie pair
      const { data } = await supabase
        .from("bestie_pairs")
        .select("*")
        .eq("status", "active")
        .or(`and(inviter_id.eq.${memberId},invitee_id.eq.${currentPartnerId}),and(inviter_id.eq.${currentPartnerId},invitee_id.eq.${memberId})`)
        .maybeSingle();
      return data;
    },
  });

  const bestieLoggedRef = useRef(false);
  const bestieScreenshotTakenRef = useRef(false);

  useEffect(() => {
    if (!activeBestiePair || callState !== "connected") {
      bestieLoggedRef.current = false;
      bestieScreenshotTakenRef.current = false;
      return;
    }

    // Log time every 30 seconds
    const logInterval = setInterval(() => {
      supabase.functions.invoke("bestie-call", {
        body: { action: "log_time", pair_id: activeBestiePair.id, seconds_to_add: 30 },
      }).catch(() => {});
    }, 30000);

    // Take screenshot at a random time between 5-20 mins into the call
    const screenshotDelay = (5 + Math.random() * 15) * 60 * 1000;
    const screenshotTimer = setTimeout(async () => {
      if (bestieScreenshotTakenRef.current) return;
      bestieScreenshotTakenRef.current = true;

      const role = activeBestiePair.inviter_id === memberId ? "inviter" : "invitee";
      const dayNumber = (activeBestiePair.days_completed || 0) + 1;

      // Capture local video
      if (localVideoRef.current) {
        const path = await captureBestieScreenshot(
          localVideoRef.current, memberId, activeBestiePair.id, dayNumber, role
        );
        if (path) {
          supabase.functions.invoke("bestie-call", {
            body: { action: "save_screenshot", pair_id: activeBestiePair.id, day_number: dayNumber, screenshot_path: path, role },
          }).catch(() => {});
        }
      }

      // Capture remote video too
      if (remoteVideoRef.current) {
        const partnerRole = role === "inviter" ? "invitee" : "inviter";
        const remotePath = await captureBestieScreenshot(
          remoteVideoRef.current, memberId, activeBestiePair.id, dayNumber, `${partnerRole}_from_${role}` as any
        );
        // Save remote screenshot as additional proof
        if (remotePath) {
          supabase.functions.invoke("bestie-call", {
            body: { action: "save_screenshot", pair_id: activeBestiePair.id, day_number: dayNumber, screenshot_path: remotePath, role: partnerRole },
          }).catch(() => {});
        }
      }
    }, screenshotDelay);

    return () => {
      clearInterval(logInterval);
      clearTimeout(screenshotTimer);
    };
  }, [activeBestiePair, callState, memberId]);

  // ─── Blue Eyes Hunt: track challenge + snap count ───
  const [blueEyesActive, setBlueEyesActive] = useState(localStorage.getItem("blue_eyes_hunt_started") === "true");
  const { data: blueEyesChallenge } = useQuery({
    queryKey: ["blue_eyes_challenge"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("slug", "blue-eyes-hunt")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
  });

  const { data: blueEyesSnaps = [], refetch: refetchBlueEyesSnaps } = useQuery({
    queryKey: ["blue_eyes_snaps", memberId, blueEyesChallenge?.id],
    enabled: !!memberId && !!blueEyesChallenge?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*")
        .eq("user_id", memberId)
        .eq("challenge_id", blueEyesChallenge!.id)
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  // ─── Generic Auto-Track: all auto challenges (marathon, girl power, etc.) ───
  const { data: autoChallenges = [] } = useQuery({
    queryKey: ["auto_challenges"],
    queryFn: async () => {
      const { data } = await supabase
        .from("weekly_challenges")
        .select("*")
        .eq("is_active", true)
        .eq("challenge_type", "auto")
        .not("target_minutes", "is", null);
      // Filter out speed-connect type challenges
      return (data || []).filter((c: any) => {
        try {
          const action = JSON.parse(c.auto_track_action || "null");
          return !action || action.type !== "auto_speed_connect";
        } catch { return true; }
      });
    },
  });

  const { data: autoSubmissions = [] } = useQuery({
    queryKey: ["auto_submissions", memberId, autoChallenges.map((c: any) => c.id).join(",")],
    enabled: !!memberId && autoChallenges.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("challenge_submissions")
        .select("*")
        .eq("user_id", memberId)
        .in("challenge_id", autoChallenges.map((c: any) => c.id));
      return data || [];
    },
  });

  const autoStartTimesRef = useRef<Record<string, number>>({});
  const autoPartnersRef = useRef<Record<string, string>>({});
  const autoSubmittedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (autoChallenges.length === 0 || !memberId) return;

    // Filter to challenges that are started, not yet submitted
    const activeChallenges = autoChallenges.filter((c: any) => {
      const startedKey = `${c.slug}_started`;
      const storageKey = `${c.slug}_minutes`;
      // Reset stale week progress
      resetIfStaleWeek(startedKey);
      resetIfStaleWeek(storageKey);
      const isStarted = localStorage.getItem(startedKey) === "true";
      const hasSubmission = autoSubmissions.some((s: any) => s.challenge_id === c.id);
      return isStarted && !hasSubmission && !autoSubmittedRef.current.has(c.id);
    });

    if (activeChallenges.length === 0) return;

    if (callState === "connected" && currentPartnerId) {
      // Initialize or reset timers per challenge
      for (const c of activeChallenges) {
        if (autoPartnersRef.current[c.id] !== currentPartnerId) {
          autoStartTimesRef.current[c.id] = Date.now();
          autoPartnersRef.current[c.id] = currentPartnerId;
          localStorage.setItem(`${c.slug}_minutes`, "0");
        }
        if (!autoStartTimesRef.current[c.id]) {
          autoStartTimesRef.current[c.id] = Date.now();
        }
      }

      const interval = setInterval(async () => {
        for (const c of activeChallenges) {
          if (!autoStartTimesRef.current[c.id] || autoSubmittedRef.current.has(c.id)) continue;
          const elapsedMin = Math.floor((Date.now() - autoStartTimesRef.current[c.id]) / 60000);
          localStorage.setItem(`${c.slug}_minutes`, String(elapsedMin));

          const target = c.target_minutes || 60;
          if (elapsedMin >= target && !autoSubmittedRef.current.has(c.id)) {
            autoSubmittedRef.current.add(c.id);

            const { error } = await supabase.from("challenge_submissions").insert({
              user_id: memberId,
              challenge_id: c.id,
              proof_text: `${c.title} completed: ${target}+ minutes continuous call`,
              status: "pending",
            });

            if (!error) {
              toast.success(`🎉 ${c.title} COMPLETE!`, {
                description: `${target}-minute call achieved! Submitted for review.`,
                duration: 8000,
              });
              localStorage.removeItem(`${c.slug}_minutes`);
            }
          }
        }
      }, 15000);

      return () => clearInterval(interval);
    } else {
      // Call disconnected — reset all timers
      for (const c of activeChallenges) {
        if (autoStartTimesRef.current[c.id]) {
          delete autoStartTimesRef.current[c.id];
          delete autoPartnersRef.current[c.id];
          localStorage.setItem(`${c.slug}_minutes`, "0");
        }
      }
    }
  }, [callState, currentPartnerId, autoChallenges, autoSubmissions, memberId]);

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
    refetchInterval: callState === "connected" ? 10000 : false,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_user_vip", { _user_id: currentPartnerId! });
      return data ?? false;
    }
  });

  // Check if partner is frozen
  const { data: partnerIsFrozen } = useQuery({
    queryKey: ["partner_is_frozen", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    queryFn: async () => {
      // Use admin-level RPC or security definer; for now frozen check isn't critical
      // member_minutes RLS blocks reading other users, so default to false
      return false;
    }
  });

  // Fetch partner's pinned socials — only show if partner is VIP
  const { data: partnerPinnedSocials = [] } = useQuery({
    queryKey: ["partner_pinned_socials", currentPartnerId],
    enabled: !!currentPartnerId && callState === "connected",
    refetchInterval: callState === "connected" ? 10000 : false,
    queryFn: async () => {
      // Check if partner is VIP using security definer function
      const { data: isVip } = await supabase.rpc("is_user_vip", { _user_id: currentPartnerId! });
      if (!isVip) return [];

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
    const currentSearch = window.location.search;
    const returnPath = currentSearch ? `/videocall${currentSearch}` : "/videocall";
    return <Navigate to={`/?returnTo=${encodeURIComponent(returnPath)}`} replace />;
  }

  // Redirect users who haven't completed onboarding (no gender set)
  if (!loading && user && memberGender === null && memberId !== "anonymous") {
    return <Navigate to="/?needsOnboarding=1" replace />;
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

    // Show a promo ad between skips — respect VIP setting
    const { data: vipSettings } = await supabase
      .from("vip_settings")
      .select("show_promo_ads")
      .eq("user_id", memberId)
      .maybeSingle();
    const promoAdsEnabled = vipSettings?.show_promo_ads ?? true;
    if (promoAdsEnabled) {
      setShowPromoAd(true);
    }

    next();
  };

  const handleBack = () => {
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

      {/* Quiet Hours Popup - DISABLED, using Call Me SMS alerts instead */}
      {/* <QuietHoursBanner userId={memberId} isSearching={callState === "waiting"} userGender={memberGender} /> */}

      {/* Video Area */}
      <div className="flex-1 flex flex-col md:flex-row gap-3 mx-3 mb-2 min-h-0 md:justify-center md:items-center md:max-w-4xl md:mx-auto md:w-full md:flex-none">
        {/* Local Video */}
        <div className="flex-1 md:flex-none md:w-[420px] md:aspect-[3/4] rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center">
          {!isActive &&
          <div className="absolute inset-0 z-10 bg-black/70 flex flex-col items-center justify-center gap-3">
              <img src={c24Logo} alt="C24 Club" className="w-48 md:w-56 drop-shadow-lg" />
              
              {/* Voice Mode indicator - females always in voice mode */}
              {isFemale &&
            <button
              onClick={() => {
                setVoiceMode(!voiceMode);
                sessionStorage.setItem("c24_voice_mode_toggled", "true");
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all shadow-lg ${
                voiceMode
                  ? "bg-pink-600 text-white shadow-pink-500/30"
                  : "bg-neutral-700 text-neutral-300 shadow-neutral-800/30"
              }`}
            >
              <span>🎙️</span>
              <span>Voice Mode {voiceMode ? "ON" : "OFF"}</span>
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

          {/* Voice mode: show avatar + earning tip instead of local video (desktop only) */}
          {!isMobile && isFemale && voiceMode && isActive &&
          <div className="absolute inset-0 z-10 bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center px-4">
              <div className="w-20 h-20 md:w-28 md:h-28 rounded-full bg-gradient-to-br from-pink-500/30 to-purple-600/30 border-2 border-pink-500/40 flex items-center justify-center mb-3 overflow-hidden">
                {mySelfieUrl ? (
                  <img src={mySelfieUrl} alt="You" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl md:text-5xl">🎙️</span>
                )}
              </div>
              <span className="text-pink-400 text-xs font-bold mb-2">Voice Mode Active</span>
              <div className="bg-green-900/40 border border-green-500/30 rounded-lg px-3 py-2 max-w-[280px] text-center">
                <p className="text-green-400 text-[11px] font-bold">💰 Guys pay to see you!</p>
                <p className="text-neutral-400 text-[10px] mt-0.5">Chat & have fun to get more camera unlock requests and earn a cut. Just tell him "if you want to see me click unlock camera"</p>
              </div>
            </div>
          }

          {/* Partner video (big box) on mobile, local video on desktop */}
          {isMobile ?
          <>
              {partnerVoiceMode && callState === "connected" &&
            <VoiceModeAvatar videoRef={remoteVideoRef} partnerId={currentPartnerId} className="z-20 absolute inset-0" />
            }
              <video ref={remoteVideoRef} autoPlay playsInline
            className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" && !partnerVoiceMode ? "opacity-100" : "opacity-0 pointer-events-none"} ${isPreBlurred || isNsfwBlurred ? "blur-[30px] transition-[filter] duration-500" : "transition-[filter] duration-500"}`} />
              {partnerBlackScreen && callState === "connected" && !partnerVoiceMode &&
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
          className={`absolute inset-0 w-full h-full object-cover ${isFemale && voiceMode && isActive ? "hidden" : "block"}`} />
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
                <LuckySpinWidget isWaiting={callState === "waiting"} onOpenMyRewards={() => setOverlayPage("my-rewards")} />
                {hideCarousel && (
                  <button
                    onClick={() => setOverlayPage("discover")}
                    className="mt-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-full transition-colors"
                  >
                    {memberGender === "Female" ? "View Guys On Discover" : "View Girls On Discover"}
                  </button>
                )}
                {!hideCarousel && (
                  <DiscoverTeaser
                    myGender={memberGender ?? null}
                    myUserId={memberId}
                    onOpenDiscover={() => setOverlayPage("discover")}
                    onOpenStore={() => setOverlayPage("store")}
                    onOpenMessages={() => setOverlayPage("messages")}
                    onDmUser={(id) => { setDmTargetId(id); setOverlayPage("messages"); }}
                  />
                )}
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

          {/* Camera Unlock Button - mobile, shows when partner is in voice mode */}
          {callState === "connected" && partnerVoiceMode && !isFemale && currentPartnerId && !cameraUnlocked && isMobile &&
          <div className="absolute bottom-14 left-3 z-20">
              <CameraUnlockButton recipientId={currentPartnerId} />
            </div>
          }

          {/* Blue Eyes Hunt snap button (only if hunt started) */}
          {callState === "connected" && currentPartnerId && blueEyesChallenge && blueEyesSnaps.length < 2 && blueEyesActive &&
          <div className={`absolute z-20 ${isMobile ? "bottom-3 left-1/2 -translate-x-1/2" : "bottom-3 left-1/2 -translate-x-1/2"}`}>
              <BlueEyesSnapButton
                remoteVideoRef={remoteVideoRef}
                userId={memberId}
                challengeId={blueEyesChallenge.id}
                snapsCount={blueEyesSnaps.length}
                maxSnaps={2}
                onSnapTaken={() => refetchBlueEyesSnaps()}
                onDisable={() => setBlueEyesActive(false)}
              />
            </div>
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
            <div className="w-full h-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex flex-col items-center justify-center overflow-hidden">
                  <span className="text-2xl">🎙️</span>
                  <span className="text-pink-400 text-[7px] font-bold">Voice Mode</span>
                </div> :

            <video ref={localVideoRef} autoPlay muted playsInline
            className="w-full h-full object-cover block" style={{ transform: "scaleX(-1)" }} />
            }
              {callState !== "connected" && callState !== "idle" &&
            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-neutral-800/60">
                  <p className="text-neutral-300 text-[10px] text-center px-1">
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
          <VoiceModeAvatar videoRef={remoteVideoRef} partnerId={currentPartnerId} className="z-20" />
          }
            <video ref={remoteVideoRef} autoPlay playsInline
          className={`absolute inset-0 w-full h-full object-cover ${callState === "connected" && !partnerVoiceMode ? "block" : "hidden"} ${isPreBlurred || isNsfwBlurred ? "blur-[30px] transition-[filter] duration-500" : "transition-[filter] duration-500"}`} />
            {partnerBlackScreen && callState === "connected" && !partnerVoiceMode &&
          <div className="absolute inset-0 z-30 bg-black flex flex-col items-center justify-center pointer-events-none">
                <span className="text-4xl">📵</span>
                <p className="text-white font-black text-sm mt-2">PARTNER IS FACELESS</p>
                <p className="text-neutral-400 text-xs text-center px-6 mt-1">Their camera is off or covered. Press Next to skip.</p>
              </div>
          }
            {localBlackScreen && callState === "connected" && !partnerBlackScreen &&
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
                  {callState === "waiting" && <>
                    <LuckySpinWidget isWaiting={callState === "waiting"} onOpenMyRewards={() => setOverlayPage("my-rewards")} />
                    {hideCarousel && (
                      <button
                        onClick={() => setOverlayPage("discover")}
                        className="mt-2 px-4 py-2 bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold rounded-full transition-colors"
                      >
                        {memberGender === "Female" ? "View Guys On Discover" : "View Girls On Discover"}
                      </button>
                    )}
                    {!hideCarousel && (
                      <DiscoverTeaser
                        myGender={memberGender ?? null}
                        myUserId={memberId}
                        onOpenDiscover={() => setOverlayPage("discover")}
                        onOpenStore={() => setOverlayPage("store")}
                        onOpenMessages={() => setOverlayPage("messages")}
                        onDmUser={(id) => { setDmTargetId(id); setOverlayPage("messages"); }}
                      />
                    )}
                  </>}
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
            {/* Camera Unlock Button - desktop, shows when partner is in voice mode */}
            {callState === "connected" && partnerVoiceMode && !isFemale && currentPartnerId && !cameraUnlocked &&
          <div className="absolute bottom-14 left-2 z-20">
                <CameraUnlockButton recipientId={currentPartnerId} />
              </div>
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

      {/* Female "Pick an Item" button — below video boxes */}
      {/* Mini app download banner for male Android users on idle screen */}
      {!isActive && (
        <AppDownloadMiniBanner userId={memberId} gender={memberGender} />
      )}

      {!showRedeem && isFemale && wishlistCount < 3 && (
        <div className="px-3 py-2">
          {wishlistCount === 0 ? (
            <div className="flex justify-center">
              <button
                onClick={() => setShowGoalPicker(true)}
                className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-lg flex items-center gap-2 animate-pulse"
              >
                💎 Pick Your Dream Reward
              </button>
            </div>
          ) : (
            <GoalProgressTracker
              userId={memberId}
              totalMinutes={totalMinutes}
              onClick={() => isActive ? setOverlayPage("store") : navigate("/store")}
            />
          )}
        </div>
      )}

      {/* Panels */}
      {showRedeem ?
      <div className="px-3 pb-4">
          <RedeemPanel totalMinutes={totalMinutes} onClose={() => setShowRedeem(false)} />
        </div> : <>
      <div className={`transition-all duration-300 ${isMobile && mobileNavHidden ? "max-h-0 overflow-hidden opacity-0 pointer-events-none" : "max-h-[300px] opacity-100 overflow-visible"} md:max-h-none md:opacity-100 md:overflow-visible`}>
          <div className="flex justify-center gap-5 md:gap-10 px-4 pt-2 pb-3 flex-wrap">
            <div className="relative flex flex-col items-center">
              {showRedeemTooltip && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-[9999] whitespace-nowrap">
                  <div className="bg-pink-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg animate-bounce">
                    Tap to view your goals!
                    <div className="absolute left-1/2 -translate-x-1/2 -bottom-1.5 w-3 h-3 bg-pink-500 rotate-45" />
                  </div>
                </div>
              )}
              <NavIcon src={storeIcon} label="REDEEM" onClick={() => { setShowRedeemTooltip(false); isActive ? setOverlayPage("store") : navigate("/store"); }} shake={showRedeemTooltip} />
            </div>
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
      </>}

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
      {overlayPage === "messages" &&
      <FullScreenOverlay onClose={() => { setDmTargetId(undefined); setOverlayPage(null); }}>
          <MessagesPage onClose={() => { setDmTargetId(undefined); setOverlayPage(null); }} initialPartnerId={dmTargetId} />
        </FullScreenOverlay>
      }
      {overlayPage === "challenges" &&
      <FullScreenOverlay onClose={() => setOverlayPage(null)}>
          <WeeklyChallengesPage onClose={() => setOverlayPage(null)} />
        </FullScreenOverlay>
      }

      {/* App Download Popup (after 7s waiting) */}
      {showAppDownloadPopup && <AppDownloadPopup onClose={() => setShowAppDownloadPopup(false)} userId={memberId} />}

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
        onPurchaseVip={async () => {
          const { VIP_TIERS } = await import("@/config/vip-tiers");
          void startCheckout(VIP_TIERS.basic.price_id);
        }}
        isFemale={isFemale} />

      }

      {/* Power Hour Countdown Popup */}
      {showPowerHourCountdown && (
        <PowerHourCountdown
          onDismiss={() => setShowPowerHourCountdown(false)}
          isFemale={isFemale}
        />
      )}

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
                  window.location.href = data.url;
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
      
      {/* Camera Consent Modal */}
      {cameraUnlockRequest && (
        <CameraConsentModal
          requestId={cameraUnlockRequest.id}
          recipientCutCents={cameraUnlockRequest.recipient_cut_cents}
          onAccept={() => {
            setCameraUnlockRequest(null);
            setCameraUnlocked(true);
            setVoiceMode(false);
            enableCamera();
          }}
          onDecline={() => setCameraUnlockRequest(null)}
        />
      )}
      
      {/* Mandatory Selfie Capture Modal */}
      <SelfieCaptureModal
        open={showSelfieCapture}
        onClose={() => setShowSelfieCapture(false)}
        onComplete={() => {
          setShowSelfieCapture(false);
          refetchDiscoverable();
        }} />
      {/* Pick Item Modal for females */}
      <PickItemModal
        open={showPickItem}
        onClose={() => setShowPickItem(false)}
        userId={memberId}
        currentItemCount={wishlistCount}
        maxItems={3}
        onItemAdded={() => {
          refetchWishlist();
          if (!localStorage.getItem("c24_redeem_tooltip_shown")) {
            localStorage.setItem("c24_redeem_tooltip_shown", "1");
            // On mobile, expand nav so tooltip is visible
            if (isMobile) setMobileNavHidden(false);
            setTimeout(() => {
              setShowRedeemTooltip(true);
              setTimeout(() => setShowRedeemTooltip(false), 8000);
            }, 500);
          }
        }}
      />
      {/* Goal Item Picker — auto-shown to new females */}
      <GoalItemPicker
        open={showGoalPicker}
        onClose={() => setShowGoalPicker(false)}
        userId={memberId}
        onItemAdded={() => {
          refetchWishlist();
          queryClient.invalidateQueries({ queryKey: ["goal_tracker_item", memberId] });
        }}
      />
      {/* NSFW Confirm Overlay */}
      {showConfirmPrompt && (
        <NsfwConfirmOverlay
          onConfirmBan={confirmBan}
          onDismiss={dismissStrikes}
        />
      )}
      
    </div>);

};

export default VideoCallPage;