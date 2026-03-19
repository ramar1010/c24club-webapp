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
      <div
        className="relative rounded-xl px-4 py-3 overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #831843 0%, #9d174d 30%, #be185d 60%, #db2777 100%)',
          boxShadow: '0 0 15px rgba(236, 72, 153, 0.3), 0 0 30px rgba(236, 72, 153, 0.1)',
        }}
      >
        {/* Shimmer overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer-bg 3s ease-in-out infinite',
          }}
        />

        {/* Header */}
        <div className="relative flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-pink-300" />
            </div>
            <span className="text-white font-black text-sm uppercase tracking-wide">Your Earnings</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-pink-300 animate-pulse" />
        </div>

        {/* Minutes = Cash value */}
        <div className="relative text-center mb-3">
          <p className="text-white text-xs mb-1">
            <span className="text-pink-200 font-black text-2xl">{giftedMinutes}</span>
            <span className="text-pink-100/70 ml-1">cashable minutes</span>
          </p>
          <p className="text-pink-200 font-black text-lg">
            = ${cashValue}
          </p>
          <p className="text-pink-200/40 text-[10px]">
            Rate: ${rate}/min • {totalMinutes} total minutes
          </p>
        </div>

        {/* Cash Out Button */}
        {giftedMinutes > 0 && (
          <button
            onClick={() => setShowCashout(true)}
            className="relative w-full py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-black text-sm uppercase transition-colors backdrop-blur-sm border border-white/10"
            style={{
              boxShadow: '0 0 12px rgba(236, 72, 153, 0.4)',
            }}
          >
            💰 Cash Out ${cashValue}
          </button>
        )}

        {/* Helper text */}
        <p className="relative text-pink-200/60 text-[10px] text-center mt-2 leading-relaxed">
          You earn by chatting with guys or <span className="text-pink-200 font-semibold">"waiting to connect in queue"</span>
        </p>
        <p className="relative text-pink-200/40 text-[10px] text-center mt-0.5">
          Cash out via PayPal or spend on rewards — your choice!
        </p>
      </div>

      {/* Floating emojis below the panel */}
      <div className="relative h-6 w-full">
        <span className="absolute top-0 left-4 text-sm animate-float-coin pointer-events-none select-none" style={{ animationDelay: '0s' }}>💰</span>
        <span className="absolute top-1 left-1/4 text-xs animate-float-coin pointer-events-none select-none" style={{ animationDelay: '0.8s' }}>✨</span>
        <span className="absolute top-0 left-1/2 text-sm animate-float-coin pointer-events-none select-none" style={{ animationDelay: '1.6s' }}>🪙</span>
        <span className="absolute top-1 left-3/4 text-xs animate-float-coin pointer-events-none select-none" style={{ animationDelay: '2.4s' }}>💎</span>
        <span className="absolute top-0 right-4 text-sm animate-float-coin pointer-events-none select-none" style={{ animationDelay: '0.4s' }}>🤑</span>
      </div>

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
