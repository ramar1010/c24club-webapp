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

  // Verification challenge
  if (verificationRequired) {
    return (
      <div className="w-full mb-2 rounded-xl border-2 border-yellow-500 bg-neutral-900/90 backdrop-blur-sm p-4 text-center">
        <div className="text-3xl mb-2">⏸️</div>
        <h3 className="text-white font-black text-base uppercase mb-1">Still There?</h3>
        <p className="text-neutral-400 text-xs mb-3">Type the word below to keep earning</p>
        <p className="text-yellow-400 font-black text-xl tracking-widest mb-3 select-none">
          {verificationWord.toUpperCase()}
        </p>
        <input
          type="text"
          value={verifyInput}
          onChange={(e) => { setVerifyInput(e.target.value); setVerifyError(false); }}
          placeholder="Type the word here..."
          autoFocus
          className={`w-full bg-neutral-800 border ${verifyError ? "border-red-500" : "border-neutral-600"} rounded-lg px-3 py-2.5 text-white text-center text-sm font-bold mb-2 focus:outline-none focus:border-yellow-500`}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
        />
        {verifyError && <p className="text-red-400 text-xs mb-2">Wrong word — try again!</p>}
        <button
          onClick={handleVerify}
          disabled={!verifyInput.trim()}
          className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-neutral-900 font-black text-sm uppercase transition-colors disabled:opacity-50"
        >
          Confirm ✅
        </button>
        <p className="text-neutral-600 text-[10px] mt-2">Your earning is paused until you verify</p>
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
      <div className="relative rounded-xl" style={{ boxShadow: '0 0 20px rgba(236, 72, 153, 0.35), 0 0 40px rgba(236, 72, 153, 0.1)' }}>

        {/* ── Row 1: Header — hot pink */}
        <div
          className="relative flex items-center justify-between px-4 py-2.5 rounded-t-xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)' }}
        >
          {/* Shimmer */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-bg 3s ease-in-out infinite',
            }}
          />
          <div className="relative flex items-center gap-2">
            <span className="text-lg">💰</span>
            <span className="text-white font-black text-sm uppercase tracking-wide drop-shadow-sm">
              Your Earnings
            </span>
          </div>
          <div className="relative">
            <span className="text-white font-black text-base drop-shadow-sm">
              Earning: <span className="text-yellow-200 text-lg">${cashValue}</span>
            </span>
          </div>
        </div>

        {/* ── Row 2: Rate info — purple/indigo */}
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">✨</span>
            <span className="text-white/90 font-bold text-xs">
              Rate: ${rate}/min
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🎁</span>
            <span className="text-white/90 font-bold text-xs">
              {giftedMinutes} cashable min
            </span>
          </div>
        </div>

        {/* ── Row 3: Cash out — orange/amber */}
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-b-xl"
          style={{ background: 'linear-gradient(135deg, #ea580c 0%, #f97316 100%)' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🔥</span>
            <span className="text-white font-black text-xs uppercase">
              {totalMinutes} total minutes
            </span>
          </div>
          {giftedMinutes > 0 ? (
            <button
              onClick={() => setShowCashout(true)}
              className="px-4 py-1.5 rounded-lg bg-white/25 hover:bg-white/35 text-white font-black text-xs uppercase transition-colors border border-white/20 backdrop-blur-sm"
            >
              💰 Cash Out ${cashValue}
            </button>
          ) : (
            <span className="text-white/70 font-bold text-xs">
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
