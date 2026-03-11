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
      <div className="flex flex-col md:flex-row gap-2 px-3 pb-2 relative">
        {/* User Video (Left / Top) */}
        <div className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center h-[240px] md:h-[320px]">
          {!isConnected && (
            <div className="flex flex-col items-center gap-4">
              <img
                src={c24Logo}
                alt="C24 Club"
                className="w-48 md:w-56 drop-shadow-lg"
              />
              <p className="text-xs text-neutral-400 -mt-2">The Omegle That Rewards You!</p>
              <button
                onClick={handleStart}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xl px-10 py-2.5 rounded-lg transition-colors shadow-lg"
              >
                START
              </button>
              <span className="text-neutral-500 text-xs tracking-wide">C24CLUB.COM</span>
            </div>
          )}

          {isConnected && (
            <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
              <p className="text-neutral-500 text-sm">Your camera</p>
            </div>
          )}
        </div>

        {/* Remote Video (Right / Bottom) */}
        <div className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900 relative overflow-hidden flex items-center justify-center h-[240px] md:h-[320px]">
          {isConnected ? (
            <div className="absolute inset-0 bg-neutral-800 flex items-center justify-center">
              <p className="text-neutral-500 text-sm">Connecting...</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-neutral-600 text-sm">Partner video</p>
            </div>
          )}

          {isConnected && (
            <button
              onClick={handleNext}
              className="absolute bottom-4 right-4 flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 transition-colors z-10"
            >
              <span className="font-bold text-sm">NEXT</span>
              <img src={nextBtn} alt="Next" className="w-10 h-10" />
            </button>
          )}
        </div>
      </div>

      {/* Reward Drop Timer */}
      <div className="text-center py-3">
        <p className="text-sm font-bold tracking-wide">
          NEXT REWARD DROP IN{" "}
          <span className="text-yellow-400">{rewardDropMinutes} MINUTES!</span>
        </p>
      </div>

      {/* Quick Nav Icons */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 px-4 pb-3">
        <NavIcon src={storeIcon} label="STORE" />
        <NavIcon src={redeemIcon} label="REDEEM" />
        <NavIcon src={topicsIcon} label="TOPICS" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 px-4 pb-4">
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
  <button className="flex flex-col items-center gap-1 hover:scale-110 transition-transform">
    <img src={src} alt={label} className="w-12 h-12 object-contain" />
    <span className="text-[10px] font-bold tracking-wider">{label}</span>
  </button>
);

export default VideoCallPage;
