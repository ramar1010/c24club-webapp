import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import EventsPage from "@/pages/public/EventsPage";
import LoginStreakDisplay from "@/components/profile/LoginStreakDisplay";
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

  const chanceEnhancer = ceData?.chance_enhancer ?? 10;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (showEvents) {
    return <EventsPage onClose={() => setShowEvents(false)} />;
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
          {ceData?.is_vip && (
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">VIP</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <p className="text-sm font-bold text-neutral-300 mb-8">
        {balance?.minutes ?? 0} Minutes | {balance?.adPoints ?? 0} Ad Points | {balance?.productPoints ?? 0} Product Points
      </p>

      {/* Row 1: Events, My Rewards, VIP Settings */}
      <div className="flex justify-center gap-8 mb-8">
        <IconButton src={eventsIcon} label="EVENTS" onClick={() => setShowEvents(true)} />
        <IconButton src={myRewardsIcon} label="MY REWARDS" onClick={() => navigate("/my-rewards")} />
        <IconButton src={vipSettingsIcon} label="VIP SETTINGS" />
      </div>

      {/* Feature Cards */}
      <div className="flex gap-4 w-full max-w-sm mb-8">
        {/* Weekly Challenges */}
        <button className="flex-1 bg-gradient-to-b from-green-600 to-green-800 rounded-2xl p-4 flex flex-col items-center gap-2 hover:opacity-90 transition-opacity border border-green-500/30">
          <span className="font-black text-sm tracking-wide text-center leading-tight">
            WEEKLY<br />CHALLENGES
          </span>
          <div className="flex gap-2 items-center">
            <img src={challengesPin} alt="Pin" className="w-10 h-10 object-contain" />
            <img src={challengesTarget} alt="Target" className="w-10 h-10 object-contain" />
          </div>
          <span className="text-xs font-bold text-green-200">Faster Rewards</span>
        </button>

        {/* Become VIP */}
        <button 
          onClick={() => navigate("/videocall")}
          className="flex-1 bg-gradient-to-b from-blue-600 to-blue-800 rounded-2xl p-4 flex flex-col items-center gap-2 hover:opacity-90 transition-opacity border border-blue-500/30"
        >
          <span className="font-black text-sm tracking-wide text-center leading-tight">
            BECOME VIP
          </span>
          <img src={becomeVipIcon} alt="Become VIP" className="w-12 h-12 object-contain" />
          <span className="text-xs font-bold text-blue-200">More Rewards</span>
        </button>
      </div>

      {/* FAQ */}
      <button
        onClick={() => navigate("/faq")}
        className="font-black text-base underline underline-offset-4 decoration-2 mb-8 hover:opacity-80 transition-opacity tracking-wide"
      >
        Frequently Asked Questions
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
        <a href="/faq" className="hover:text-white transition-colors">FAQ</a>
      </div>
    </div>
  );
};

const IconButton = ({
  src,
  label,
  onClick,
}: {
  src: string;
  label: string;
  onClick?: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-1 hover:scale-110 transition-transform"
  >
    <img src={src} alt={label} className="w-14 h-14 object-contain" />
    <span className="text-[10px] font-black tracking-wider text-center leading-tight">
      {label}
    </span>
  </button>
);

export default ProfilePage;
