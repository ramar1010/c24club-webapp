import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Bell, BellOff, X, Users, Zap, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface CallWindow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  label: string | null;
  is_active: boolean;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getNextWindow(windows: CallWindow[]): { window: CallWindow; startsIn: number } | null {
  if (!windows.length) return null;
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let best: { window: CallWindow; startsIn: number } | null = null;
  for (const w of windows) {
    const startMin = timeToMinutes(w.start_time);
    const endMin = timeToMinutes(w.end_time);
    let dayDiff = w.day_of_week - currentDay;
    if (dayDiff < 0) dayDiff += 7;
    let minutesUntil: number;
    if (dayDiff === 0) {
      if (currentMinutes < startMin) minutesUntil = startMin - currentMinutes;
      else if (currentMinutes < endMin) continue;
      else minutesUntil = 7 * 24 * 60 - currentMinutes + startMin;
    } else {
      minutesUntil = dayDiff * 24 * 60 - currentMinutes + startMin;
    }
    if (!best || minutesUntil < best.startsIn) best = { window: w, startsIn: minutesUntil };
  }
  return best;
}

function isInsideAnyWindow(windows: CallWindow[]): boolean {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return windows.some((w) => {
    if (w.day_of_week !== currentDay) return false;
    const s = timeToMinutes(w.start_time);
    const e = timeToMinutes(w.end_time);
    return currentMinutes >= s && currentMinutes < e;
  });
}

/** Generate a believable fake waiting count that drifts slowly */
function useFakeWaitingCount() {
  const baseRef = useRef(Math.floor(Math.random() * 30) + 18); // 18–47
  const [count, setCount] = useState(baseRef.current);

  useEffect(() => {
    const iv = setInterval(() => {
      const drift = Math.random() > 0.5 ? 1 : -1;
      setCount((prev) => Math.max(8, Math.min(60, prev + drift)));
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(iv);
  }, []);

  return count;
}

interface Props {
  userId: string;
  isSearching: boolean;
}

const QuietHoursBanner = ({ userId, isSearching }: Props) => {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState("");
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const waitingCount = useFakeWaitingCount();

  const { data: windows = [] } = useQuery({
    queryKey: ["call_windows"],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_windows")
        .select("*")
        .eq("is_active", true)
        .order("day_of_week")
        .order("start_time");
      return (data as CallWindow[]) || [];
    },
  });

  const { data: optin, refetch: refetchOptin } = useQuery({
    queryKey: ["sms_optin", userId],
    enabled: userId !== "anonymous",
    queryFn: async () => {
      const { data } = await supabase
        .from("sms_reminder_optins")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return data;
    },
  });

  const isOptedIn = optin?.is_active ?? false;
  const insideWindow = useMemo(() => isInsideAnyWindow(windows), [windows]);
  const nextWin = useMemo(() => getNextWindow(windows), [windows]);
  const isQuietHours = windows.length > 0 && !insideWindow;

  // Show popup after 10s of searching during quiet hours
  useEffect(() => {
    if (!isSearching || !isQuietHours) {
      setVisible(false);
      setDismissed(false);
      return;
    }
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), 10000);
    return () => clearTimeout(timer);
  }, [isSearching, isQuietHours, dismissed]);

  // Countdown ticker
  useEffect(() => {
    if (!nextWin || !visible) return;
    const tick = () => {
      const now = new Date();
      const currentDay = now.getDay();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const currentSeconds = now.getSeconds();
      const startMin = timeToMinutes(nextWin.window.start_time);
      let dayDiff = nextWin.window.day_of_week - currentDay;
      if (dayDiff < 0) dayDiff += 7;
      let totalSeconds: number;
      if (dayDiff === 0 && currentMinutes < startMin) {
        totalSeconds = (startMin - currentMinutes) * 60 - currentSeconds;
      } else {
        const minutesUntil =
          dayDiff === 0 && currentMinutes >= startMin
            ? 7 * 24 * 60 - currentMinutes + startMin
            : dayDiff * 24 * 60 - currentMinutes + startMin;
        totalSeconds = minutesUntil * 60 - currentSeconds;
      }
      if (totalSeconds < 0) totalSeconds = 0;
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      setCountdown(
        h > 0
          ? `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`
          : `${m}m ${String(s).padStart(2, "0")}s`
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [nextWin, visible]);

  const handleOptin = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms-reminder", {
        body: { action: "optin", phone_number: phone },
      });
      if (error) throw error;
      toast.success("You'll get a text before the next session starts!");
      refetchOptin();
    } catch {
      toast.error("Failed to opt in. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOptout = async () => {
    setSubmitting(true);
    try {
      await supabase.functions.invoke("send-sms-reminder", { body: { action: "optout" } });
      toast.success("SMS reminders disabled");
      refetchOptin();
    } catch {
      toast.error("Failed to opt out");
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="mx-4 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-amber-600/40 relative">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700 px-5 py-3 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-200" />
          <span className="text-white font-bold text-sm">Quiet Hours — Low Activity</span>
          <button
            onClick={() => { setVisible(false); setDismissed(true); }}
            className="ml-auto text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-neutral-900 px-5 py-4 space-y-3">
          {/* Fake waiting counter */}
          <div className="flex items-center gap-3 bg-amber-950/40 border border-amber-800/30 rounded-xl px-4 py-2.5">
            <div className="relative">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">{waitingCount} people waiting</p>
              <p className="text-amber-400/70 text-[10px]">for the next session to start</p>
            </div>
          </div>

          {/* Social proof + urgency */}
          <p className="text-white/60 text-xs leading-relaxed">
            It's taking longer to find matches right now. During scheduled sessions, 
            users connect <span className="text-green-400 font-bold">5x faster</span> with 
            way more people online.
          </p>

          {/* Next session info */}
          {nextWin && (
            <div className="bg-neutral-800/80 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-white text-xs font-bold">Next Session</span>
              </div>
              <p className="text-white text-sm font-bold">
                {DAY_NAMES[nextWin.window.day_of_week]}{" "}
                {nextWin.window.start_time.slice(0, 5)}
                {nextWin.window.label ? ` — ${nextWin.window.label}` : ""}
              </p>
              {countdown && (
                <p className="text-amber-400 font-mono text-lg font-bold tracking-wide">
                  {countdown}
                </p>
              )}
            </div>
          )}

          {/* Benefit callout */}
          <div className="flex items-start gap-2 text-[11px] text-white/50">
            <TrendingUp className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
            <span>Get a text <span className="text-white/80 font-semibold">5 min before</span> so you're first in line when everyone logs on.</span>
          </div>

          {/* CTA */}
          {isOptedIn ? (
            <div className="text-center space-y-1.5 pt-1">
              <p className="text-green-400 text-xs font-bold">✅ You'll be notified!</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOptout}
                disabled={submitting}
                className="text-white/40 hover:text-white/70 text-[11px] gap-1"
              >
                <BellOff className="w-3 h-3" />
                Turn off reminders
              </Button>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Input
                  type="tel"
                  placeholder="+1 555 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-9 text-sm bg-neutral-800 border-neutral-600 flex-1"
                />
                <Button
                  size="sm"
                  onClick={handleOptin}
                  disabled={submitting}
                  className="h-9 text-sm bg-amber-600 hover:bg-amber-500 gap-1 px-4 font-bold"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Remind Me
                </Button>
              </div>
              <p className="text-white/30 text-[10px] text-center">
                One text before the session. No spam, unsubscribe anytime.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuietHoursBanner;
