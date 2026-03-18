import { useState, useEffect } from "react";
import { X, DollarSign, Gift, Clock, Zap, Moon } from "lucide-react";

const STORAGE_KEY = "anchor_explainer_seen";

interface AnchorExplainerModalProps {
  onClose: () => void;
}

const AnchorExplainerModal = ({ onClose }: AnchorExplainerModalProps) => {
  const handleGotIt = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm px-3 py-3">
      <div className="relative bg-neutral-900 border border-yellow-500/40 rounded-2xl max-w-md w-full shadow-2xl animate-in zoom-in-95 max-h-[calc(100dvh-24px)] flex flex-col">
        {/* Close */}
        <button onClick={handleGotIt} className="absolute top-3 right-3 z-10 text-neutral-500 hover:text-white p-1">
          <X className="h-5 w-5" />
        </button>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-3">
          {/* Header */}
          <div className="text-center">
            <div className="text-3xl mb-1">🌟</div>
            <h3 className="text-lg font-black text-white uppercase tracking-wide">Female Earning Bonus</h3>
            <p className="text-neutral-400 text-xs mt-1">Earn exclusive rewards just for chatting!</p>
          </div>

          {/* Two modes */}
          <div className="space-y-2">
            <div className="rounded-xl border border-neutral-700 bg-neutral-800/60 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Moon className="h-4 w-4 text-yellow-400" />
                <span className="font-black text-white text-xs uppercase">Chill Hours</span>
                <span className="text-neutral-500 text-[10px] ml-auto">12 AM – 7 PM EST</span>
              </div>
              <div className="flex items-start gap-2">
                <Gift className="h-3.5 w-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-neutral-300 text-xs">
                  Chat with guys and earn <span className="text-yellow-400 font-bold">Mystery Rewards</span> — clothing, bags & more!
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-red-400" />
                <span className="font-black text-white text-xs uppercase">Power Hours</span>
                <span className="text-neutral-500 text-[10px] ml-auto">7 PM – 12 AM EST</span>
              </div>
              <div className="flex items-start gap-2">
                <DollarSign className="h-3.5 w-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-neutral-300 text-xs">
                  Earn <span className="text-green-400 font-bold">real cash</span> ($2 per 14 min) to your PayPal!
                </p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="space-y-1.5">
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">How it works</p>
            <ul className="space-y-1 text-xs text-neutral-400">
              <li className="flex items-start gap-1.5">
                <Clock className="h-3 w-3 text-neutral-500 mt-0.5 flex-shrink-0" />
                <span>Timer counts while matched with a male partner or just waiting for partner</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-neutral-500 mt-0.5 flex-shrink-0 text-[10px]">⚠️</span>
                <span>Stopping or leaving <span className="text-red-400">resets your timer</span></span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-neutral-500 mt-0.5 flex-shrink-0 text-[10px]">⏸️</span>
                <span>Normal minute earning pauses while bonus is active</span>
              </li>
            </ul>
          </div>

          {/* Rules */}
          <div className="space-y-1.5">
            <p className="text-red-400 text-[10px] font-bold uppercase tracking-wider">⚠️ Rules — Must Follow</p>
            <ol className="space-y-1 text-xs text-neutral-400 list-decimal list-inside">
              <li>Always <span className="text-white font-bold">show your face</span> on camera.</li>
              <li>Always <span className="text-white font-bold">connect to guys</span> to earn.</li>
              <li>Always <span className="text-white font-bold">greet them & chat</span> — never just stare.</li>
              <li><span className="text-red-400 font-bold">Never</span> tell anyone you get paid/rewarded. <span className="text-red-400">Ban risk.</span></li>
            </ol>
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="p-4 pt-2 flex-shrink-0">
          <button
            onClick={handleGotIt}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-neutral-900 font-black text-sm uppercase tracking-wide transition-colors"
          >
            Got It! Let's Earn 🚀
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnchorExplainerModal;
export { STORAGE_KEY };
