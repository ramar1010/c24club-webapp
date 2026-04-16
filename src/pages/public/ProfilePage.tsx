import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import EventsPage from "@/pages/public/EventsPage";
import VipSettingsOverlay from "@/components/videocall/VipSettingsOverlay";
import eventsIcon from "@/assets/profile/slot-machine.png";
import myRewardsIcon from "@/assets/profile/rewards-gift.png";
import vipSettingsIcon from "@/assets/profile/vip-rocket.png";
import challengesIcon from "@/assets/profile/challenges-icon.png";
import becomeVipIcon from "@/assets/profile/vip-settings-icon.png";
import settingsIcon from "@/assets/profile/settings-gear.png";
import rulebookIcon from "@/assets/profile/rulebook-book.png";
import challengesPin from "@/assets/profile/challenges-pin.png";
import challengesTarget from "@/assets/profile/challenges-target.png";
import logoutIcon from "@/assets/profile/logout-icon.png";

const ProfilePage = ({ onClose }: { onClose?: () => void }) => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showEvents, setShowEvents] = useState(false);
  const [eventsInitialView, setEventsInitialView] = useState<"hub" | "spin" | "challenges">("hub");
  const [showVipSettings, setShowVipSettings] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((s) => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      })
      .catch(() => {});
    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const { data: balance } = useQuery({
    queryKey: ["profile-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("earn-minutes", {
        body: { type: "get_balance", userId: user!.id },
      });
      return { minutes: data?.totalMinutes ?? 0, adPoints: data?.adPoints ?? 0, productPoints: data?.productPoints ?? 0 };
    },
  });

  // Fetch real chance enhancer
  const { data: ceData } = useQuery({
    queryKey: ["profile-chance-enhancer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("spin-wheel", {
        body: { type: "get_chance_enhancer", userId: user!.id },
      });
      return data || { chance_enhancer: 10, is_vip: false };
    },
  });

  // Check true VIP status (includes admin-granted)
  const { data: isVip } = useQuery({
    queryKey: ["profile-is-vip", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.rpc("is_user_vip", { _user_id: user!.id });
      return data ?? false;
    },
  });

  const chanceEnhancer = ceData?.chance_enhancer ?? 10;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (showVipSettings && user) {
    return (
      <VipSettingsOverlay
        onClose={() => setShowVipSettings(false)}
        userId={user.id}
        vipTier={isVip ? (ceData?.vip_tier === "premium" ? "premium" : "basic") : null}
        genderFilter="everyone"
        onGenderFilterChange={() => {}}
      />
    );
  }

  if (showEvents) {
    return <EventsPage onClose={() => setShowEvents(false)} initialView={eventsInitialView} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button
          onClick={() => onClose ? onClose() : navigate("/videocall")}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Avatar - Live Camera */}
      <div className="mt-4 mb-6">
        <div className="w-20 h-20 rounded-full border-2 border-neutral-600 overflow-hidden bg-neutral-800">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover scale-x-[-1]"
          />
        </div>
      </div>

      {/* Title / Enhancer */}
      <div className="text-center mb-2">
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 inline-flex items-center gap-2">
          <span className="text-orange-400 text-sm font-black">
            🔥 {Math.round(chanceEnhancer)}% Chance Enhancer
          </span>
          {isVip && (
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">VIP</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <p className="text-sm font-bold text-neutral-300 mb-8">
        {balance?.minutes ?? 0} Minutes | {balance?.adPoints ?? 0} Ad Points
      </p>

      {/* Row 1: Events, My Rewards, VIP Settings */}
      <div className="flex justify-center gap-8 mb-8">
        <IconButton src={eventsIcon} label="EVENTS" onClick={() => { setEventsInitialView("hub"); setShowEvents(true); }} />
        <IconButton src={myRewardsIcon} label="MY REWARDS" onClick={() => navigate("/my-rewards")} />
        <IconButton src={vipSettingsIcon} label="VIP SETTINGS" onClick={isVip ? () => setShowVipSettings(true) : undefined} disabled={!isVip} />
      </div>

      {/* Become VIP */}
      <button 
        onClick={() => navigate("/videocall")}
        className="relative w-full max-w-sm mb-8 rounded-2xl p-5 flex items-center justify-center gap-3 hover:scale-[1.02] transition-all shadow-lg shadow-yellow-500/30 border border-white/10 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #f97316, #ec4899, #8b5cf6, #3b82f6, #06b6d4)" }}
      >
        {/* Floating emojis */}
        <span className="absolute text-lg animate-bounce" style={{ top: '8%', left: '8%', animationDelay: '0s', animationDuration: '2s' }}>🎉</span>
        <span className="absolute text-lg animate-bounce" style={{ top: '12%', right: '10%', animationDelay: '0.5s', animationDuration: '2.5s' }}>⭐</span>
        <span className="absolute text-sm animate-bounce" style={{ bottom: '10%', left: '15%', animationDelay: '1s', animationDuration: '1.8s' }}>🔥</span>
        <span className="absolute text-sm animate-bounce" style={{ bottom: '8%', right: '12%', animationDelay: '0.3s', animationDuration: '2.2s' }}>💎</span>
        <span className="absolute text-xs animate-bounce" style={{ top: '40%', left: '3%', animationDelay: '0.7s', animationDuration: '2.8s' }}>🚀</span>
        <span className="absolute text-xs animate-bounce" style={{ top: '35%', right: '4%', animationDelay: '1.2s', animationDuration: '2.1s' }}>👑</span>

        <div className="flex flex-col items-center z-10">
          <span className="font-black text-xl tracking-wider">BECOME VIP</span>
          <span className="text-xs font-bold text-white/80">Unlock exclusive rewards & features ✨</span>
        </div>
      </button>

      {/* How To Guide */}
      <button
        onClick={() => navigate("/how-to-guide")}
        className="font-black text-base underline underline-offset-4 decoration-2 mb-8 hover:opacity-80 transition-opacity tracking-wide"
      >
        How To Guide
      </button>

      {/* Row 2: Settings, Rulebook, Logout */}
      <div className="flex justify-center gap-8 mb-8">
        <IconButton src={settingsIcon} label="SETTINGS" onClick={() => navigate("/settings")} />
        <IconButton src={rulebookIcon} label="RULEBOOK" onClick={() => navigate("/rules")} />
        <IconButton src={logoutIcon} label="LOGOUT" onClick={handleLogout} />
      </div>

      {/* Unlock Rewards Early */}
      <button className="w-full max-w-xs bg-gradient-to-r from-red-600 to-orange-500 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg mb-6 tracking-wide">
        Unlock Rewards Early
      </button>

      {/* Footer Links */}
      <div className="flex items-center gap-2 text-xs text-neutral-400 font-bold">
        <a href="/terms" className="hover:text-white transition-colors">Terms</a>
        <span>|</span>
        <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
        <span>|</span>
        <a href="/rules" className="hover:text-white transition-colors">Rules</a>
        <span>|</span>
        <a href="/how-to-guide" className="hover:text-white transition-colors">How To Guide</a>
      </div>
    </div>
  );
};

const IconButton = ({
  src,
  label,
  onClick,
  disabled,
}: {
  src: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`flex flex-col items-center gap-1 transition-transform ${disabled ? "opacity-40 cursor-not-allowed" : "hover:scale-110"}`}
  >
    <img src={src} alt={label} className="w-14 h-14 object-contain" />
    <span className="text-[10px] font-black tracking-wider text-center leading-tight">
      {label}
    </span>
  </button>
);

export default ProfilePage;
