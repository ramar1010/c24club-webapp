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
    <div className="w-full mb-2 rounded-xl border border-emerald-500/30 bg-neutral-900/90 backdrop-blur-sm px-4 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <span className="text-white font-black text-sm uppercase tracking-wide">Your Earnings</span>
        </div>
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Minutes = Cash value */}
      <div className="text-center mb-3">
        <p className="text-white text-xs mb-1">
          <span className="text-emerald-400 font-black text-2xl">{giftedMinutes}</span>
          <span className="text-neutral-400 ml-1">cashable minutes</span>
        </p>
        <p className="text-emerald-400 font-black text-lg">
          = ${cashValue}
        </p>
        <p className="text-neutral-500 text-[10px]">
          Rate: ${rate}/min • {totalMinutes} total minutes
        </p>
      </div>

      {/* Cash Out Button */}
      {giftedMinutes > 0 && (
        <button
          onClick={() => setShowCashout(true)}
          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase transition-colors"
        >
          💰 Cash Out ${cashValue}
        </button>
      )}

      <p className="text-neutral-500 text-[10px] text-center mt-2">
        Cash out via PayPal or spend on rewards — your choice!
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
