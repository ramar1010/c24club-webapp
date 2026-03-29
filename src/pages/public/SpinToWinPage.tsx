import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ShoppingCart, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const SEGMENT_COLORS = [
  "#FF6B35", "#004E89", "#F5CB5C", "#2EC4B6",
  "#E71D36", "#9B5DE5", "#00F5D4", "#FF006E",
];

const PRIZE_EMOJIS: Record<string, string> = {
  product_points: "🎁",
  ad_points: "⭐",
  bonus_minutes: "🪙",
  unfreeze: "❄️",
  vip_week: "👑",
  gift_card: "💳",
  chance_enhancer: "🔥",
};

const SPIN_PACKAGES = [
  { spins: 1, price: "0.99" },
  { spins: 2, price: "1.99" },
  { spins: 3, price: "2.50" },
];

const SpinToWinPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [showBuyPanel, setShowBuyPanel] = useState(false);
  const [tab, setTab] = useState<"spin" | "history">("spin");
  const [buyingPackage, setBuyingPackage] = useState<number | null>(null);
  const animRef = useRef<number>(0);

  // Handle purchase redirect
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const purchased = searchParams.get("spin_purchased");
    if (purchased && user) {
      supabase.functions.invoke("buy-spins", {
        body: { type: "verify_purchase", spins: Number(purchased) },
      }).then(() => {
        toast.success(`${purchased} spin(s) added to your account!`);
        queryClient.invalidateQueries({ queryKey: ["spin-balance"] });
      });
    }
  }, [searchParams, user]);

  const { data: prizes = [] } = useQuery({
    queryKey: ["spin-prizes"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("spin-wheel", {
        body: { type: "get_prizes" },
      });
      return data?.prizes || [];
    },
  });

  const { data: spinBalance } = useQuery({
    queryKey: ["spin-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("purchased_spins")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.purchased_spins ?? 0;
    },
  });

  // Fetch chance enhancer
  const { data: ceData } = useQuery({
    queryKey: ["chance-enhancer", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("spin-wheel", {
        body: { type: "get_chance_enhancer", userId: user!.id },
      });
      return data || { chance_enhancer: 10, is_vip: false };
    },
  });

  // Update login tracking on mount
  useEffect(() => {
    if (user) {
      supabase.functions.invoke("spin-wheel", {
        body: { type: "update_login", userId: user.id },
      });
    }
  }, [user]);

  const { data: todaySpin } = useQuery({
    queryKey: ["spin-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("spin_results")
        .select("id")
        .eq("user_id", user!.id)
        .gte("created_at", today + "T00:00:00Z")
        .lte("created_at", today + "T23:59:59Z")
        .limit(1);
      return data && data.length > 0;
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ["spin-history", user?.id],
    enabled: !!user && tab === "history",
    queryFn: async () => {
      const { data } = await supabase
        .from("spin_results")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  // Draw the wheel
  useEffect(() => {
    if (!canvasRef.current || prizes.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;
    const segAngle = (2 * Math.PI) / prizes.length;

    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-center, -center);

    prizes.forEach((prize: any, i: number) => {
      const startAngle = i * segAngle;
      const endAngle = startAngle + segAngle;

      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(center, center);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = "#fff";
      ctx.font = "bold 11px sans-serif";
      ctx.shadowColor = "#000";
      ctx.shadowBlur = 3;
      const emoji = PRIZE_EMOJIS[prize.prize_type] || "🎯";
      const label = prize.label.length > 16 ? prize.label.slice(0, 15) + "…" : prize.label;
      ctx.fillText(`${emoji} ${label}`, radius - 12, 4);
      ctx.restore();
    });

    ctx.restore();

    ctx.beginPath();
    ctx.arc(center, center, 20, 0, 2 * Math.PI);
    ctx.fillStyle = "#1a1a2e";
    ctx.fill();
    ctx.strokeStyle = "#FFD700";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SPIN", center, center);
  }, [prizes, rotation]);

  const executeSpin = async (usePurchased: boolean) => {
    if (spinning || !user) return;

    setSpinning(true);
    setShowResult(false);
    setWonPrize(null);

    const { data } = await supabase.functions.invoke("spin-wheel", {
      body: { type: "spin", userId: user.id, use_purchased: usePurchased },
    });

    if (!data?.success) {
      if (data?.message === "already_spun_today") {
        toast.error("You already used your free spin today!");
      } else if (data?.message === "no_purchased_spins") {
        toast.error("No purchased spins left. Buy more!");
      } else {
        toast.error("Could not spin. Try again.");
      }
      setSpinning(false);
      return;
    }

    const wonPrizeData = data.prize;
    const prizeIndex = prizes.findIndex((p: any) => p.id === wonPrizeData.id);
    const segAngle = 360 / prizes.length;
    const targetSegCenter = prizeIndex * segAngle + segAngle / 2;
    const extraSpins = 5 * 360;
    const targetRotation = extraSpins + (360 - targetSegCenter);
    const startRotation = rotation % 360;
    const totalRotation = targetRotation;
    const duration = 4000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentRotation = startRotation + totalRotation * eased;
      setRotation(currentRotation);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setRotation(currentRotation);
        setWonPrize(wonPrizeData);
        setShowResult(true);
        setSpinning(false);
        queryClient.invalidateQueries({ queryKey: ["spin-today"] });
        queryClient.invalidateQueries({ queryKey: ["spin-balance"] });
        queryClient.invalidateQueries({ queryKey: ["profile-balance"] });
        queryClient.invalidateQueries({ queryKey: ["spin-history"] });
        queryClient.invalidateQueries({ queryKey: ["chance-enhancer"] });
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  const handleBuySpins = async (spins: number) => {
    if (!user) return;
    setBuyingPackage(spins);
    try {
      const { data } = await supabase.functions.invoke("buy-spins", {
        body: { type: "create_checkout", spins },
      });
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error("Could not create checkout");
      }
    } catch {
      toast.error("Something went wrong");
    }
    setBuyingPackage(null);
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const alreadySpun = todaySpin === true;
  const hasPurchasedSpins = (spinBalance ?? 0) > 0;
  const canSpin = !alreadySpun || hasPurchasedSpins;

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Back */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 w-full max-w-sm mb-4">
        <button
          onClick={() => setTab("spin")}
          className={`flex-1 py-2 rounded-full font-black text-sm transition-all ${
            tab === "spin" ? "bg-yellow-500 text-black" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          🎰 SPIN
        </button>
        <button
          onClick={() => setTab("history")}
          className={`flex-1 py-2 rounded-full font-black text-sm transition-all ${
            tab === "history" ? "bg-yellow-500 text-black" : "bg-neutral-800 text-neutral-400"
          }`}
        >
          <Trophy className="w-4 h-4 inline mr-1" />
          PAST WINS
        </button>
      </div>

      {tab === "spin" ? (
        <>
          <h1 className="text-2xl font-black tracking-wide mt-1 mb-1">🎰 SPIN TO WIN</h1>
          <p className="text-neutral-400 text-xs mb-2 text-center">
            Every spin guarantees a reward!
          </p>

          {/* Chance Enhancer display */}
          {ceData && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-full px-4 py-1.5 mb-3 flex items-center gap-2">
              <span className="text-orange-400 text-xs font-black">
                🔥 Chance Enhancer: +{Math.round(ceData.chance_enhancer)}%
              </span>
              {ceData.is_vip && (
                <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-bold">VIP</span>
              )}
            </div>
          )}

          {/* Purchased spins badge */}
          {hasPurchasedSpins && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1 mb-3">
              <span className="text-yellow-400 text-xs font-black">
                🎟️ {spinBalance} purchased spin{spinBalance !== 1 ? "s" : ""} available
              </span>
            </div>
          )}

          {/* Wheel */}
          <div className="relative mb-4">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-10">
              <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400 drop-shadow-lg" />
            </div>
            <canvas
              ref={canvasRef}
              width={300}
              height={300}
              className="rounded-full shadow-2xl border-4 border-yellow-500/50"
            />
          </div>

          {/* Spin Buttons */}
          <div className="w-full max-w-xs space-y-2 mb-4">
            {/* Free daily spin */}
            <button
              onClick={() => executeSpin(false)}
              disabled={spinning || alreadySpun || prizes.length === 0}
              className={`w-full py-3 rounded-full font-black text-lg tracking-wide shadow-lg transition-all ${
                spinning
                  ? "bg-neutral-700 text-neutral-400 cursor-wait"
                  : alreadySpun
                  ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:scale-105 active:scale-95"
              }`}
            >
              {spinning ? "SPINNING..." : alreadySpun ? "FREE SPIN USED" : "🎰 FREE SPIN!"}
            </button>

            {/* Use purchased spin */}
            {hasPurchasedSpins && (
              <button
                onClick={() => executeSpin(true)}
                disabled={spinning}
                className={`w-full py-3 rounded-full font-black text-base tracking-wide shadow-lg transition-all ${
                  spinning
                    ? "bg-neutral-700 text-neutral-400 cursor-wait"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 active:scale-95"
                }`}
              >
                🎟️ USE PURCHASED SPIN ({spinBalance} left)
              </button>
            )}

            {/* Buy Spins */}
            <button
              onClick={() => setShowBuyPanel(!showBuyPanel)}
              className="w-full py-2.5 rounded-full font-black text-sm tracking-wide border-2 border-red-500 text-red-400 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              BUY SPINS
            </button>
          </div>

          {/* Buy Spins Panel */}
          {showBuyPanel && (
            <div className="w-full max-w-xs space-y-3 mb-6 animate-in slide-in-from-top-2 duration-200">
              <h3 className="font-black text-center text-sm text-neutral-300">
                Every spin wins a reward.<br />Rare prizes inside.
              </h3>
              {SPIN_PACKAGES.map((pkg) => (
                <button
                  key={pkg.spins}
                  onClick={() => handleBuySpins(pkg.spins)}
                  disabled={buyingPackage !== null}
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-black text-lg py-3 rounded-full transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {buyingPackage === pkg.spins ? (
                    "Processing..."
                  ) : (
                    <>
                      <span>{pkg.spins} Spin{pkg.spins > 1 ? "s" : ""}</span>
                      <span>{pkg.price}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Prize list */}
          <div className="w-full max-w-sm">
            <h3 className="font-black text-sm mb-2 text-neutral-400">POSSIBLE PRIZES</h3>
            <div className="space-y-1.5">
              {prizes.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between bg-neutral-900 rounded-xl px-3 py-2 border border-neutral-800">
                  <span className="text-sm font-bold">
                    {PRIZE_EMOJIS[p.prize_type] || "🎯"} {p.label}
                  </span>
                  <span className="text-xs text-neutral-500">{p.chance_percent}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        /* PAST WINS TAB */
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-black tracking-wide mb-4 text-center">🏆 PAST WINS</h2>
          {history.length === 0 ? (
            <p className="text-neutral-500 text-sm text-center">No spins yet. Try your luck!</p>
          ) : (
            <div className="space-y-2">
              {history.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-neutral-900 rounded-xl px-4 py-3 border border-neutral-800">
                  <div>
                    <span className="font-bold text-sm">
                      {PRIZE_EMOJIS[r.prize_type] || "🎯"} {r.prize_label}
                    </span>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(r.created_at).toLocaleDateString()} at {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <span className="text-green-400 text-xs font-black">WON</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Result Popup */}
      {showResult && wonPrize && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-yellow-500/40 rounded-3xl p-8 max-w-sm w-full text-center animate-in zoom-in-90 duration-300">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black mb-2">YOU WON!</h2>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6">
              <p className="text-xl font-black text-yellow-400">
                {PRIZE_EMOJIS[wonPrize.prize_type] || "🎯"} {wonPrize.label}
              </p>
            </div>
            <button
              onClick={() => setShowResult(false)}
              className="w-full bg-yellow-500 text-black font-black py-3 rounded-full hover:bg-yellow-400 transition-colors"
            >
              AWESOME!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SpinToWinPage;
