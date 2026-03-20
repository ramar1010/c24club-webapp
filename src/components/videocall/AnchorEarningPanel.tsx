import { useState, useEffect } from "react";
import { AnchorSettings, AnchorPayout, AnchorStatus, EarningMode } from "@/hooks/useAnchorEarning";
import { toast } from "sonner";
import { Info } from "lucide-react";
import AnchorExplainerModal, { STORAGE_KEY } from "./AnchorExplainerModal";

interface AnchorEarningPanelProps {
  status: AnchorStatus;
  earningMode: EarningMode;
  cashBalance: number;
  queuePosition: number;
  cashEarned: number;
  settings: AnchorSettings | null;
  settingsLoaded: boolean;
  verificationRequired: boolean;
  verificationWord: string;
  payouts: AnchorPayout[];
  onJoin: () => void;
  onLeave: () => void;
  onCashout: (email: string) => Promise<number>;
  onDismissCash: () => void;
  onSubmitVerification: (input: string) => Promise<boolean>;
}

const EARNING_TIPS = [
  "💡 Invite guys from Discover to a private call — gifts earn you more!",
  "🔥 Message your matches and start a private video call to boost earnings!",
  "💸 Private call gifts give you a 20% bonus — tap the gift hint!",
  "📲 The more private calls you do, the more you earn. DM someone now!",
  "✨ Tip: Share your Discover profile to attract more gifters!",
];

