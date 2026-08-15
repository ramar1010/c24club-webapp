import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Zap, Bell, BellRing, Users } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PowerHourInviteProps {
  userId: string;
  isFemale: boolean;
  onClose: () => void;
}

/** Returns the next upcoming Power Hour start (UTC) + the session date key. */
function nextSession(startStr: string, endStr: string) {
  const now = new Date();
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);

  const start = new Date(now);
  start.setUTCHours(sh, sm, 0, 0);
  const end = new Date(now);
  end.setUTCHours(eh, em, 0, 0);
  if (end <= start) end.setUTCDate(end.getUTCDate() + 1);

  const isLive = now >= start && now < end;
  let target = start;
  if (now >= end) {
    target = new Date(start);
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return { target, isLive, sessionDate: target.toISOString().slice(0, 10) };
}

const PowerHourInvite = ({ userId, isFemale, onClose }: PowerHourInviteProps) => {
  const qc = useQueryClient();
  const [countdown, setCountdown] = useState("");
  const [saving, setSaving] = useState(false);

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

  const session = useMemo(
    () => (settings ? nextSession(settings.power_hour_start, settings.power_hour_end) : null),
    [settings]
  );

  const { data: signups } = useQuery({
    queryKey: ["power_hour_optins", session?.sessionDate],
    enabled: !!session,
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase
        .from("power_hour_optins")
        .select("user_id, gender")
        .eq("session_date", session!.sessionDate);
      const rows = data ?? [];
      const opposite = rows.filter(
        (r) => (r.gender ?? "").toLowerCase() === (isFemale ? "male" : "female")
      ).length;
      return {
        opposite,
        total: rows.length,
        joined: rows.some((r) => r.user_id === userId),
      };
    },
  });

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((session.target.getTime() - Date.now()) / 1000));
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
  }, [session]);

  const localTime = session
    ? session.target.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : "";

  const handleJoin = async () => {
    if (!session) return;
    setSaving(true);
    const { error } = await supabase.from("power_hour_optins").upsert(
      {
        user_id: userId,
        session_date: session.sessionDate,
        gender: isFemale ? "female" : "male",
      },
      { onConflict: "user_id,session_date" }
    );
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your spot — try again");
      return;
    }
    toast.success("You're in! We'll notify you when Power Hour starts ⚡");
    qc.invalidateQueries({ queryKey: ["power_hour_optins", session.sessionDate] });
  };

  if (!settings || !session) return null;

  const oppositeLabel = isFemale ? "guys" : "girls";
  const oppositeCount = signups?.opposite ?? 0;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-in fade-in duration-200">
      <div className="bg-neutral-900 rounded-2xl p-5 max-w-sm w-full text-center relative border border-amber-600/40">
        <button onClick={onClose} className="absolute top-3 right-3 z-10">
          <X className="w-5 h-5 text-neutral-500 hover:text-white transition-colors" />
        </button>

        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center">
          <Zap className="w-7 h-7 text-amber-400" />
        </div>

        <h2 className="text-xl font-black text-white mb-1">⚡ Join the next Power Hour</h2>
        <p className="text-amber-300 text-sm mb-3">
          Everyone hops on at the same time so the room is packed — no more empty queue.
        </p>

        <div className="bg-neutral-800 rounded-xl px-4 py-3 mb-3 border border-amber-600/30">
          <p className="text-neutral-400 text-[11px] uppercase tracking-wider mb-1">
            {session.isLive ? "Happening now" : `Starts at ${localTime} your time`}
          </p>
          <p className="text-amber-400 font-mono text-2xl font-black tracking-wider">
            {session.isLive ? "LIVE NOW" : countdown || "..."}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 bg-neutral-800/60 rounded-xl py-2.5 mb-4">
          <Users className="w-4 h-4 text-pink-400" />
          <p className="text-white/80 text-xs font-semibold">
            {oppositeCount > 0
              ? `${oppositeCount} ${oppositeLabel} already signed up for this session`
              : `Be one of the first — ${oppositeLabel} get notified too`}
          </p>
        </div>

        {signups?.joined ? (
          <div className="w-full bg-green-600/20 border border-green-500/40 text-green-300 font-bold text-sm py-3 rounded-full flex items-center justify-center gap-2">
            <BellRing className="w-4 h-4" />
            You're on the list — we'll ping you
          </div>
        ) : (
          <button
            onClick={handleJoin}
            disabled={saving}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 text-white font-black text-sm py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <Bell className="w-4 h-4" />
            {saving ? "SAVING..." : "NOTIFY ME & SAVE MY SPOT"}
          </button>
        )}

        <button onClick={onClose} className="mt-3 text-neutral-500 hover:text-white text-xs">
          Keep chatting
        </button>
      </div>
    </div>,
    document.body
  );
};

export default PowerHourInvite;
