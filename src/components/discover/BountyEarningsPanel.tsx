import { useState } from "react";
import { DollarSign, Clock, Star } from "lucide-react";
import { useBounty } from "@/hooks/useBounty";
import BountyGuideModal from "@/components/discover/BountyGuideModal";

interface BountyEarningsPanelProps {
  userId: string | null;
}

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  } catch {
    return "";
  }
};

const sourceLabel = (s: string) => {
  switch (s) {
    case "basic": return "basic";
    case "premium": return "premium";
    case "renewal": return "renewal";
    case "streak": return "streak bonus";
    default: return s;
  }
};

const BountyEarningsPanel = ({ userId }: BountyEarningsPanelProps) => {
  const { summary, loading } = useBounty(userId);
  const [showGuide, setShowGuide] = useState(false);

  if (loading || !summary) return null;

  const minutes = summary.total_minutes_earned ?? 0;
  const cash = (summary.total_usd_earned ?? minutes * 0.01).toFixed(2);
  const activeLinks = summary.active_links_count ?? 0;
  const pending = summary.pending_logs ?? [];
  const awarded = (summary.recent_logs ?? []).filter((l) => l.amount_minutes > 0);

  return (
    <>
      <div className="bg-[#1a1f2e] border border-white/10 rounded-2xl p-5 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-pink-500" />
          <h3 className="text-white font-bold text-base">Lifetime Bounty History</h3>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 text-center">
            <div className="text-pink-400 text-2xl font-black leading-none">{minutes}</div>
            <div className="text-white/60 text-[10px] mt-1.5">Minutes earned</div>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 text-center">
            <div className="text-pink-400 text-2xl font-black leading-none">${cash}</div>
            <div className="text-white/60 text-[10px] mt-1.5">Cash value</div>
          </div>
          <div className="bg-pink-500/10 border border-pink-500/30 rounded-xl p-3 text-center">
            <div className="text-pink-400 text-2xl font-black leading-none">{activeLinks}</div>
            <div className="text-white/60 text-[10px] mt-1.5">Active tracks</div>
          </div>
        </div>

        {/* Pending Tracker */}
        <div className="space-y-2">
          <div className="text-white font-bold text-sm">Pending Tracker</div>
          <p className="text-white/40 text-xs">
            You'll earn a bounty if these guys go VIP in the next 7 days.
          </p>
          <p className="text-white/40 text-[11px] italic">
            Note: Only the partner with the most recent interaction gets the bounty!
          </p>

          {pending.length === 0 ? (
            <p className="text-white/30 text-xs italic pt-2">
              No active tracks yet — chat with guys on video calls or DMs to start tracking bounties.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500/20 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <div className="text-blue-400 font-bold text-sm">{p.partner_name || "Member"}</div>
                      <div className="text-white/50 text-[11px]">
                        Tracked via {p.interaction_type === "dm" ? "DM" : "Video Call"}
                      </div>
                    </div>
                  </div>
                  <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2.5 py-1 rounded tracking-wider">
                    TRACKING
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Awarded Bounties */}
        <div className="space-y-2 pt-2">
          <div className="text-white font-bold text-sm">Awarded Bounties</div>
          {awarded.length === 0 ? (
            <p className="text-white/30 text-xs italic">
              No bounties awarded yet — convert your first guy to VIP to earn minutes!
            </p>
          ) : (
            <div className="space-y-2">
              {awarded.map((a) => (
                <div key={a.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-pink-500/20 flex items-center justify-center">
                      <Star className="w-4 h-4 text-pink-400 fill-pink-400" />
                    </div>
                    <div>
                      <div className="text-pink-400 font-bold text-sm">+{a.amount_minutes} minutes</div>
                      <div className="text-white/50 text-[11px]">
                        From: {a.partner_name || "Member"} · {sourceLabel(a.source)}
                      </div>
                    </div>
                  </div>
                  <span className="text-white/40 text-[11px]">{formatDate(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer link */}
        <div className="pt-2 text-center">
          <button
            onClick={() => setShowGuide(true)}
            className="text-pink-400 hover:text-pink-300 font-bold text-sm transition-colors"
          >
            Learn how to earn more →
          </button>
        </div>
      </div>

      {showGuide && <BountyGuideModal onClose={() => setShowGuide(false)} />}
    </>
  );
};

export default BountyEarningsPanel;
