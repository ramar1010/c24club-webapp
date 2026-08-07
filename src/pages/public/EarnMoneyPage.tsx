import { Link } from "react-router-dom";
import { Crown, Gift, Video, DollarSign, Check, MessageCircle } from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";

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

export default function EarnMoneyPage() {
  usePageMeta({
    title: "Earn Money DMing Guys | C24 Club",
    description:
      "The 4 ways women earn real money on C24 Club: VIP conversions, gifted minutes, video call recharges, and PayPal cash out.",
    path: "/earn-money",
  });

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <header className="text-center mb-8">
          <div className="text-4xl mb-3">💰</div>
          <h1 className="text-2xl md:text-3xl font-bold">4 Ways To Earn Money</h1>
          <p className="text-sm text-white/50 mt-2">
            Everything below is how girls make real cash on C24 Club.
          </p>
        </header>

        <div className="space-y-5">
          {methods.map((m) => {
            const Icon = m.icon;
            return (
              <section key={m.title} className={`rounded-2xl border px-5 py-5 ${m.bg} ${m.border}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-lg bg-white/5 ${m.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">{m.title}</h2>
                    <p className={`text-xs font-semibold ${m.color}`}>{m.payout}</p>
                  </div>
                </div>

                <p className="text-sm text-white/60 mb-4">{m.short}</p>

                <p className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">
                  How it works
                </p>
                <ol className="space-y-2 mb-4">
                  {m.how.map((h, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-white/80">
                      <span className="w-5 h-5 shrink-0 rounded-full bg-white/10 text-[11px] font-bold flex items-center justify-center text-white/70">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{h}</span>
                    </li>
                  ))}
                </ol>

                <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <p className="text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-2">
                    ✨ Good to know
                  </p>
                  <ul className="space-y-2">
                    {m.tips.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                        <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            );
          })}
        </div>

        <div className="mt-8 space-y-3">
          <Link
            to="/discover"
            className="block w-full text-center rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black text-sm py-3.5 hover:opacity-90 transition-opacity"
          >
            Start Chatting With Guys
          </Link>
          <Link
            to="/earnings-chat"
            className="w-full rounded-xl bg-pink-500/15 border border-pink-500/40 text-pink-300 font-bold text-sm py-3 flex items-center justify-center gap-2 hover:bg-pink-500/25 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Girls Only Earnings Chat
          </Link>
          <Link
            to="/profile"
            className="w-full rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm py-3 flex items-center justify-center gap-2 transition-colors"
          >
            <DollarSign className="w-4 h-4" />
            Redeem My Minutes For Cash
          </Link>
          <p className="text-[11px] text-white/40 text-center">
            You can also earn extra minutes from Weekly Challenges, Spin to Win, and inviting friends.
          </p>
        </div>
      </div>
    </div>
  );
}
