interface CapReachedPopupProps {
  isVip: boolean;
  cap: number;
  onDismiss: () => void;
  voiceMode?: boolean;
}

const CapReachedPopup = ({ isVip, cap, onDismiss, voiceMode = false }: CapReachedPopupProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        {voiceMode ? (
          <div className="space-y-4">
            <div className="text-4xl mb-2">🎙️</div>
            <h3 className="text-xl font-black text-white mb-2">
              {cap} Minute Voice Cap Reached!
            </h3>
            <p className="text-neutral-300 text-sm leading-relaxed">
              In <span className="text-purple-400 font-bold">Voice Mode</span>, you earn up to{" "}
              <span className="text-purple-400 font-black">{cap} minutes</span> per partner.
              Connect with someone new to keep earning! 🎧
            </p>
            <button
              onClick={onDismiss}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-lg uppercase tracking-wide transition-colors border-2 border-purple-500 mt-3"
            >
              Got It!
            </button>
          </div>
        ) : !isVip ? (
          <div className="space-y-4">
            <p className="text-white font-black text-lg leading-snug uppercase tracking-wide">
              When you reach{" "}
              <span className="text-orange-400 font-black">{cap} Minutes</span>{" "}
              🎁 chatting with a user, you will stop earning minutes until you
              connect with someone new. You can still chat with that user but
              you won't earn extra minutes.{" "}
              <span className="text-white font-black">
                VIP gets <span className="text-orange-400">30 mins</span> cap
                per user they connect with!
              </span>{" "}
              🎁
            </p>

            <div className="flex flex-col gap-3 mt-5">
              <button
                onClick={onDismiss}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-lg uppercase tracking-wide transition-colors border-2 border-green-500"
              >
                I Understand
              </button>
              <button className="w-full py-3 rounded-xl bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 text-neutral-900 font-black text-lg uppercase tracking-wide transition-colors border-2 border-yellow-400">
                Join VIP Now!
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="text-4xl mb-3">⏱️</div>
            <h3 className="text-xl font-black text-white mb-2">
              {cap} Minute Cap Reached!
            </h3>
            <p className="text-neutral-300">
              <span className="font-bold text-white">VIP Users:</span> You've
              reached your {cap}-minute cap with this user.
            </p>
            <p className="text-neutral-400">
              Connect with someone new to keep earning minutes!
            </p>
            <button
              onClick={onDismiss}
              className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors mt-5"
            >
              Got it!
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CapReachedPopup;
