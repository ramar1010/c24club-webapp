import { useState } from "react";
import { createPortal } from "react-dom";
import { Phone, X, Loader2 } from "lucide-react";
import { RECHARGE_PACKS } from "@/config/recharge-packs";
import { startRechargeCheckout } from "@/hooks/useRechargeMinutes";
import { toast } from "@/hooks/use-toast";

interface RechargeGateProps {
  onClose: () => void;
  balance: number;
}

const RechargeGate = ({ onClose, balance }: RechargeGateProps) => {
  const [loading, setLoading] = useState<string | null>(null);

  const buy = async (pack: string) => {
    setLoading(pack);
    try {
      await startRechargeCheckout(pack);
      toast({
        title: "Checkout opened",
        description: "Finish your purchase in the new tab — your minutes appear right after.",
      });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] bg-black/80 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 relative">
        <button onClick={onClose} className="absolute top-3 right-3 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Phone className="w-8 h-8 text-white" />
          </div>

          <h2 className="text-white font-bold text-xl">You're out of call minutes</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Video calls from Discover use call minutes. You have{" "}
            <strong className="text-emerald-400">{balance}</strong> left — top up to keep calling.
          </p>

          <div className="w-full space-y-2">
            {RECHARGE_PACKS.map((p) => (
              <button
                key={p.key}
                onClick={() => buy(p.key)}
                disabled={loading !== null}
                className="w-full flex items-center justify-between gap-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 transition-colors disabled:opacity-50"
              >
                <span className="text-left">
                  <span className="block text-white font-bold text-sm">{p.minutes} call minutes</span>
                  <span className="block text-white/40 text-xs">{p.perMinute}</span>
                </span>
                <span className="flex items-center gap-2">
                  {p.badge && (
                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      {p.badge}
                    </span>
                  )}
                  {loading === p.key ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <span className="text-white font-black text-sm">{p.price}</span>
                  )}
                </span>
              </button>
            ))}
          </div>

          <button onClick={onClose} className="text-white/40 hover:text-white/60 text-sm transition-colors">
            Maybe later
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RechargeGate;
