import { Mic, Clock, Zap, DollarSign } from "lucide-react";

interface VoiceModeExplainerPopupProps {
  onDismiss: () => void;
}

const VoiceModeExplainerPopup = ({ onDismiss }: VoiceModeExplainerPopupProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-purple-500/40 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-3">🎙️</div>

        <h3 className="text-xl font-black text-white mb-2 tracking-wide">
          Voice Mode Active
        </h3>

        <p className="text-neutral-300 text-sm mb-4 leading-relaxed">
          You start in <span className="text-purple-400 font-bold">Voice Mode</span> — your camera is hidden so guys will pay to unlock it!
        </p>

        <div className="space-y-2.5 mb-5 text-left">
          <div className="flex items-center gap-3 bg-green-900/40 border border-green-500/30 rounded-xl px-4 py-2.5">
            <DollarSign className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-white text-sm font-bold">
              Guys pay to see you — you earn a cut!
            </span>
          </div>
          <div className="flex items-center gap-3 bg-neutral-800/60 rounded-xl px-4 py-2.5">
            <Clock className="w-5 h-5 text-purple-400 shrink-0" />
            <span className="text-white text-sm font-bold">
              5 minutes cap per partner
            </span>
          </div>
          <div className="flex items-center gap-3 bg-neutral-800/60 rounded-xl px-4 py-2.5">
            <Mic className="w-5 h-5 text-purple-400 shrink-0" />
            <span className="text-white text-sm font-bold">
              Camera stays off — partner sees your avatar
            </span>
          </div>
          <div className="flex items-center gap-3 bg-neutral-800/60 rounded-xl px-4 py-2.5">
            <Zap className="w-5 h-5 text-yellow-400 shrink-0" />
            <span className="text-white text-sm font-bold">
              Chat & flirt to get more unlock requests!
            </span>
          </div>
        </div>

        <p className="text-neutral-500 text-xs mb-4">
          💡 Tip: The more you engage, the more guys will want to unlock your camera!
        </p>

        <button
          onClick={onDismiss}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg uppercase tracking-wide transition-colors border-2 border-purple-500"
        >
          Got It! Let's Earn 💰
        </button>
      </div>
    </div>
  );
};

export default VoiceModeExplainerPopup;
