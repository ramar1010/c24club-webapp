interface CapReachedPopupProps {
  isVip: boolean;
  cap: number;
  onDismiss: () => void;
}

const CapReachedPopup = ({ isVip, cap, onDismiss }: CapReachedPopupProps) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-3">⏱️</div>
        <h3 className="text-xl font-black text-white mb-2">
          {cap} Minute Cap Reached!
        </h3>

        {!isVip ? (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-300">
              <span className="font-bold text-white">NON-VIP Users:</span> When
              you reach {cap} minutes chatting with a user, you will stop
              earning minutes until you connect with someone new.
            </p>
            <p className="text-neutral-400">
              You can still chat with this user but you won't earn extra
              minutes.
            </p>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mt-3">
              <p className="text-yellow-400 font-bold text-sm">
                🚀 VIP gets 30 Min Cap per user!
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-300">
              <span className="font-bold text-white">VIP Users:</span> You've
              reached your {cap}-minute cap with this user.
            </p>
            <p className="text-neutral-400">
              Connect with someone new to keep earning minutes!
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2 mt-5">
          <button
            onClick={onDismiss}
            className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition-colors"
          >
            Got it!
          </button>
          {!isVip && (
            <button className="w-full py-2.5 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold transition-colors">
              🚀 Upgrade to VIP
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CapReachedPopup;
