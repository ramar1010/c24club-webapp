import { useState } from "react";
import { X, MessageCircle, Crown, DollarSign, ChevronRight, Star, Check } from "lucide-react";

interface BountyGuideModalProps {
  onClose: () => void;
}

type Step = {
  icon: typeof MessageCircle;
  color: string;
  bg: string;
  border: string;
  title: string;
  desc: string;
  bullets?: string[];
};

const steps: Step[] = [
  {
    icon: MessageCircle,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    title: "Chat with guys",
    desc: "Be engaging in DMs and on video calls. Real, fun conversations are what keep guys coming back.",
  },
  {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    title: "Convince them to subscribe",
    desc: "Encourage the guys you talk to to upgrade to Basic or Premium VIP membership.",
  },
  {
    icon: Star,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "You automatically earn minutes",
    desc: "When a guy you've chatted with goes VIP, gifted minutes land in your balance instantly — no action needed.",
    bullets: [
      "125 minutes when they subscribe to Basic VIP",
      "500 minutes when they subscribe to Premium VIP",
      "First-time subscriptions only",
      "Bonus: +500 streak bonus for 3 subscriptions in 7 days",
    ],
  },
  {
    icon: DollarSign,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "Cash out to PayPal",
    desc: "Head to My Profile → Redeem My Minutes and turn your gifted minutes into real cash.",
    bullets: [
      "Redeem minutes at $0.02 per minute",
      "Payments sent directly to your PayPal",
      "Go above & beyond: Get gifted 100, 400, 600, or 1000 minutes by members to earn even faster!",
    ],
  },
];

const tips = [
  "Be genuine and engaging — authentic conversations convert the best.",
  "The more guys you talk to, the more chances they go VIP and pay you.",
  "Keep a streak going: 3 subscriptions within 7 days unlocks a +500 minute bonus.",
  "First-time payments award the bounty — recurring renewals do not.",
  "Go above and beyond: You can also get gifted directly by members (100, 400, 600, or 1000 minutes) to boost your earnings!",
];

export default function BountyGuideModal({ onClose }: BountyGuideModalProps) {
  const [activeStep, setActiveStep] = useState(0);
  const step = steps[activeStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-neutral-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-pink-500/20 to-purple-500/20 px-6 py-5 border-b border-white/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
          <div className="text-center">
            <div className="text-3xl mb-2">💰</div>
            <h2 className="text-lg font-bold text-white">Earn Money DMing Guys</h2>
            <p className="text-sm text-white/50 mt-1">
              Get paid in cash when the guys you chat with go VIP.
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center justify-between mb-4">
            {steps.map((_, idx) => (
              <div key={idx} className="flex items-center flex-1 last:flex-none">
                <button
                  onClick={() => setActiveStep(idx)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    idx === activeStep
                      ? "bg-pink-500 text-white shadow-lg shadow-pink-500/30"
                      : idx < activeStep
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  {idx < activeStep ? "✓" : idx + 1}
                </button>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                      idx < activeStep ? "bg-emerald-500/40" : "bg-white/10"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Active Step Card */}
        <div className="px-6 pb-4">
          <div
            className={`rounded-xl border px-5 py-4 transition-all ${step.bg} ${step.border}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg bg-white/5 ${step.color}`}>
                {(() => {
                  const Icon = step.icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 border border-pink-400/40 rounded-full px-2.5 py-0.5">
                Step {activeStep + 1}
              </span>
            </div>
            <h3 className="font-bold text-white text-base mb-1.5">{step.title}</h3>
            <p className="text-sm text-white/70 leading-relaxed">{step.desc}</p>
            {step.bullets && (
              <ul className="mt-3 space-y-1.5">
                {step.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/80">
                    <Check className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
              disabled={activeStep === 0}
              className="text-sm text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors"
            >
              Back
            </button>
            <button
              onClick={() =>
                setActiveStep((s) => Math.min(steps.length - 1, s + 1))
              }
              disabled={activeStep === steps.length - 1}
              className="flex items-center gap-1 text-sm font-semibold text-pink-400 hover:text-pink-300 disabled:opacity-30 transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Pro Tips */}
        <div className="px-6 pb-6">
          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-amber-300/90 uppercase tracking-wider mb-2">
              ✨ Pro Tips
            </p>
            <ul className="space-y-2">
              {tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="text-pink-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-[11px] text-white/40 text-center mt-3">
            Earnings are paid in gifted minutes redeemable for cash via PayPal. Learn more at c24club.com.
          </p>
        </div>
      </div>
    </div>
  );
}
