import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";

import c24Logo from "@/assets/videocall/c24-logo.png";
import nextBtn from "@/assets/videocall/next-btn.png";
import storeIcon from "@/assets/videocall/store.png";
import redeemIcon from "@/assets/videocall/redeem.png";
import topicsIcon from "@/assets/videocall/topics-bubble.png";
import promoIcon from "@/assets/videocall/promo-star.png";
import profileIcon from "@/assets/videocall/profile-avatar.png";
import vipIcon from "@/assets/videocall/vip-rocket.png";

type GenderFilter = "girls" | "both" | "guys";

const VideoCallPage = () => {
  const navigate = useNavigate();
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("both");
  const [isConnected, setIsConnected] = useState(false);
  const [minutes] = useState(10);
  const [adPoints] = useState(40);
  const [rewardDropMinutes] = useState(50);

  const handleStart = () => {
    setIsConnected(true);
  };

  const handleNext = () => {
    // Will trigger next match via signaling server
    setIsConnected(false);
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col">
      {/* Top Stats Bar */}
      <div className="flex items-center justify-between px-4 py-2 relative z-10">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>

        <div className="text-center">
          <div className="flex items-center justify-center gap-1.5 text-lg font-bold">
            <span className="text-xl">🪙</span>
            <span>{minutes} Minutes</span>
          </div>
          <div className="flex items-center justify-center gap-1 text-sm text-yellow-400">
            <span>⭐</span>
            <span>{adPoints} Ad Points</span>
          </div>
        </div>

        <div className="w-11" /> {/* Spacer for centering */}
      </div>

      {/* Video Panels */}
      <div className="flex flex-col md:flex-row gap-3 px-4 pb-2 justify-center max-w-3xl mx-auto w-full">
        {/* User Video (Left / Top) */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center h-[260px] md:h-[330px] w-full md:w-[400px]">
          {!isConnected && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={c24Logo}
                alt="C24 Club"
                className="w-40 md:w-48 drop-shadow-lg"
              />
              <p className="text-[10px] text-neutral-400 -mt-1">The Omegle That Rewards You!</p>
              <button
                onClick={handleStart}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-8 py-2 rounded-lg transition-colors shadow-lg"
              >
                START
              </button>
              <span className="text-neutral-500 text-[10px] tracking-wide">C24CLUB.COM</span>
            </div>
          )}

          {isConnected && (
            <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
              <p className="text-neutral-500 text-sm">Your camera</p>
            </div>
          )}
        </div>

        {/* Remote Video (Right / Bottom) */}
        <div className="rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center h-[220px] md:h-[280px] w-full md:w-[340px]">
          <div className="flex items-center justify-center h-full">
            <p className="text-neutral-600 text-sm">
              {isConnected ? "Connecting..." : "Partner video"}
            </p>
          </div>

          {/* NEXT Button - always visible like in screenshot */}
          <button
            onClick={handleNext}
            className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-3 py-1.5 transition-colors z-10"
          >
            <span className="font-bold text-sm">NEXT</span>
            <img src={nextBtn} alt="Next" className="w-9 h-9" />
          </button>
        </div>
      </div>

      {/* Reward Drop Timer */}
      <div className="text-center py-4">
        <p className="text-base font-bold tracking-wide">
          NEXT REWARD DROP IN{" "}
          <span className="text-yellow-400">{rewardDropMinutes} MINUTES!</span>
        </p>
      </div>

      {/* Quick Nav Icons */}
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 px-4 pb-4">
        <NavIcon src={storeIcon} label="STORE" />
        <NavIcon src={redeemIcon} label="REDEEM" />
        <NavIcon src={topicsIcon} label="TOPICS" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 px-4 pb-5">
        <NavIcon src={promoIcon} label="PROMO" />
        <NavIcon src={profileIcon} label="PROFILE" />
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
    </div>
  );
};

const NavIcon = ({ src, label }: { src: string; label: string }) => (
  <button className="flex flex-col items-center gap-1.5 hover:scale-110 transition-transform">
    <img src={src} alt={label} className="w-16 h-16 object-contain" />
    <span className="text-xs font-bold tracking-wider">{label}</span>
  </button>
);

export default VideoCallPage;
