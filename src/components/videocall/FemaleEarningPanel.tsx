import { useState, useEffect, useRef, useCallback } from "react";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import CashoutModal from "@/components/discover/CashoutModal";
import { toast } from "sonner";

const VERIFY_WORDS = ["sunshine", "butterfly", "rainbow", "dolphin", "mountain", "galaxy", "crystal", "meadow", "horizon", "thunder"];
const VERIFY_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface FemaleEarningPanelProps {
  totalMinutes: number;
  giftedMinutes: number;
  onPauseEarning: (paused: boolean) => void;
  onCashoutSuccess: () => void;
}

const FemaleEarningPanel = ({
  totalMinutes,
  giftedMinutes,
  onPauseEarning,
  onCashoutSuccess,
}: FemaleEarningPanelProps) => {
  const [rate, setRate] = useState(0.01);
  const [showCashout, setShowCashout] = useState(false);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [verificationWord, setVerificationWord] = useState("");
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState(false);
  const lastVerifiedRef = useRef(Date.now());
  const verifyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch cashout rate
  useEffect(() => {
    supabase
      .from("cashout_settings")
      .select("rate_per_minute")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.rate_per_minute) setRate(Number(data.rate_per_minute));
      });
  }, []);

  // Anti-AFK verification timer
  useEffect(() => {
    verifyTimerRef.current = setInterval(() => {
      if (Date.now() - lastVerifiedRef.current >= VERIFY_INTERVAL_MS) {
        setVerificationRequired(true);
        setVerificationWord(VERIFY_WORDS[Math.floor(Math.random() * VERIFY_WORDS.length)]);
        onPauseEarning(true);
      }
    }, 10000); // check every 10s

    return () => {
      if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    };
  }, [onPauseEarning]);

  const handleVerify = useCallback(() => {
    if (verifyInput.toLowerCase().trim() === verificationWord.toLowerCase()) {
      setVerificationRequired(false);
      setVerifyInput("");
      setVerifyError(false);
      lastVerifiedRef.current = Date.now();
      onPauseEarning(false);
      toast.success("Verified! Keep earning ✅");
    } else {
      setVerifyError(true);
      setVerifyInput("");
    }
  }, [verifyInput, verificationWord, onPauseEarning]);

  const cashValue = (giftedMinutes * rate).toFixed(2);

  // Verification challenge — pink themed
  if (verificationRequired) {
    return (
      <div
        className="w-full mb-2 rounded-xl p-4 text-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 50%, #c026d3 100%)',
          boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(192, 38, 211, 0.2)',
          border: '2px solid rgba(255, 255, 255, 0.25)',
        }}
      >
        {/* Shimmer */}
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
            disabled={!verifyInput.trim()}
            className="w-full py-2.5 rounded-xl font-black text-sm uppercase transition-colors disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #facc15 0%, #fbbf24 100%)',
              color: '#831843',
              boxShadow: '0 0 15px rgba(250, 204, 21, 0.4)',
            }}
          >
            Confirm ✅
          </button>
          <p className="text-white/40 text-[10px] mt-2">Your earning is paused until you verify</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mb-2 relative">
      {/* Floating emojis — above & around the panel (no overflow-hidden on this wrapper) */}
      <span className="absolute -top-3 left-2 text-lg animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '0s' }}>💰</span>
      <span className="absolute -top-2 left-10 text-base animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '1.2s' }}>✨</span>
      <span className="absolute -top-4 right-8 text-lg animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '0.6s' }}>🤑</span>
      <span className="absolute -top-2 right-2 text-base animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '1.8s' }}>💎</span>
      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-lg animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '0.3s' }}>🪙</span>
      <span className="absolute -top-1 left-1/3 text-sm animate-float-coin pointer-events-none select-none z-10" style={{ animationDelay: '2.1s' }}>💸</span>

      {/* Panel container — rounded corners on inner divs, no overflow-hidden here */}
      <div className="relative rounded-xl" style={{ boxShadow: '0 0 25px rgba(255, 45, 149, 0.5), 0 0 50px rgba(255, 45, 149, 0.15)' }}>

        {/* ── Row 1: Header — neon hot pink */}
        <div
          className="relative flex items-center justify-between px-4 py-3 rounded-t-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 100%)' }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-bg 3s ease-in-out infinite',
            }}
          />
          <div className="relative flex items-center gap-2">
            <span className="text-xl">💰</span>
            <span className="text-white font-black text-base uppercase tracking-wide drop-shadow-sm">
              Your Earnings
            </span>
          </div>
          <div className="relative">
            <span className="text-white font-black text-base drop-shadow-sm">
              Earning: <span className="text-yellow-300 text-xl font-black">${cashValue}</span>
            </span>
          </div>
        </div>

        {/* ── Row 2: Rate info — neon purple/magenta */}
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ background: 'linear-gradient(135deg, #a855f7 0%, #c026d3 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">✨</span>
            <span className="text-white font-bold text-sm">
              Rate: ${rate}/min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-base">🎁</span>
            <span className="text-white font-bold text-sm">
              {giftedMinutes} cashable min
            </span>
          </div>
        </div>

        {/* ── Row 3: Cash out — neon orange/yellow */}
        <div
          className="flex items-center justify-between px-4 py-3 rounded-b-xl"
          style={{ background: 'linear-gradient(135deg, #ff6b00 0%, #ffab00 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-base">🔥</span>
            <span className="text-white font-black text-sm uppercase drop-shadow-sm">
              {totalMinutes} total minutes
            </span>
          </div>
          {giftedMinutes > 0 ? (
            <button
              onClick={() => setShowCashout(true)}
              className="px-5 py-2 rounded-lg text-white font-black text-sm uppercase transition-colors border-2 border-white/30"
              style={{
                background: 'linear-gradient(135deg, #ff2d95 0%, #ff6ec7 100%)',
                boxShadow: '0 0 15px rgba(255, 45, 149, 0.5)',
              }}
            >
              💰 Cash Out ${cashValue}
            </button>
          ) : (
            <span className="text-white/80 font-bold text-sm">
              🏦 ${cashValue} / {giftedMinutes}min
            </span>
          )}
        </div>
      </div>

      {/* Helper text below panel */}
      <p className="text-neutral-400 text-[11px] text-center mt-1.5 font-semibold">
        Chat with guys or <span className="text-pink-400">"wait for a partner"</span> to earn!
      </p>

      {/* Cashout Modal */}
      {showCashout && (
        <CashoutModal
          onClose={() => setShowCashout(false)}
          currentMinutes={totalMinutes}
          giftedMinutes={giftedMinutes}
          onSuccess={() => {
            setShowCashout(false);
            onCashoutSuccess();
          }}
        />
      )}
    </div>
  );
};

export default FemaleEarningPanel;
