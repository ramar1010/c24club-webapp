import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, EyeOff } from "lucide-react";

interface LuckySpinWidgetProps {
  isWaiting: boolean;
  onOpenMyRewards?: () => void;
}

const SYMBOLS = ["💰", "🎁", "⭐", "🍀", "💎", "🔥", "🎯", "✨"];

const LuckySpinWidget = ({ isWaiting }: LuckySpinWidgetProps) => {
  const [hidden, setHidden] = useState(() => localStorage.getItem("lucky-spin-hidden") === "true");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; amount_display?: string } | null>(null);
  const [reelSymbols, setReelSymbols] = useState([SYMBOLS[0], SYMBOLS[1], SYMBOLS[2]]);
  const waitStartRef = useRef(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spinAnimRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: settings } = useQuery({
    queryKey: ["lucky-spin-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("lucky_spin_settings")
        .select("*")
        .limit(1)
        .single();
      return data;
    },
    staleTime: 60000,
  });

  const doSpin = useCallback(async () => {
    if (spinning) return;
    setSpinning(true);
    setResult(null);

    // Animate reels for 1.5s
    let animCount = 0;
    spinAnimRef.current = setInterval(() => {
      setReelSymbols([
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      ]);
      animCount++;
      if (animCount > 8) {
        if (spinAnimRef.current) clearInterval(spinAnimRef.current);
      }
    }, 150);

    const waitSeconds = Math.floor((Date.now() - waitStartRef.current) / 1000);

    try {
      const { data, error } = await supabase.functions.invoke("waiting-spin", {
        body: { waitSeconds },
      });

      if (spinAnimRef.current) clearInterval(spinAnimRef.current);

      if (error) {
        setSpinning(false);
        return;
      }

      if (data?.won) {
        setReelSymbols(["💰", "💰", "💰"]);
        setResult({ won: true, amount_display: data.amount_display });
      } else {
        setReelSymbols(["❌", "🍀", "❌"]);
        setResult({ won: false });
      }
    } catch {
      if (spinAnimRef.current) clearInterval(spinAnimRef.current);
    }

    setTimeout(() => {
      setSpinning(false);
      setResult(null);
    }, 2500);
  }, [spinning]);

  useEffect(() => {
    if (!isWaiting || hidden || !settings?.is_enabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    waitStartRef.current = Date.now();

    // First spin after 3 seconds
    const initialTimeout = setTimeout(() => {
      doSpin();
      intervalRef.current = setInterval(doSpin, settings?.spin_interval_ms ?? 5000);
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (spinAnimRef.current) clearInterval(spinAnimRef.current);
    };
  }, [isWaiting, hidden, settings?.is_enabled, doSpin]);

  const toggleHidden = () => {
    const newVal = !hidden;
    setHidden(newVal);
    localStorage.setItem("lucky-spin-hidden", String(newVal));
  };

  if (!settings?.is_enabled) return null;

  if (hidden) {
    return (
      <button
        onClick={toggleHidden}
        className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors mt-1"
      >
        <DollarSign className="w-3 h-3" />
        Show Lucky Spin
      </button>
    );
  }

  return (
    <div className="w-full max-w-[280px] mt-2">
      <div className="relative bg-gradient-to-br from-yellow-900/40 to-amber-900/30 border border-yellow-500/30 rounded-xl px-3 py-2.5 backdrop-blur-sm">
        {/* Hide button */}
        <button
          onClick={toggleHidden}
          className="absolute top-1.5 right-1.5 text-neutral-500 hover:text-white transition-colors"
          title="Hide Lucky Spin"
        >
          <EyeOff className="w-3.5 h-3.5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">🎰</span>
          <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider">
            Lucky Spin
          </span>
          <span className="text-[9px] text-green-400 ml-auto mr-4 font-bold animate-pulse drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]">
            Earn cash waiting!
          </span>
        </div>

        {/* Prize amounts */}
        <div className="flex items-center justify-center gap-1.5 mb-2 flex-wrap">
          {["$0.10", "$0.50", "$5", "$10", "$25", "$50"].map((prize) => (
            <span
              key={prize}
              className="text-[9px] bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded-full font-bold"
            >
              {prize}
            </span>
          ))}
        </div>

        {/* Slot reels */}
        <div className="flex items-center justify-center gap-2 mb-2">
          {reelSymbols.map((symbol, i) => (
            <div
              key={i}
              className={`w-12 h-12 bg-black/50 rounded-lg border border-yellow-500/20 flex items-center justify-center text-2xl transition-transform ${
                spinning ? "animate-pulse" : ""
              }`}
            >
              {symbol}
            </div>
          ))}
        </div>

        {/* Result display */}
        <div className="h-5 flex items-center justify-center">
          {result?.won && (
            <p className="text-yellow-400 font-black text-sm animate-bounce">
              🎉 YOU WON {result.amount_display}!
            </p>
          )}
          {result && !result.won && (
            <p className="text-neutral-500 text-[10px]">Try again...</p>
          )}
          {!result && spinning && (
            <p className="text-yellow-500/70 text-[10px] animate-pulse">Spinning...</p>
          )}
          {!result && !spinning && (
            <p className="text-neutral-600 text-[10px]">Stay longer for better odds 🍀</p>
          )}
        </div>

        {/* Cash out info */}
        <p className="text-[9px] text-neutral-500 text-center mt-1">
          Winnings go to your balance · Cash out anytime via{" "}
          <span className="text-yellow-500/80">My Rewards → Cash Out</span>
        </p>
      </div>
    </div>
  );
};

export default LuckySpinWidget;
