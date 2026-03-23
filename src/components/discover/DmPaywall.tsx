import { Crown, MessageCircle, X } from "lucide-react";
import { VIP_TIERS } from "@/config/vip-tiers";

interface DmPaywallProps {
  partnerName: string;
  onClose: () => void;
  onSubscribe: () => void;
  loading?: boolean;
}

const DmPaywall = ({ partnerName, onClose, onSubscribe, loading }: DmPaywallProps) => {
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
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-white font-bold text-xl">
            Upgrade to Keep Chatting
          </h2>

          <p className="text-white/60 text-sm leading-relaxed">
            You've sent 3 free messages to <strong className="text-white">{partnerName}</strong>.
            Subscribe to <strong className="text-blue-400">Basic VIP</strong> for unlimited messaging with all female members!
          </p>

          <div className="w-full bg-white/5 rounded-xl p-4 text-left space-y-2">
            <p className="text-white/80 text-xs font-semibold uppercase tracking-wider mb-2">
              Basic VIP includes:
            </p>
            {VIP_TIERS.basic.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-white/70 text-sm">
                {f.icon ? (
                  <img src={f.icon} alt="" className="w-4 h-4" />
                ) : (
                  <Crown className="w-4 h-4 text-amber-400" />
                )}
                <span>{f.label}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <span>Unlimited DMs to Female Members</span>
            </div>
          </div>

          <button
            onClick={onSubscribe}
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? "Loading..." : `Subscribe — ${VIP_TIERS.basic.price}/week`}
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

export default DmPaywall;
