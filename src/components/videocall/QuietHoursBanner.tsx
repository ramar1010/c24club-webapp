import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Clock, Bell, BellOff, X, Users, Zap, TrendingUp, Check } from "lucide-react";
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
const FULL_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function timeToMinutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function formatTime12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
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
  const baseRef = useRef(Math.floor(Math.random() * 30) + 18);
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
  userGender?: string | null;
}

const QuietHoursBanner = ({ userId, isSearching, userGender }: Props) => {
  const queryClient = useQueryClient();
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

  // Fetch user's slot signups
  const { data: mySignups = [] } = useQuery({
    queryKey: ["slot_signups_mine", userId],
    enabled: userId !== "anonymous",
    queryFn: async () => {
      const { data } = await supabase
        .from("slot_signups")
        .select("window_id")
        .eq("user_id", userId);
      return (data || []).map((s: any) => s.window_id as string);
    },
  });

  // Fetch signup counts per window
  const { data: signupCounts = {} } = useQuery({
    queryKey: ["slot_signup_counts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("slot_signups")
        .select("window_id");
      const counts: Record<string, number> = {};
      for (const row of data || []) {
        counts[row.window_id] = (counts[row.window_id] || 0) + 1;
      }
      return counts;
    },
  });

  const toggleSlotMutation = useMutation({
    mutationFn: async ({ windowId, isSignedUp }: { windowId: string; isSignedUp: boolean }) => {
      if (isSignedUp) {
        const { error } = await supabase
          .from("slot_signups")
          .delete()
          .eq("user_id", userId)
          .eq("window_id", windowId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("slot_signups")
          .upsert({ user_id: userId, window_id: windowId }, { onConflict: "user_id,window_id" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["slot_signups_mine", userId] });
      queryClient.invalidateQueries({ queryKey: ["slot_signup_counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isFemale = userGender?.toLowerCase() === "female";
  const isOptedIn = optin?.is_active ?? false;
  const insideWindow = useMemo(() => isInsideAnyWindow(windows), [windows]);
  const nextWin = useMemo(() => getNextWindow(windows), [windows]);
  const isQuietHours = windows.length > 0 && !insideWindow;

  // Show popup after 8s of searching (always, not just quiet hours)
  useEffect(() => {
    if (!isSearching) {
      setVisible(false);
      setDismissed(false);
      return;
    }
    if (dismissed) return;
    const timer = setTimeout(() => setVisible(true), 8000);
    return () => clearTimeout(timer);
  }, [isSearching, dismissed]);

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

  const [smsConsent, setSmsConsent] = useState(false);

  const handleOptin = async () => {
    if (!phone || phone.replace(/\D/g, "").length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }
    if (mySignups.length === 0) {
      toast.error("Pick at least one slot you'll attend first!");
      return;
    }
    if (!smsConsent) {
      toast.error("Please check the SMS consent box to continue");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms-reminder", {
        body: { action: "optin", phone_number: phone },
      });
      if (error) throw error;
      toast.success("You'll get a text before your selected sessions!");
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
      <div className="mx-4 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl border border-amber-600/40 relative max-h-[90vh] overflow-y-auto">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-amber-700 via-orange-600 to-amber-700 px-5 py-3 flex items-center gap-2 sticky top-0 z-10">
          <Clock className="w-5 h-5 text-amber-200" />
          <span className="text-white font-bold text-sm">Schedule Your Sessions</span>
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

          {/* Explanation */}
          <p className="text-white/60 text-xs leading-relaxed">
            🎯 <span className="text-white/90 font-semibold">Why pick slots?</span> Everyone logs on at the same time ={" "}
            <span className="text-green-400 font-bold">
              {isFemale
                ? "instant matches with guys and more money & rewards"
                : "instant matches with girls"}
            </span>. Pick the sessions you can make it to and we'll text you 5 min before.</p>

          {/* Slot picker */}
          {windows.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-white/80 text-xs font-semibold">📅 Choose your sessions:</p>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1">
                {windows.map((w) => {
                  const isSignedUp = mySignups.includes(w.id);
                  const realCount = signupCounts[w.id] || 0;
                  // Generate a stable fake base from window id chars so it doesn't change on re-render
                  const fakeBase = (w.id.charCodeAt(0) + w.id.charCodeAt(1)) % 20 + 12;
                  const displayCount = realCount + fakeBase;
                  return (
                    <button
                      key={w.id}
                      onClick={() => toggleSlotMutation.mutate({ windowId: w.id, isSignedUp })}
                      disabled={toggleSlotMutation.isPending}
                      className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-all ${
                        isSignedUp
                          ? "bg-green-900/40 border border-green-600/50"
                          : "bg-neutral-800/60 border border-neutral-700/40 hover:border-amber-600/40"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                        isSignedUp ? "bg-green-500" : "bg-neutral-700"
                      }`}>
                        {isSignedUp && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-medium truncate">
                          {FULL_DAY_NAMES[w.day_of_week]} · {formatTime12(w.start_time)} – {formatTime12(w.end_time)}
                        </p>
                        {w.label && (
                          <p className="text-amber-400/70 text-[10px] truncate">{w.label}</p>
                        )}
                      </div>
                      <div className="text-[10px] text-green-400/70 shrink-0 flex items-center gap-1 font-medium">
                        <Users className="w-3 h-3" />
                        {displayCount} joined
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Next session countdown */}
          {nextWin && countdown && (
            <div className="bg-neutral-800/80 rounded-xl px-4 py-2.5 flex items-center gap-3">
              <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-[11px]">
                  Next: <span className="font-bold">{DAY_NAMES[nextWin.window.day_of_week]} {formatTime12(nextWin.window.start_time)}</span>
                </p>
              </div>
              <p className="text-amber-400 font-mono text-sm font-bold">{countdown}</p>
            </div>
          )}

          {/* Benefit callout */}
          <div className="flex items-start gap-2 text-[11px] text-white/50">
            <TrendingUp className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
            <span>Get a text <span className="text-white/80 font-semibold">5 min before</span> your selected slots so you're first in line.</span>
          </div>

          {/* CTA */}
          {isOptedIn ? (
            <div className="text-center space-y-1.5 pt-1">
              <p className="text-green-400 text-xs font-bold">✅ You'll be notified for your selected slots!</p>
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
              <label className="text-white/80 text-xs font-medium">Mobile phone number</label>
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
                  disabled={submitting || mySignups.length === 0 || !smsConsent}
                  className="h-9 text-sm bg-amber-600 hover:bg-amber-500 gap-1 px-4 font-bold"
                >
                  <Bell className="w-3.5 h-3.5" />
                  Text Me
                </Button>
              </div>
              {mySignups.length === 0 && (
                <p className="text-amber-400/80 text-[10px] text-center font-medium">
                  ☝️ Pick at least one slot above to get reminded
                </p>
              )}
              {/* 10DLC compliant SMS consent checkbox — unchecked by default */}
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={smsConsent}
                  onChange={(e) => setSmsConsent(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-500 bg-neutral-800 accent-amber-500 shrink-0"
                />
                <span className="text-white/60 text-[10px] leading-relaxed select-none">
                  I agree to receive recurring automated SMS session reminder messages from C24 Club at the phone number provided. Consent is not a condition of purchase.
                </span>
              </label>
              <p className="text-white/30 text-[10px] text-center leading-relaxed">
                By providing your phone number, you agree to receive SMS session reminders from C24 Club. Message frequency may vary. Standard Message and Data Rates may apply. Reply STOP to opt out. Reply HELP for help. We will not share mobile information with third parties for promotional or marketing purposes. View our{" "}
                <a href="/privacy-policy" className="underline text-amber-400/60 hover:text-amber-400">Privacy Policy</a>{" "}and{" "}
                <a href="/terms" className="underline text-amber-400/60 hover:text-amber-400">Terms of Service</a>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuietHoursBanner;
