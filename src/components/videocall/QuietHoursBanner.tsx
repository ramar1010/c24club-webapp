import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Bell, BellOff } from "lucide-react";
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
      if (currentMinutes < startMin) {
        minutesUntil = startMin - currentMinutes;
      } else if (currentMinutes < endMin) {
        // Currently inside this window — not quiet hours for this window
        continue;
      } else {
        minutesUntil = (7 * 24 * 60) - currentMinutes + startMin;
      }
    } else {
      minutesUntil = dayDiff * 24 * 60 - currentMinutes + startMin;
    }

    if (!best || minutesUntil < best.startsIn) {
      best = { window: w, startsIn: minutesUntil };
    }
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

interface Props {
  userId: string;
}

const QuietHoursBanner = ({ userId }: Props) => {
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState("");

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

  // Update countdown every second
  useEffect(() => {
    if (!nextWin) return;
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
            ? (7 * 24 * 60 - currentMinutes + startMin)
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
  }, [nextWin]);

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
      toast.success("You'll get SMS reminders before sessions start!");
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
      await supabase.functions.invoke("send-sms-reminder", {
        body: { action: "optout" },
      });
      toast.success("SMS reminders disabled");
      refetchOptin();
    } catch {
      toast.error("Failed to opt out");
    } finally {
      setSubmitting(false);
    }
  };

  // Don't show banner if no windows configured or we're inside a window
  if (!windows.length || insideWindow) return null;

  return (
    <div className="mx-3 mb-2 px-4 py-3 bg-amber-900/40 border border-amber-700/50 rounded-xl">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="w-4 h-4 text-amber-400" />
        <span className="text-amber-300 text-sm font-bold">Quiet Hours — Low Activity</span>
      </div>

      {nextWin && (
        <p className="text-white/70 text-xs mb-2">
          Next session:{" "}
          <span className="text-white font-bold">
            {DAY_NAMES[nextWin.window.day_of_week]}{" "}
            {nextWin.window.start_time.slice(0, 5)}
            {nextWin.window.label ? ` — ${nextWin.window.label}` : ""}
          </span>
          {countdown && (
            <span className="text-amber-400 ml-1 font-mono">({countdown})</span>
          )}
        </p>
      )}

      <p className="text-white/50 text-[11px] mb-2">
        You can still chat, but matches may take longer. Get notified before the next session!
      </p>

      {isOptedIn ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOptout}
          disabled={submitting}
          className="text-amber-400 hover:text-amber-300 text-xs gap-1"
        >
          <BellOff className="w-3 h-3" />
          Turn off SMS reminders
        </Button>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="tel"
            placeholder="+1 555 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-8 text-xs bg-neutral-800 border-neutral-600 w-40"
          />
          <Button
            size="sm"
            onClick={handleOptin}
            disabled={submitting}
            className="h-8 text-xs bg-amber-600 hover:bg-amber-500 gap-1"
          >
            <Bell className="w-3 h-3" />
            Notify Me
          </Button>
        </div>
      )}
    </div>
  );
};

export default QuietHoursBanner;
