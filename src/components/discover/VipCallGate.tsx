import { useState } from "react";
import { createPortal } from "react-dom";
import { Video, X } from "lucide-react";
import { VIP_TIERS } from "@/config/vip-tiers";

interface VipCallGateProps {
  onClose: () => void;
  onSubscribe: (priceId: string) => void;
  loading?: boolean;
}

const VipCallGate = ({ onClose, onSubscribe, loading }: VipCallGateProps) => {
  const [tier, setTier] = useState<"basic" | "premium">("premium");
  const selected = VIP_TIERS[tier];
  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/40 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <Video className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-white font-bold text-xl">
            VIP Required
          </h2>

          <p className="text-white/60 text-sm leading-relaxed">
            Video calling female members is a <strong className="text-purple-400">VIP</strong> feature.
            Subscribe to any VIP plan to unlock video calls with anyone!
          </p>

          {/* Plan options */}
          <div className="w-full grid grid-cols-2 gap-2">
            {(["basic", "premium"] as const).map((key) => {
              const t = VIP_TIERS[key];
              const active = tier === key;
              return (
                <button
                  key={key}
                  onClick={() => setTier(key)}
                  className={`rounded-xl border-2 p-3 text-left transition-all ${
                    active
                      ? "border-purple-400 bg-purple-500/15"
                      : "border-white/10 bg-white/5 hover:border-white/25"
                  }`}
                >
                  <p className="text-white font-bold text-lg leading-none">{t.price}</p>
                  <p className="text-white/50 text-[11px] mt-1">per {t.interval}</p>
                  <p className="text-white/80 text-xs font-semibold mt-1">{t.name}</p>
                </button>
              );
            })}
          </div>

          {/* Feature highlights */}
          <div className="w-full bg-white/5 rounded-xl p-4 text-left space-y-2">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">
              {selected.name} includes:
            </p>
            {selected.features.slice(0, 5).map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-white/70 text-sm">
                {f.icon ? (
                  <img src={f.icon} alt="" className="w-4 h-4" />
                ) : (
                  <span className="text-sm leading-none">👩</span>
                )}
                <span>{f.label}</span>
              </div>
            ))}
            <p className="text-white/40 text-xs mt-1">...and much more</p>
          </div>

          <button
            onClick={() => onSubscribe(selected.price_id)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : `Subscribe — ${selected.price}/${selected.interval}`}
          </button>

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default VipCallGate;

/**
 * Helper: returns true if the caller (male) should be blocked from calling
 * a female user because they lack Premium VIP.
 */
export function shouldBlockCall(
  callerGender: string | null,
  targetGender: string | null,
  vipTier: string | null
): boolean {
  const isMale = callerGender?.toLowerCase() === "male";
  const isFemaleTarget = targetGender?.toLowerCase() === "female";
  const hasVip = vipTier === "premium" || vipTier === "basic";
  return isMale && isFemaleTarget && !hasVip;
}
