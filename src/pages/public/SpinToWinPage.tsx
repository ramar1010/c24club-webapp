import { useState, useRef, useEffect } from "react";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

const SpinToWinPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [wonPrize, setWonPrize] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const animRef = useRef<number>(0);

  const { data: prizes = [] } = useQuery({
    queryKey: ["spin-prizes"],
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("spin-wheel", {
        body: { type: "get_prizes" },
      });
      return data?.prizes || [];
    },
  });

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

      // Draw segment
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text
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

    // Draw center circle
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

  const handleSpin = async () => {
    if (spinning || !user || todaySpin) return;

    setSpinning(true);
    setShowResult(false);
    setWonPrize(null);

    // Call the backend to get result
    const { data } = await supabase.functions.invoke("spin-wheel", {
      body: { type: "spin", userId: user.id },
    });

    if (!data?.success) {
      if (data?.message === "already_spun_today") {
        toast.error("You already spun today! Come back tomorrow.");
      } else {
        toast.error("Could not spin. Try again.");
      }
      setSpinning(false);
      return;
    }

    const wonPrizeData = data.prize;
    const prizeIndex = prizes.findIndex((p: any) => p.id === wonPrizeData.id);
    const segAngle = 360 / prizes.length;

    // Calculate target rotation to land on the won prize
    // The pointer is at the top (270 degrees in canvas coords = right side)
    const targetSegCenter = prizeIndex * segAngle + segAngle / 2;
    const extraSpins = 5 * 360; // 5 full spins
    const targetRotation = extraSpins + (360 - targetSegCenter);

    // Animate the spin
    const startRotation = rotation % 360;
    const totalRotation = targetRotation;
    const duration = 4000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
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
        queryClient.invalidateQueries({ queryKey: ["profile-balance"] });
      }
    };

    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  const alreadySpun = todaySpin === true;

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Back */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-2xl font-black tracking-wide mt-2 mb-1">🎰 SPIN TO WIN</h1>
      <p className="text-neutral-400 text-xs mb-4 text-center">
        Every spin guarantees a reward! 1 spin per day.
      </p>

      {/* Wheel */}
      <div className="relative mb-6">
        {/* Pointer */}
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

      {/* Spin Button */}
      <button
        onClick={handleSpin}
        disabled={spinning || alreadySpun || prizes.length === 0}
        className={`w-full max-w-xs py-3 rounded-full font-black text-lg tracking-wide shadow-lg transition-all mb-4 ${
          spinning
            ? "bg-neutral-700 text-neutral-400 cursor-wait"
            : alreadySpun
            ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
            : "bg-gradient-to-r from-yellow-500 to-orange-500 text-black hover:scale-105 active:scale-95"
        }`}
      >
        {spinning ? "SPINNING..." : alreadySpun ? "COME BACK TOMORROW" : "🎰 SPIN NOW!"}
      </button>

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
    </div>
  );
};

export default SpinToWinPage;
