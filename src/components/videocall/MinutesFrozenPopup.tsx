import { X, Snowflake } from "lucide-react";

interface MinutesFrozenPopupProps {
  onDismiss: () => void;
  onGoToChallenges: () => void;
}

const MinutesFrozenPopup = ({ onDismiss, onGoToChallenges }: MinutesFrozenPopupProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-blue-500/30 rounded-2xl p-6 max-w-sm w-full text-center relative">
        <button onClick={onDismiss} className="absolute top-3 right-3">
          <X className="w-6 h-6 text-neutral-400 hover:text-white" />
        </button>

        <Snowflake className="w-16 h-16 text-blue-400 mx-auto mb-4" />

        <h2 className="text-2xl font-black text-blue-300 mb-2 tracking-wide">
          🥶 MINUTES FROZEN
        </h2>

        <p className="text-neutral-300 text-sm mb-2">
          Your earning rate has been reduced to <span className="text-blue-400 font-black">2 minutes per user</span>.
        </p>

        <p className="text-neutral-400 text-xs mb-6">
          Complete a Weekly Challenge to restore your full earning rate! Each challenge completed adds 7 days of freeze-free earning.
        </p>

        <button
          onClick={onGoToChallenges}
          className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-3"
        >
          GO TO WEEKLY CHALLENGES
        </button>

        <button
          onClick={onDismiss}
          className="text-neutral-500 text-xs font-bold hover:text-white transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default MinutesFrozenPopup;
