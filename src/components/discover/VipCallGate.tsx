import { Crown, Video, X } from "lucide-react";
import { useVipStatus } from "@/hooks/useVipStatus";
import { VIP_TIERS } from "@/config/vip-tiers";

interface VipCallGateProps {
  onClose: () => void;
  onSubscribe: () => void;
  loading?: boolean;
}

const VipCallGate = ({ onClose, onSubscribe, loading }: VipCallGateProps) => {
  return (
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
            Premium VIP Required
          </h2>

          <p className="text-white/60 text-sm leading-relaxed">
            Video calling female members is a <strong className="text-purple-400">Premium VIP</strong> feature.
            Upgrade to unlock unlimited video calls with anyone!
          </p>

          {/* Feature highlights */}
          <div className="w-full bg-white/5 rounded-xl p-4 text-left space-y-2">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">
              Premium VIP includes:
            </p>
            {VIP_TIERS.premium.features.slice(0, 5).map((f, i) => (
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
            onClick={onSubscribe}
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : `Subscribe — ${VIP_TIERS.premium.price}/month`}
          </button>

          <button
            onClick={onClose}
            className="text-white/40 hover:text-white/60 text-sm transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
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
  const hasPremium = vipTier === "premium";
  return isMale && isFemaleTarget && !hasPremium;
}
