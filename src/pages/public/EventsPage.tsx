import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import SpinToWinPage from "@/pages/public/SpinToWinPage";
import ReferralPage from "@/pages/public/ReferralPage";
import ChallengeMinutesOverlay from "@/components/videocall/ChallengeMinutesOverlay";
import slotMachine from "@/assets/profile/slot-machine.png";

const EventsPage = ({ onClose, initialView }: { onClose?: () => void; initialView?: "hub" | "spin" | "challenges" | "referral" }) => {
  const [view, setView] = useState<"hub" | "spin" | "challenges" | "referral">(initialView ?? "hub");
  const [showWager, setShowWager] = useState(false);

  if (view === "spin") return <SpinToWinPage onClose={() => setView("hub")} />;
  if (view === "referral") return <ReferralPage onClose={() => setView("hub")} />;

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-3xl font-black tracking-wide mt-4 mb-2">🎯 EVENTS</h1>
      <p className="text-neutral-400 text-sm mb-8 text-center">
        Earn rewards, invite friends, and win big!
      </p>

      <div className="flex flex-col gap-5 w-full max-w-sm">
        {/* Refer & Earn */}
        <button
          onClick={() => setView("referral")}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity border border-emerald-500/30 shadow-lg"
        >
          <span className="text-4xl">💸</span>
          <div className="text-left">
            <span className="font-black text-lg tracking-wide block">REFER & EARN</span>
            <span className="text-xs font-bold text-emerald-200">Invite friends, earn real cash!</span>
          </div>
        </button>

        {/* Challenge Minutes / Wager */}
        <button
          onClick={() => setShowWager(true)}
          className="w-full relative overflow-hidden bg-gradient-to-br from-yellow-600/25 via-amber-700/20 to-orange-900/30 border border-yellow-500/40 rounded-2xl p-5 shadow-[0_0_24px_rgba(234,179,8,0.25)] active:scale-[0.97] transition-transform text-left flex items-center gap-4"
        >
          <span className="text-4xl">🎰</span>
          <div>
            <span className="font-black text-lg tracking-wide block">CHALLENGE MINUTES</span>
            <span className="text-xs text-neutral-400">Wager earned minutes for a chance to win up to $200 cash!</span>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-[10px] font-bold bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full">🔥 2x MINUTES</span>
              <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">💵 CASH WIN</span>
              <span className="text-[10px] font-bold bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full">💎 $200 JACKPOT</span>
            </div>
          </div>
        </button>

        {/* Spin to Win */}
        <button
          onClick={() => setView("spin")}
          className="bg-gradient-to-r from-yellow-600 to-orange-600 rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity border border-yellow-500/30 shadow-lg"
        >
          <img src={slotMachine} alt="Spin" className="w-16 h-16 object-contain" />
          <div className="text-left">
            <span className="font-black text-lg tracking-wide block">SPIN TO WIN</span>
            <span className="text-xs font-bold text-yellow-200">1 free spin every day!</span>
          </div>
        </button>
      </div>

      {/* Challenge Minutes Overlay */}
      {showWager && <ChallengeMinutesOverlay onClose={() => setShowWager(false)} />}
    </div>
  );
};

export default EventsPage;