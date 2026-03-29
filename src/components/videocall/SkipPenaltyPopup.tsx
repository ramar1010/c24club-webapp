import { useVipStatus } from "@/hooks/useVipStatus";

interface SkipPenaltyPopupProps {
  minutesLost: number;
  onDismiss: () => void;
  onUpgrade: () => void;
}

const SkipPenaltyPopup = ({ minutesLost, onDismiss, onUpgrade }: SkipPenaltyPopupProps) => {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-red-700/60 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        <div className="text-5xl mb-3">⚠️</div>
        <h2 className="text-white font-black text-xl uppercase tracking-wide mb-2">
          Warning: Minutes Lost!
        </h2>
        <p className="text-neutral-200 text-sm leading-relaxed mb-5">
          You just lost{" "}
          <span className="text-red-400 font-black text-lg">-{minutesLost} Minutes</span>{" "}
          for skipping too fast.
        </p>
        <p className="text-neutral-400 text-xs leading-relaxed mb-6">
          Don't let your hard work vanish. Upgrade to VIP to get the{" "}
          <span className="text-yellow-400 font-bold">Gender Filter</span> and never waste
          minutes skipping again.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={onUpgrade}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 text-neutral-900 font-black text-sm uppercase tracking-wide transition-colors border-2 border-yellow-400"
          >
            Stop Losing Minutes + Gender Filter & More ($2.49/wk)
          </button>
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-bold text-xs uppercase tracking-wide transition-colors border border-neutral-700"
          >
            I'll Keep Losing Progress
          </button>
        </div>
      </div>
    </div>
  );
};

export default SkipPenaltyPopup;
