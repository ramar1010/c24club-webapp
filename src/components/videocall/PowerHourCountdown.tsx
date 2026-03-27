import { useState, useEffect, useMemo } from "react";
import { X, Clock, Zap, Users, Heart, Trophy } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PowerHourCountdownProps {
  onDismiss: () => void;
  isFemale: boolean;
}

const PowerHourCountdown = ({ onDismiss, isFemale }: PowerHourCountdownProps) => {
  const [countdown, setCountdown] = useState("");
  const [isLive, setIsLive] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["anchor_settings_power_hour"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anchor_settings")
        .select("power_hour_start, power_hour_end")
        .limit(1)
        .single();
      return data;
    },
    staleTime: 60000,
  });

  // Fetch opposite-gender count for social proof
  const { data: oppositeCount } = useQuery({
    queryKey: ["power_hour_opposite_count", isFemale],
    queryFn: async () => {
      const { count } = await supabase
        .from("members")
        .select("*", { count: "exact", head: true })
        .eq("gender", isFemale ? "male" : "female");
      // Add a small random boost for excitement
      const boost = Math.floor(Math.random() * 6) + 3;
      return Math.min((count || 0) + boost, isFemale ? 30 : 25);
    },
    staleTime: 300000,
  });

  useEffect(() => {
    if (!settings) return;

    const tick = () => {
      const now = new Date();
      const [phH, phM] = settings.power_hour_start.split(":").map(Number);
      const [peH, peM] = settings.power_hour_end.split(":").map(Number);

      // Build today's power hour start/end in UTC
      const start = new Date(now);
      start.setUTCHours(phH, phM, 0, 0);
      const end = new Date(now);
      end.setUTCHours(peH, peM, 0, 0);
      if (end <= start) end.setUTCDate(end.getUTCDate() + 1);

      if (now >= start && now < end) {
        setIsLive(true);
        setCountdown("");
        return;
      }

      setIsLive(false);

      // If power hour passed today, show tomorrow's
      let target = start;
      if (now >= end) {
        target = new Date(start);
        target.setUTCDate(target.getUTCDate() + 1);
      }

      const diff = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000));
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${m}m ${String(s).padStart(2, "0")}s`
      );
    };

    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [settings]);

  if (!settings) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-300">
      <div className="bg-neutral-900 rounded-2xl p-5 max-w-sm w-full text-center relative border border-amber-600/40 overflow-hidden">
        {/* Animated glow background */}
        <div className="absolute inset-0 bg-gradient-to-b from-amber-600/10 via-transparent to-orange-600/10 pointer-events-none" />

        <button onClick={onDismiss} className="absolute top-3 right-3 z-10">
          <X className="w-5 h-5 text-neutral-500 hover:text-white transition-colors" />
        </button>

        {isLive ? (
          <>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center animate-pulse">
                <Zap className="w-8 h-8 text-green-400" />
              </div>

              <h2 className="text-2xl font-black text-white mb-1">
                ⚡ Power Hour is LIVE!
              </h2>

              <p className="text-green-400 font-bold text-sm mb-3">
                {isFemale
                  ? "Maximum earning potential right now!"
                  : "Girls are online now — start chatting!"}
              </p>

              <div className="bg-green-900/30 border border-green-600/30 rounded-xl p-3 mb-4">
                {isFemale ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-center">
                      <Trophy className="w-4 h-4 text-yellow-400" />
                      <span className="text-white text-sm font-bold">Peak earning time — more guys online!</span>
                    </div>
                    <p className="text-green-300/80 text-xs">
                      You'll earn minutes faster during Power Hour. Start chatting now to maximize your rewards!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 justify-center">
                      <Heart className="w-4 h-4 text-pink-400" />
                      <span className="text-white text-sm font-bold">More girls are online right now!</span>
                    </div>
                    <p className="text-green-300/80 text-xs">
                      Power Hour brings the most active users together. Hit Start to find your next match instantly!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={onDismiss}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-sm py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide"
              >
                🚀 START CHATTING NOW
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="relative z-10">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center">
                <Clock className="w-8 h-8 text-amber-400" />
              </div>

              <h2 className="text-2xl font-black text-white mb-1">
                ⏳ Power Hour Starting Soon!
              </h2>

              <p className="text-amber-300 text-sm mb-3">
                {isFemale
                  ? "Get ready to earn — the busiest session is about to begin!"
                  : "Get ready — the best time to meet new people is almost here!"}
              </p>

              {/* Countdown */}
              <div className="bg-neutral-800 rounded-xl px-6 py-4 mb-4 border border-amber-600/30">
                <p className="text-neutral-400 text-xs uppercase tracking-wider mb-1">Starts in</p>
                <p className="text-amber-400 font-mono text-3xl font-black tracking-wider">
                  {countdown || "..."}
                </p>
              </div>

              {/* Tips while waiting */}
              <div className="bg-neutral-800/60 rounded-xl p-3 mb-4 text-left space-y-2">
                <p className="text-white/80 text-xs font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                  While you wait:
                </p>
                {isFemale ? (
                  <>
                    <p className="text-white/50 text-[11px] pl-5">✅ Make sure your profile is updated for more gifts</p>
                    <p className="text-white/50 text-[11px] pl-5">✅ Check the Reward Store for new items</p>
                    <p className="text-white/50 text-[11px] pl-5">✅ You can start chatting now — Power Hour just boosts activity!</p>
                  </>
                ) : (
                  <>
                    <p className="text-white/50 text-[11px] pl-5">✅ You can start chatting now — don't have to wait!</p>
                    <p className="text-white/50 text-[11px] pl-5">✅ Check out the Discover page to find people to call</p>
                    <p className="text-white/50 text-[11px] pl-5">✅ Power Hour just means more active users — the party gets bigger!</p>
                  </>
                )}
              </div>

              <button
                onClick={onDismiss}
                className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide"
              >
                👍 GOT IT — START CHATTING
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PowerHourCountdown;
