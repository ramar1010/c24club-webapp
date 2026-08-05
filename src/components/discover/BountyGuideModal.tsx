import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { X, Crown, Gift, Video, DollarSign, ChevronRight, ChevronLeft, Check, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CashoutModal from "@/components/discover/CashoutModal";

interface BountyGuideModalProps {
  onClose: () => void;
}

type Method = {
  icon: typeof Crown;
  color: string;
  bg: string;
  border: string;
  title: string;
  short: string;
  payout: string;
  how: string[];
  tips: string[];
};

const methods: Method[] = [
  {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    title: "1. Get guys to go VIP",
    short: "Biggest payout. Up to 500 minutes each.",
    payout: "125 – 500 minutes",
    how: [
      "DM guys and be fun and engaging.",
      "He only gets 3 free messages — after that he must buy VIP to keep talking to you.",
      "When he subscribes, minutes land in your balance automatically.",
    ],
    tips: [
      "125 minutes when he buys Basic VIP",
      "500 minutes when he buys Premium VIP",
      "First-time subscriptions only (not renewals)",
      "+500 bonus if 3 guys subscribe within 7 days",
    ],
  },
  {
    icon: Gift,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/30",
    title: "2. Get gifted minutes",
    short: "Guys send you minutes directly during calls or DMs.",
    payout: "100 – 1000 minutes per gift",
    how: [
      "Guys can gift you minutes while video calling or messaging you.",
      "Gifts go straight into your balance — nothing for you to claim.",
      "The nicer the vibe, the bigger the gifts.",
    ],
    tips: [
      "Gift tiers: 100, 400, 600 or 1000 minutes",
      "Thank him — repeat gifters are the best earners",
      "Being verified in Discover gets you way more gifts",
    ],
  },
  {
    icon: Video,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    title: "3. Guys recharge minutes",
    short: "He buys minutes, you earn them while you talk.",
    payout: "Earn minutes every minute on call",
    how: [
      "Guys buy (recharge) minutes so they can keep video calling.",
      "When you video call him, you collect minutes as the call goes on.",
      "Longer calls = more minutes for you. No extra steps.",
    ],
    tips: [
      "Stay on the call — quick skips cut your earnings",
      "Regulars who recharge often are your best income",
      "Answer calls from Discover to get more call time",
    ],
  },
  {
    icon: DollarSign,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    title: "4. Cash out to PayPal",
    short: "Turn the minutes you earned into real money.",
    payout: "$0.02 per minute",
    how: [
      "Go to My Profile → Redeem My Minutes.",
      "Choose how many minutes to cash out.",
      "Money is sent straight to your PayPal.",
    ],
    tips: [
      "500 minutes = $10",
      "You can also spend minutes in the Reward Store instead",
      "Only gifted / earned minutes are cashable",
    ],
  },
];

export default function BountyGuideModal({ onClose }: BountyGuideModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selected, setSelected] = useState<number | null>(null);
  const [showCashout, setShowCashout] = useState(false);
  const method = selected !== null ? methods[selected] : null;

  const { data: cashoutBalance, refetch: refetchCashout } = useQuery({
    queryKey: ["bounty-guide-cashout-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: minutesData }, { data: bountyData }] = await Promise.all([
        supabase
          .from("member_minutes")
          .select("total_minutes, gifted_minutes")
          .eq("user_id", user!.id)
          .maybeSingle(),
        supabase
          .from("bounty_earnings")
          .select("amount_minutes")
          .eq("female_id", user!.id)
          .eq("clawed_back", false)
          .eq("paid_out", false)
          .gt("amount_minutes", 0),
      ]);
      const gifted = (minutesData as any)?.gifted_minutes ?? 0;
      const bountyTotal = (bountyData || []).reduce(
        (sum: number, b: any) => sum + (b.amount_minutes || 0),
        0,
      );
      return { total: minutesData?.total_minutes ?? 0, gifted, bounty: bountyTotal };
    },
  });

  const cashableMinutes = (cashoutBalance?.gifted ?? 0) + (cashoutBalance?.bounty ?? 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-6 pt-7 pb-5 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-6 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5 text-white/70" />
          </button>
          <div className="text-center">
            <div className="text-3xl mb-2">💰</div>
            <h2 className="text-lg font-bold text-white">4 Ways To Earn Money</h2>
            <p className="text-sm text-white/50 mt-1">
              Tap any way below to see exactly how it works.
            </p>
          </div>
        </div>

        {/* Menu */}
        {method === null && (
          <div className="px-5 py-5 space-y-3">
            {methods.map((m, idx) => {
              const Icon = m.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setSelected(idx)}
                  className={`w-full text-left rounded-xl border px-4 py-4 flex items-center gap-3 transition-all hover:brightness-125 ${m.bg} ${m.border}`}
                >
                  <div className={`p-2.5 rounded-lg bg-white/5 shrink-0 ${m.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-white text-sm">{m.title}</h3>
                    <p className="text-xs text-white/60 mt-0.5">{m.short}</p>
                    <p className={`text-xs font-semibold mt-1.5 ${m.color}`}>{m.payout}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              );
            })}

            <button
              onClick={() => setShowCashout(true)}
              className="w-full mt-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-sm py-3 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              <DollarSign className="w-4 h-4" />
              REDEEM MINUTES FOR CASH ({cashableMinutes} cashable)
            </button>

            <button
              onClick={() => {
                onClose();
                navigate("/earnings-chat");
              }}
              className="w-full rounded-xl bg-pink-500/15 border border-pink-500/40 text-pink-300 font-bold text-sm py-3 flex items-center justify-center gap-2 hover:bg-pink-500/25 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Girls Only Earnings Chat
            </button>

            <button
              onClick={() => {
                onClose();
                navigate("/discover");
              }}
              className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm py-3 transition-colors"
            >
              Start Chatting With Guys
            </button>
            <p className="text-[11px] text-white/40 text-center">
              You can also earn extra minutes from Weekly Challenges, Spin to Win, and inviting friends.
            </p>
          </div>
        )}

        {/* Detail */}
        {method && (
          <div className="px-5 py-5">
            <button
              onClick={() => setSelected(null)}
              className="flex items-center gap-1 text-xs text-white/50 hover:text-white/80 mb-3 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> All ways to earn
            </button>

            <div className={`rounded-xl border px-5 py-4 ${method.bg} ${method.border}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-lg bg-white/5 ${method.color}`}>
                  {(() => {
                    const Icon = method.icon;
                    return <Icon className="w-5 h-5" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">{method.title}</h3>
                  <p className={`text-xs font-semibold ${method.color}`}>{method.payout}</p>
                </div>
              </div>

              <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">
                How it works
              </p>
              <ol className="space-y-2">
                {method.how.map((h, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                    <span className="w-5 h-5 shrink-0 rounded-full bg-white/10 text-[11px] font-bold flex items-center justify-center text-white/70">
                      {i + 1}
                    </span>
                    <span className="leading-snug">{h}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 mt-3">
              <p className="text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-2">
                ✨ Good to know
              </p>
              <ul className="space-y-2">
                {method.tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => setShowCashout(true)}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-sm py-3 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <DollarSign className="w-4 h-4" />
                REDEEM MINUTES FOR CASH ({cashableMinutes} cashable)
              </button>
              <button
                onClick={() => {
                  onClose();
                  navigate("/discover");
                }}
                className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm py-3 transition-colors"
              >
                Start Chatting With Guys
              </button>
            </div>
          </div>
        )}
      </div>

      {showCashout && (
        <CashoutModal
          onClose={() => setShowCashout(false)}
          currentMinutes={cashoutBalance?.total ?? 0}
          giftedMinutes={cashoutBalance?.gifted ?? 0}
          bountyMinutes={cashoutBalance?.bounty ?? 0}
          onSuccess={() => refetchCashout()}
        />
      )}
    </div>
  );
}
