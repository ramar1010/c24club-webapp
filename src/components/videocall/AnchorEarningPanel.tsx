import { useState } from "react";
import { AnchorMode, AnchorStatus } from "@/hooks/useAnchorEarning";
import { toast } from "sonner";

interface AnchorSettings {
  power_rate_cash: number;
  power_rate_time: number;
  chill_reward_time: number;
  max_anchor_cap: number;
}

interface AnchorReward {
  id: string;
  title: string;
  image_url: string | null;
  rarity: string;
}

interface AnchorEarningPanelProps {
  status: AnchorStatus;
  mode: AnchorMode;
  elapsedSeconds: number;
  thresholdSeconds: number;
  cashBalance: number;
  queuePosition: number;
  rewardEarned: AnchorReward | null;
  cashEarned: number;
  settings: AnchorSettings | null;
  onJoin: () => void;
  onLeave: () => void;
  onCashout: (email: string) => Promise<number>;
  onDismissReward: () => void;
  onDismissCash: () => void;
}

const AnchorEarningPanel = ({
  status,
  mode,
  elapsedSeconds,
  thresholdSeconds,
  cashBalance,
  queuePosition,
  rewardEarned,
  cashEarned,
  settings,
  onJoin,
  onLeave,
  onCashout,
  onDismissReward,
  onDismissCash,
}: AnchorEarningPanelProps) => {
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cashingOut, setCashingOut] = useState(false);

  if (status === "not_eligible" || status === "loading") return null;

  const remainingSeconds = Math.max(0, thresholdSeconds - elapsedSeconds);
  const remainingMin = Math.floor(remainingSeconds / 60);
  const remainingSec = remainingSeconds % 60;
  const progress = thresholdSeconds > 0 ? Math.min(1, elapsedSeconds / thresholdSeconds) : 0;

  const isPower = mode === "power";
  const borderColor = isPower ? "border-red-500/50" : "border-neutral-600";
  const bgColor = isPower ? "bg-red-950/80" : "bg-neutral-900/90";
  const accentColor = isPower ? "text-red-400" : "text-neutral-400";
  const progressBarColor = isPower ? "bg-red-500" : "bg-yellow-500";

  const handleCashout = async () => {
    if (!paypalEmail.includes("@")) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setCashingOut(true);
    try {
      const amount = await onCashout(paypalEmail);
      toast.success(`$${amount.toFixed(2)} cashout requested!`);
      setShowCashoutModal(false);
      setPaypalEmail("");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCashingOut(false);
    }
  };

  // Mystery reward popup
  if (rewardEarned) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="bg-neutral-900 border-2 border-yellow-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
          <div className="text-5xl mb-3">🎁</div>
          <h3 className="text-xl font-black text-white mb-2 uppercase">Mystery Reward!</h3>
          {rewardEarned.image_url && (
            <img
              src={rewardEarned.image_url}
              alt={rewardEarned.title}
              className="w-32 h-32 object-cover rounded-xl mx-auto mb-3 border-2 border-yellow-500/50"
            />
          )}
          <p className="text-yellow-400 font-black text-lg">{rewardEarned.title}</p>
          <p className="text-neutral-400 text-sm mt-1 capitalize">
            {rewardEarned.rarity} item
          </p>
          <p className="text-neutral-500 text-xs mt-2">
            Added to your My Rewards — add shipping details to claim!
          </p>
          <button
            onClick={onDismissReward}
            className="mt-4 w-full py-3 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-neutral-900 font-black text-lg uppercase transition-colors"
          >
            Awesome! 🎉
          </button>
        </div>
      </div>
    );
  }

  // Cash earned toast
  if (cashEarned > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="bg-neutral-900 border-2 border-green-500 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
          <div className="text-5xl mb-3">💰</div>
          <h3 className="text-xl font-black text-white mb-2 uppercase">Cash Earned!</h3>
          <p className="text-green-400 font-black text-3xl">${cashEarned.toFixed(2)}</p>
          <p className="text-neutral-400 text-sm mt-2">
            Added to your pending balance
          </p>
          <button
            onClick={onDismissCash}
            className="mt-4 w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-black text-lg uppercase transition-colors"
          >
            Keep Earning! 💪
          </button>
        </div>
      </div>
    );
  }

  // Cashout modal
  if (showCashoutModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
          <h3 className="text-xl font-black text-white mb-4">Cash Out via PayPal</h3>
          <p className="text-neutral-400 text-sm mb-4">
            Balance: <span className="text-green-400 font-bold">${cashBalance.toFixed(2)}</span>
          </p>
          <input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="your@paypal.email"
            className="w-full bg-neutral-800 border border-neutral-600 rounded-lg px-4 py-3 text-white text-center mb-4 focus:outline-none focus:border-green-500"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowCashoutModal(false)}
              className="flex-1 py-3 rounded-xl bg-neutral-700 hover:bg-neutral-600 text-white font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCashout}
              disabled={cashingOut}
              className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors disabled:opacity-50"
            >
              {cashingOut ? "..." : "Cash Out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Queued state
  if (status === "queued") {
    return (
      <div className={`mx-3 mb-2 rounded-xl border ${borderColor} ${bgColor} backdrop-blur-sm px-4 py-3`}>
        <div className="text-center">
          <p className="text-yellow-400 font-black text-sm uppercase tracking-wide animate-pulse">
            ⏳ Slots Full — You're #{queuePosition} in Queue
          </p>
          <p className="text-neutral-500 text-xs mt-1">
            You'll be automatically added when a slot opens
          </p>
          <button
            onClick={onLeave}
            className="mt-2 text-red-400 text-xs hover:text-red-300 font-bold"
          >
            Leave Queue
          </button>
        </div>
      </div>
    );
  }

  // Idle — show join button
  if (status === "idle" || status === "slots_full") {
    return (
      <div className={`mx-3 mb-2 rounded-xl border border-neutral-600 bg-neutral-900/90 backdrop-blur-sm px-4 py-3`}>
        <div className="text-center">
          <p className="text-white font-black text-sm uppercase tracking-wide mb-2">
            🌟 Anchor Earning Available
          </p>
          {status === "slots_full" ? (
            <p className="text-yellow-400 text-xs mb-2">All slots are full — join the queue!</p>
          ) : null}
          <button
            onClick={onJoin}
            className="px-6 py-2 rounded-lg bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-neutral-900 font-black text-sm uppercase transition-colors"
          >
            Start Earning
          </button>
        </div>
      </div>
    );
  }

  // Active earning panel
  return (
    <div className={`mx-3 mb-2 rounded-xl border ${borderColor} ${bgColor} backdrop-blur-sm px-4 py-3`}>
      {/* Mode indicator */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-black uppercase tracking-wider ${isPower ? "text-red-400" : "text-neutral-400"}`}>
            {isPower ? "🔥 POWER HOURS" : "🌙 CHILL HOURS"}
          </span>
          <div className={`w-2 h-2 rounded-full ${isPower ? "bg-red-500" : "bg-yellow-500"} animate-pulse`} />
        </div>
        {isPower && cashBalance > 0 && (
          <button
            onClick={() => setShowCashoutModal(true)}
            className="text-xs font-bold text-green-400 hover:text-green-300 bg-green-500/10 px-2 py-1 rounded-lg border border-green-500/30"
          >
            💰 ${cashBalance.toFixed(2)}
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-neutral-700 rounded-full overflow-hidden mb-2">
        <div
          className={`h-full ${progressBarColor} rounded-full transition-all duration-1000`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* Timer text */}
      <p className={`text-center text-sm font-bold ${accentColor}`}>
        {isPower ? (
          <>Next <span className="text-green-400">${(settings?.power_rate_cash ?? 1.5).toFixed(2)}</span> is <span className="text-white">{remainingMin}:{String(remainingSec).padStart(2, "0")}</span> away!</>
        ) : (
          <>Next reward is <span className="text-yellow-400">{remainingMin}</span> minutes away! 🎁</>
        )}
      </p>

      {/* Leave button */}
      <div className="text-center mt-1">
        <button
          onClick={onLeave}
          className="text-neutral-600 text-[10px] hover:text-neutral-400 font-bold"
        >
          Stop Earning
        </button>
      </div>

      {/* Settings badge */}
      {settings && (
        <div className="hidden">
          {/* Hidden settings for reference */}
        </div>
      )}
    </div>
  );
};

export default AnchorEarningPanel;
