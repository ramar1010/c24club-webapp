import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface EarnStats {
  thisMonth: number;
  thisWeek: number;
  yesterday: number;
  today: number;
}

interface LogEntry {
  date: string;
  minutes: number;
  description: string;
}

const EarnHistoryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<EarnStats>({ thisMonth: 0, thisWeek: 0, yesterday: 0, today: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchHistory = async () => {
      setLoading(true);

      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      // Start of this week (Monday)
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - mondayOffset);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      // Start of this month
      const monthStartStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

      // Last 30 days
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 30);
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().slice(0, 10);

      // Fetch all earn sources for the last 30 days.
      const [callLogsRes, bountyRes] = await Promise.all([
        supabase
          .from("call_minutes_log")
          .select("session_date, minutes_earned")
          .eq("user_id", user.id)
          .gte("session_date", thirtyDaysAgoStr)
          .order("session_date", { ascending: false }),
        supabase
          .from("bounty_earnings")
          .select("created_at, amount_minutes, source, male_id, clawed_back")
          .eq("female_id", user.id)
          .eq("clawed_back", false)
          .gt("amount_minutes", 0)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false }),
      ]);

      const callEntries: LogEntry[] = (callLogsRes.data ?? []).map((entry) => ({
        date: entry.session_date,
        minutes: entry.minutes_earned,
        description: `${entry.minutes_earned} minutes added for a video call.`,
      }));

      const bountyEntries: LogEntry[] = (bountyRes.data ?? []).map((entry) => {
        const date = entry.created_at.slice(0, 10);
        const tierLabel =
          entry.source === "premium"
            ? "Premium VIP bounty"
            : entry.source === "basic"
            ? "Basic VIP bounty"
            : entry.source === "renewal"
            ? "VIP renewal bounty"
            : "Bounty streak bonus";

        return {
          date,
          minutes: entry.amount_minutes,
          description: `${entry.amount_minutes} gifted minutes added from ${tierLabel}.`,
        };
      });

      const entries = [...callEntries, ...bountyEntries].sort((a, b) => b.date.localeCompare(a.date));

      let thisMonth = 0, thisWeek = 0, yesterdayTotal = 0, todayTotal = 0;

      for (const e of entries) {
        const d = e.date;
        if (d >= monthStartStr) thisMonth += e.minutes;
        if (d >= weekStartStr) thisWeek += e.minutes;
        if (d === yesterdayStr) yesterdayTotal += e.minutes;
        if (d === todayStr) todayTotal += e.minutes;
      }

      setStats({ thisMonth, thisWeek, yesterday: yesterdayTotal, today: todayTotal });
      setLogs(entries);
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      {/* Back button */}
      <div className="w-full flex items-center pt-3 pb-2">
        <button
          onClick={() => navigate("/settings")}
          className="flex items-center gap-1 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      {/* Title */}
      <h1 className="text-3xl font-black italic tracking-wide mt-2 mb-6">Earn History</h1>

      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : (
        <>
          {/* Stats pills */}
          <div className="flex flex-col items-center gap-3 mb-8 w-full max-w-xs">
            <StatPill label="This Month" value={stats.thisMonth} wide />
            <StatPill label="This Week" value={stats.thisWeek} />
            <StatPill label="Yesterday" value={stats.yesterday} />
            <StatPill label="Today" value={stats.today} small />
          </div>

          {/* Log table */}
          <div className="w-full max-w-md">
            <div className="bg-neutral-800 rounded-t-lg px-4 py-2">
              <p className="text-center text-sm font-black tracking-wide">
                Rewards received from other sources in last 30 days
              </p>
            </div>
            <div className="bg-red-600 max-h-64 overflow-y-auto divide-y divide-red-700">
              {logs.length === 0 ? (
                <p className="text-center py-4 text-sm opacity-70">No entries found</p>
              ) : (
                logs.map((entry, i) => (
                  <div key={i} className="flex items-center px-4 py-2 text-sm gap-4">
                    <span className="font-bold whitespace-nowrap">{entry.date}</span>
                    <span>- {entry.description}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatPill = ({ label, value, wide, small }: { label: string; value: number; wide?: boolean; small?: boolean }) => (
  <div
    className={`bg-gradient-to-r from-sky-500 to-sky-600 text-white font-black text-center py-2.5 rounded-full shadow-lg border border-sky-400/40 ${
      wide ? "w-64 text-lg" : small ? "w-48 text-base" : "w-56 text-base"
    }`}
  >
    {label}: {value}
    <br />
    <span className="text-sm font-bold">minutes</span>
  </div>
);

export default EarnHistoryPage;
