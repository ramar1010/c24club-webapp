import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import appPreviewMale from "@/assets/app-promo/app-preview-with-badges.jpeg";
import appPreviewFemale from "@/assets/app-promo/app-preview-female-v2.jpeg";
import appStoreBadge from "@/assets/app-promo/app-store-badge.png";
import googlePlayBadge from "@/assets/app-promo/google-play-badge.svg";

interface AppDownloadPopupProps {
  onClose: () => void;
  userId?: string;
  gender?: string | null;
  /** Where in the flow the popup is being shown — e.g. "quiet_waiting_room" or "after_skip_no_match". */
  context?: string;
  /** Whether the device is mobile. Desktop gets a "Browse Discover" variant. */
  isMobile?: boolean;
  /** Called when desktop user chooses "Browse Discover while you wait". */
  onBrowseDiscover?: () => void;
}

const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.c24club.app&hl=en_US";
const IOS_APP_URL =
  "https://apps.apple.com/us/app/c24-club/id6766305883";

const AppDownloadPopup = ({
  onClose,
  userId,
  gender,
  context = "quiet_waiting_room",
  isMobile = true,
  onBrowseDiscover,
}: AppDownloadPopupProps) => {
  const isFemale = (gender || "").toLowerCase() === "female";
  const appPreview = isFemale ? appPreviewFemale : appPreviewMale;

  // Record a "shown" row on mount; remember its id so we can later mark
  // clicked/dismissed for accurate click-through reporting.
  const shownIdRef = useRef<string | null>(null);
  const outcomeRef = useRef<"clicked" | "dismissed" | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || userId === "anonymous") return;
    let cancelled = false;
    supabase
      .from("app_download_clicks")
      .insert({ user_id: userId, source: null, context, clicked: false, dismissed: false })
      .select("id")
      .single()
      .then(({ data }) => {
        if (!cancelled && data?.id) {
          shownIdRef.current = data.id;
          setShownId(data.id);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, context]);

  const handleDownloadClick = (source: string) => {
    outcomeRef.current = "clicked";
    if (!userId || userId === "anonymous") return;
    if (shownIdRef.current) {
      supabase
        .from("app_download_clicks")
        .update({ source, clicked: true })
        .eq("id", shownIdRef.current)
        .then(() => {});
    } else {
      // Fallback if the shown-row insert hadn't finished yet.
      supabase
        .from("app_download_clicks")
        .insert({ user_id: userId, source, context, clicked: true })
        .then(() => {});
    }
  };

  const handleClose = () => {
    if (outcomeRef.current !== "clicked" && shownIdRef.current && userId && userId !== "anonymous") {
      supabase
        .from("app_download_clicks")
        .update({ dismissed: true, dismissed_at: new Date().toISOString() })
        .eq("id", shownIdRef.current)
        .then(() => {});
    }
    onClose();
  };

  const handleBrowseDiscover = () => {
    handleDownloadClick("popup-browse-discover");
    onBrowseDiscover?.();
    onClose();
  };

  return (
  <div className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-sm flex items-center justify-center px-4">
    <div className="relative bg-neutral-900 border border-white/10 rounded-2xl p-5 max-w-sm w-full text-center shadow-[0_0_40px_rgba(234,179,8,0.25)] max-h-[90vh] overflow-y-auto animate-scale-in">
      {/* Close */}
      <button
        onClick={handleClose}
        className="absolute top-3 right-3 bg-neutral-800 hover:bg-neutral-700 rounded-full p-1.5 transition-colors z-10"
      >
        <X className="w-5 h-5 text-white" />
      </button>

      {/* Floating emoji decorations */}
      <span className="absolute -top-3 -left-3 text-3xl animate-bounce" style={{ animationDuration: "2s" }}>🔔</span>
      <span className="absolute -top-3 -right-3 text-3xl animate-bounce" style={{ animationDuration: "2.5s", animationDelay: "0.3s" }}>📲</span>
      <span className="absolute -bottom-3 left-6 text-2xl animate-bounce" style={{ animationDuration: "1.8s", animationDelay: "0.6s" }}>🎉</span>
      <span className="absolute -bottom-3 right-6 text-2xl animate-bounce" style={{ animationDuration: "2.2s", animationDelay: "0.9s" }}>✨</span>

      {/* Text */}
      <div className="mb-4 mt-1">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" />
          <h2 className="text-white font-black text-xl uppercase tracking-wide">
            🤫 It's Quiet Here!
          </h2>
          <Sparkles className="w-5 h-5 text-yellow-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
        <p className="text-orange-400 font-bold text-sm mb-1 animate-pulse" style={{ animationDuration: "3s" }}>
          🔥 Everyone is on our App! 🔥
        </p>
        <p className="text-neutral-300 text-sm leading-relaxed">
          Get Notified Instantly When A Female/Male is searching!
        </p>
        <p className="text-yellow-400 font-bold text-sm mt-2 animate-pulse" style={{ animationDuration: "2.5s" }}>
          ⚡ Get Our App To Get Notified Instantly for FREE! 🔔
        </p>
      </div>

      {/* CTA buttons with store badges */}
      {isMobile ? (
        <div className="flex gap-3 mb-4">
        <a
          href={IOS_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleDownloadClick("popup-ios")}
          className="flex-1 rounded-xl overflow-hidden transition-all hover:scale-105 duration-300 shadow-[0_0_15px_rgba(161,161,170,0.3)] hover:shadow-[0_0_25px_rgba(161,161,170,0.5)]"
        >
          <img
            src={appStoreBadge}
            alt="Download on the App Store"
            className="w-full h-auto"
          />
        </a>
        <a
          href={GOOGLE_PLAY_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleDownloadClick("popup-android")}
          className="flex-1 rounded-xl overflow-hidden transition-all hover:scale-105 duration-300 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)]"
        >
          <img
            src={googlePlayBadge}
            alt="Get it on Google Play"
            className="w-full h-auto"
          />
        </a>
        </div>
      ) : (
        <div className="mb-4">
          <button
            onClick={handleBrowseDiscover}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-bold uppercase tracking-wide hover:scale-[1.02] transition-transform shadow-[0_0_20px_rgba(234,179,8,0.4)]"
          >
            <Users className="w-5 h-5" />
            Browse Discover While You Wait
          </button>
          <p className="text-neutral-400 text-xs mt-2">
            Send a gift or DM members from Discover — we'll keep you in the queue.
          </p>
        </div>
      )}

      {/* App preview image with glow */}
      <div className="block rounded-xl overflow-hidden border border-yellow-500/30 shadow-[0_0_20px_rgba(234,179,8,0.2)]">
        <img
          src={appPreview}
          alt="C24Club App Preview"
          className="w-full h-auto"
        />
      </div>
    </div>
  </div>
  );
};

export default AppDownloadPopup;