const EarningTip = () => {
  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * EARNING_TIPS.length));
  useEffect(() => {
    const timer = setInterval(() => setTipIdx((prev) => (prev + 1) % EARNING_TIPS.length), 12000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p className="text-pink-300/70 text-[11px] text-center mt-1.5 font-semibold animate-fade-in">
      {EARNING_TIPS[tipIdx]}
    </p>
  );
};

const AnchorEarningPanel = ({
  status,
  earningMode,
  cashBalance,
  queuePosition,
  cashEarned,
  settings,
  settingsLoaded,
  verificationRequired,
  verificationWord,
  payouts,
  onJoin,
  onLeave,
  onCashout,
  onDismissCash,
  onSubmitVerification,
}: AnchorEarningPanelProps) => {
  const [showCashoutModal, setShowCashoutModal] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [cashingOut, setCashingOut] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState(false);
  const [verifySubmitting, setVerifySubmitting] = useState(false);
  const [showPayouts, setShowPayouts] = useState(false);

  const pendingPayouts = payouts.filter(p => p.status === "pending");
  const statusIconFn = (s: string) => s === "paid" ? "✅" : s === "rejected" ? "❌" : "⏳";

  useEffect(() => {
    if (status !== "not_eligible" && status !== "loading") {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) setShowExplainer(true);
    }
  }, [status]);

  useEffect(() => {
    if (cashEarned > 0) {
      toast.success(`💰 You earned $${cashEarned.toFixed(2)}!`, {
        description: earningMode === "active"
          ? "Earned while chatting! Keep going! 💪"
          : "Earned while waiting. Connect with a guy to earn more! 🚀",
        duration: 4000,
      });
      onDismissCash();
    }
  }, [cashEarned, onDismissCash, earningMode]);

  if (status === "not_eligible" || status === "loading" || !settingsLoaded) return null;

  if (showExplainer) {
    return <AnchorExplainerModal onClose={() => setShowExplainer(false)} />;
  }

  const isActive = earningMode === "active";
  const activeRate = settings?.active_rate_cash ?? 1.5;
  const activeTime = settings?.active_rate_time ?? 30;
  const idleRate = settings?.idle_rate_cash ?? 0.1;
  const idleTime = settings?.idle_rate_time ?? 30;
  const currentRatePerMin = isActive ? (activeRate / activeTime) : (idleRate / idleTime);

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

  // ─── Verification challenge — pink themed ───
  if (verificationRequired) {
    const handleVerify = async () => {
      setVerifySubmitting(true);
      setVerifyError(false);
      const ok = await onSubmitVerification(verifyInput);
      setVerifySubmitting(false);
      if (ok) {
        setVerifyInput("");
        toast.success("Verified! Keep earning ✅");
      } else {
        setVerifyError(true);
        setVerifyInput("");
      }
    };

    return (
      <div
        className="w-full mb-2 rounded-xl p-4 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 50%, #c026d3 100%)',
          boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(192, 38, 211, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.25)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-bg 3s ease-in-out infinite',
          }}
        />
        <div className="relative">
          <div className="text-3xl mb-2">⏸️</div>
          <h3 className="text-white font-black text-base uppercase mb-1 drop-shadow-sm">Still There?</h3>
          <p className="text-white/70 text-xs mb-3">Type the word below to keep earning</p>
          <p className="text-yellow-300 font-black text-xl tracking-widest mb-3 select-none drop-shadow-sm">
            {verificationWord.toUpperCase()}
          </p>
          <input
            type="text"
            value={verifyInput}
            onChange={(e) => { setVerifyInput(e.target.value); setVerifyError(false); }}
            placeholder="Type the word here..."
            autoFocus
            className={`w-full bg-white/15 backdrop-blur-sm border-2 ${verifyError ? "border-red-400" : "border-white/30"} rounded-lg px-3 py-2.5 text-white text-center text-sm font-bold mb-2 focus:outline-none focus:border-yellow-300 placeholder:text-white/40`}
            onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          />
          {verifyError && <p className="text-yellow-200 text-xs mb-2 font-bold">Wrong word — try again!</p>}
          <button
            onClick={handleVerify}
            disabled={verifySubmitting || !verifyInput.trim()}
            className="w-full py-2.5 rounded-xl font-black text-sm uppercase transition-colors disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #fbbf24 100%)',
              color: '#831843',
              boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
            }}
          >
            {verifySubmitting ? "Verifying..." : "Confirm ✅"}
          </button>
          <p className="text-white/40 text-[10px] mt-2">Your earning is paused until you verify</p>
        </div>
      </div>
    );
  }

  // ─── Cashout modal — pink themed ───
  if (showCashoutModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
        <div
          className="rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ff2d95 0%, #c026d3 100%)',
            border: '2px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <h3 className="text-xl font-black text-white mb-4 uppercase">💰 Cash Out via PayPal</h3>
          <p className="text-white/70 text-sm mb-4">
            Balance: <span className="text-yellow-300 font-black text-lg">${cashBalance.toFixed(2)}</span>
          </p>
          <input
            type="email"
            value={paypalEmail}
            onChange={(e) => setPaypalEmail(e.target.value)}
            placeholder="your@paypal.email"
            className="w-full bg-white/15 backdrop-blur-sm border-2 border-white/30 rounded-lg px-4 py-3 text-white text-center mb-4 focus:outline-none focus:border-yellow-300 placeholder:text-white/40"
          />
          <div className="flex gap-3">
            <button
              onClick={() => setShowCashoutModal(false)}
              className="flex-1 py-3 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold transition-colors border border-white/20"
            >
              Cancel
            </button>
            <button
              onClick={handleCashout}
              disabled={cashingOut}
              className="flex-1 py-3 rounded-xl font-black text-sm uppercase transition-colors disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #facc15 0%, #fbbf24 100%)',
                color: '#831843',
                boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
              }}
            >
              {cashingOut ? "..." : "💰 Cash Out"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Queued state — pink themed ───
  if (status === "queued") {
    return (
      <div
        className="w-full mb-2 rounded-xl p-4 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 50%, #c026d3 100%)',
          boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(192, 38, 211, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.25)',
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-bg 3s ease-in-out infinite',
          }}
        />
        <div className="relative">
          <p className="text-yellow-300 font-black text-sm uppercase tracking-wide animate-pulse">
            ⏳ Slots Full — You're #{queuePosition > 0 ? queuePosition : 1} in Queue
          </p>
          <p className="text-white/60 text-xs mt-1.5">
            We'll start your earning cash automatically when a slot opens up! Stay here to save your spot
          </p>
          <button
            onClick={onLeave}
            className="mt-2 text-white/50 text-xs hover:text-white/80 font-bold underline"
          >
            Leave Queue
          </button>
        </div>
      </div>
    );
  }

  // ─── Idle/slots_full — join prompt ───
  if (status === "idle" || status === "slots_full") {
    return (
      <div className="w-full mb-2 relative">
        <span className="absolute -top-3 left-4 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '0s' }}>💰</span>
        <span className="absolute -top-3 right-6 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '0.8s' }}>✨</span>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '1.5s' }}>💸</span>
        <div
          className="rounded-xl p-4 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 50%, #c026d3 100%)',
            boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(192, 38, 211, 0.2)',
            border: '2px solid rgba(255, 255, 255, 0.25)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-bg 3s ease-in-out infinite',
            }}
          />
          <div className="relative">
            <span className="text-[10px] font-bold uppercase tracking-widest text-pink-300/80">Female Earning Bonus</span>
            <p className="text-white font-black text-base uppercase tracking-wide mt-1 mb-2 drop-shadow-sm">
              🌟 Start Earning Cash!
            </p>
            {status === "slots_full" && (
              <p className="text-yellow-300 text-xs mb-2 font-bold">All slots are full — join the queue!</p>
            )}
            <button
              onClick={onJoin}
              className="px-6 py-2.5 rounded-xl font-black text-sm uppercase transition-colors border-2 border-white/30"
              style={{
                background: 'linear-gradient(135deg, #facc15 0%, #fbbf24 100%)',
                color: '#831843',
                boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
              }}
            >
              💰 Start Earning
            </button>
            <button
              onClick={() => setShowExplainer(true)}
              className="block mx-auto mt-2 text-white/50 text-[10px] hover:text-white/80 font-bold"
            >
              <Info className="inline h-3 w-3 mr-0.5" /> How it works
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Active earning panel — neon 3-row layout ───
  const lastPayout = payouts.length > 0 ? payouts[0] : null;

  const statusBadge = lastPayout ? (
    <div className="flex items-center gap-1 ml-6">
      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${
        lastPayout.status === "pending" ? "bg-yellow-400/30 text-yellow-200" :
        lastPayout.status === "paid" ? "bg-emerald-400/30 text-emerald-200" :
        "bg-red-400/30 text-red-200"
      }`}>
        {statusIconFn(lastPayout.status)}{" "}
        ${Number(lastPayout.amount).toFixed(2)} {lastPayout.status}
      </span>
    </div>
  ) : null;

  return (
    <div className="w-full mb-2 relative">
      {/* Floating emojis */}
      <span className="absolute -top-3 left-4 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '0s' }}>💰</span>
      <span className="absolute -top-3 right-6 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '0.8s' }}>✨</span>
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-lg pointer-events-none select-none z-10" style={{ animation: 'float-coin 2.5s ease-in-out infinite', animationDelay: '1.5s' }}>💸</span>

      <div className="relative rounded-xl" style={{ boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(255, 45, 149, 0.15)' }}>

        {/* ── Row 1: Header — neon hot pink ── */}
        <div
          className="relative flex items-center justify-between px-4 py-3 rounded-t-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 100%)' }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-bg 3s ease-in-out infinite',
            }}
          />
          <div className="relative flex flex-col items-start gap-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-pink-300/80">Female Earning Bonus</span>
            <div className="flex items-center gap-2">
              <span className="text-xl">💰</span>
              <span className="text-white font-black text-base uppercase tracking-wide drop-shadow-sm">
                Your Earnings
              </span>
            </div>
          </div>
          <div className="relative flex items-center gap-2">
            <span className="text-white font-black text-base drop-shadow-sm">
              Balance: <span className="text-yellow-300 text-xl font-black">${cashBalance.toFixed(2)}</span>
            </span>
            <button
              onClick={() => setShowExplainer(true)}
              className="text-white/50 hover:text-yellow-300 p-1"
              title="How it works"
            >
              <Info className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Row 2: Rate info — neon purple/magenta ── */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #c026d3 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">{isActive ? "🔥" : "💤"}</span>
            <span className="text-white font-bold text-sm">
              {isActive ? "On Call with Guy" : "Idle"}: ${currentRatePerMin.toFixed(4)}/min
            </span>
          </div>
          {!isActive ? (
            <span className="text-green-300 font-bold text-xs">
              🔥 On Call with Guy: ${(activeRate / activeTime).toFixed(4)}/min
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-300 font-bold text-xs uppercase">Active Rate</span>
            </div>
          )}
        </div>

        {/* ── Row 3: Cash out + status — neon orange/yellow ── */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-b-xl"
          style={{ background: 'linear-gradient(135deg, #ff6b00 0%, #ffab00 100%)' }}
        >
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{isActive ? "🔥" : "⏳"}</span>
              <span className="text-white font-black text-sm uppercase drop-shadow-sm">
                {isActive ? "Earning Active Rate" : "Earning Idle Rate"}
              </span>
            </div>
            {statusBadge}
          </div>
          {cashBalance > 0 ? (
            <button
              onClick={() => setShowCashoutModal(true)}
              className="px-5 py-2 rounded-lg text-white font-black text-sm uppercase transition-colors border-2 border-white/30 shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 100%)',
                boxShadow: '0 0 15px rgba(255, 45, 149, 0.5)',
              }}
            >
              💰 Cash Out ${cashBalance.toFixed(2)}
            </button>
          ) : (
            <span className="text-white/80 font-bold text-sm">
              🏦 ${cashBalance.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Payout history */}
      {payouts.length > 0 && (
        <div className="mt-1">
          <button
            onClick={() => setShowPayouts(!showPayouts)}
            className="text-pink-300/60 text-[10px] hover:text-pink-200 font-bold w-full text-center"
          >
            {pendingPayouts.length > 0 && <span className="text-yellow-300">⏳ {pendingPayouts.length} pending · </span>}
            {showPayouts ? "Hide" : "View"} Cashout History
          </button>
          {showPayouts && (
            <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-white/10 rounded-lg px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span>{statusIconFn(p.status)}</span>
                    <span className="text-yellow-300 font-bold">${Number(p.amount).toFixed(2)}</span>
                  </div>
                  <span className={`font-bold uppercase text-[10px] ${
                    p.status === "paid" ? "text-emerald-300" : p.status === "rejected" ? "text-red-300" : "text-yellow-300"
                  }`}>
                    {p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rotating earning tips */}
      <EarningTip />

      {/* Stop earning — subtle */}
      <div className="text-center mt-0.5">
        <button
          onClick={() => {
            if (confirm("⚠️ Stopping will pause your earning. Your cash balance is saved.")) {
              onLeave();
            }
          }}
          className="text-pink-300/40 text-[10px] hover:text-pink-300/70 font-bold"
        >
          Stop Earning
        </button>
      </div>
    </div>
  );
};

export default AnchorEarningPanel;
