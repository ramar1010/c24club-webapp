import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import SpinToWinPage from "@/pages/public/SpinToWinPage";
import WeeklyChallengesPage from "@/pages/public/WeeklyChallengesPage";
import slotMachine from "@/assets/profile/slot-machine.png";
import challengesPin from "@/assets/profile/challenges-pin.png";
import challengesTarget from "@/assets/profile/challenges-target.png";

const EventsPage = ({ onClose }: { onClose?: () => void }) => {
  const [view, setView] = useState<"hub" | "spin" | "challenges">("hub");

  if (view === "spin") {
    return <SpinToWinPage onClose={() => setView("hub")} />;
  }

  if (view === "challenges") {
    return <WeeklyChallengesPage onClose={() => setView("hub")} />;
  }

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
        Spin the wheel or complete challenges to earn rewards!
      </p>

      <div className="flex flex-col gap-5 w-full max-w-sm">
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

        {/* Weekly Challenges */}
        <button
          onClick={() => setView("challenges")}
          className="bg-gradient-to-r from-green-600 to-green-800 rounded-2xl p-5 flex items-center gap-4 hover:opacity-90 transition-opacity border border-green-500/30 shadow-lg"
        >
          <div className="flex gap-1">
            <img src={challengesPin} alt="Pin" className="w-10 h-10 object-contain" />
            <img src={challengesTarget} alt="Target" className="w-10 h-10 object-contain" />
          </div>
          <div className="text-left">
            <span className="font-black text-lg tracking-wide block">WEEKLY CHALLENGES</span>
            <span className="text-xs font-bold text-green-200">Complete tasks for rewards!</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default EventsPage;
