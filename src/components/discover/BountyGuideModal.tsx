import { useState } from "react";
import { X, MessageCircle, Video, Crown, DollarSign, ChevronRight, Star } from "lucide-react";

interface BountyGuideModalProps {
  onClose: () => void;
}

const steps = [
  {
    icon: MessageCircle,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
    title: "Chat with guys",
    desc: "Be fun and engaging in DMs and video calls. The more you chat, the more chances you have.",
  },
  {
    icon: Crown,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    title: "Convince them to subscribe",
    desc: "Encourage guys to upgrade to Basic or Premium VIP so they can unlock unlimited calls and DMs with you.",
  },
  {
    icon: Star,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    title: "You automatically earn minutes",
    desc: "When a guy you recently chatted with subscribes, you get gifted minutes as a bounty reward — no extra steps needed!",
  },
  {
    icon: DollarSign,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    title: "Cash out to PayPal",
    desc: "Go to My Rewards → Cashout Minutes to convert your gifted minutes into real cash sent to your PayPal.",
  },
];

const tips = [
  "Last-touch wins: the girl who chatted with him most recently (within 7 days) gets the bounty.",
  "Video calls count too — private call gifts even give you a 20% bonus!",
  "There is no limit to how many guys you can convert. More chats = more earnings.",
];

export default function BountyGuideModal({ onClose }: BountyGuideModalProps) {
  const [activeStep, setActiveStep] = useState(0);

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
          <div className="text-3xl mb-2">💰</div>
          <h2 className="text-lg font-bold text-white">How to Earn Gifted Minutes</h2>
          <p className="text-sm text-white/50 mt-1">
            Turn casual chats into real cash — here is the simple formula.
          </p>
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
            className={`rounded-xl border px-5 py-4 transition-all ${steps[activeStep].bg} ${steps[activeStep].border}`}
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg bg-white/5 ${steps[activeStep].color}`}>
                {(() => {
                  const Icon = steps[activeStep].icon;
                  return <Icon className="w-5 h-5" />;
                })()}
              </div>
              <h3 className="font-bold text-white text-sm">{steps[activeStep].title}</h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              {steps[activeStep].desc}
            </p>
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
            <p className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
              Pro Tips
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
        </div>
      </div>
    </div>
  );
}
