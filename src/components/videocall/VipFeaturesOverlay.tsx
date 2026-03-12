import { X } from "lucide-react";
import { VIP_TIERS } from "@/config/vip-tiers";
import { toast } from "sonner";

interface VipFeaturesOverlayProps {
  onClose: () => void;
  currentTier: "basic" | "premium" | null;
  onPurchase: (priceId: string) => Promise<void>;
  onManage?: () => Promise<void>;
}

const VipFeaturesOverlay = ({ onClose, currentTier, onPurchase, onManage }: VipFeaturesOverlayProps) => {
  const handlePurchase = async (priceId: string) => {
    try {
      await onPurchase(priceId);
    } catch (e: any) {
      toast.error("Failed to start checkout", { description: e.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center px-4 py-6 font-['Antigone',sans-serif]">
        {/* Close */}
        <button onClick={onClose} className="self-start mb-4">
          <X className="w-8 h-8 text-red-500" />
        </button>

        <h1 className="text-white text-2xl font-black tracking-wide mb-1">VIP FEATURES</h1>
        <p className="text-neutral-400 text-sm font-bold mb-6">INCLUDED</p>

        {/* Tier Buttons */}
        <div className="flex gap-3 mb-8">
          <button
            onClick={() => handlePurchase(VIP_TIERS.basic.price_id)}
            className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border ${
              currentTier === "basic"
                ? "bg-green-600 border-green-400 text-white"
                : "bg-gradient-to-b from-green-600 to-green-800 border-green-500/30 text-white hover:opacity-90"
            }`}
          >
            <div className="text-lg">{VIP_TIERS.basic.price}</div>
            <div className="text-[10px] opacity-80">A WEEK BASIC PLAN</div>
            {currentTier === "basic" && <div className="text-[10px] mt-1">✓ YOUR PLAN</div>}
          </button>

          <button
            onClick={() => handlePurchase(VIP_TIERS.premium.price_id)}
            className={`px-5 py-3 rounded-2xl font-black text-sm transition-all border ${
              currentTier === "premium"
                ? "bg-yellow-600 border-yellow-400 text-white"
                : "bg-gradient-to-b from-yellow-600 to-orange-700 border-yellow-500/30 text-white hover:opacity-90"
            }`}
          >
            <div className="text-lg">{VIP_TIERS.premium.price}</div>
            <div className="text-[10px] opacity-80">A MONTH PREMIUM PLAN</div>
            {currentTier === "premium" && <div className="text-[10px] mt-1">✓ YOUR PLAN</div>}
          </button>
        </div>

        {/* Basic Features */}
        <div className="w-full max-w-sm mb-6">
          <h2 className="text-green-400 font-black text-sm tracking-wider mb-3 text-center">BASIC VIP</h2>
          <div className="grid grid-cols-2 gap-3">
            {VIP_TIERS.basic.features.map((f, i) => (
              <div key={i} className="bg-neutral-900 rounded-xl p-3 text-center border border-neutral-800">
                <p className="text-white text-xs font-bold leading-tight">{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Premium Features */}
        <div className="w-full max-w-sm mb-8">
          <h2 className="text-yellow-400 font-black text-sm tracking-wider mb-3 text-center">PREMIUM VIP</h2>
          <div className="grid grid-cols-2 gap-3">
            {VIP_TIERS.premium.features.map((f, i) => (
              <div key={i} className="bg-neutral-900 rounded-xl p-3 text-center border border-neutral-800">
                <p className="text-white text-xs font-bold leading-tight">{f}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Purchase / Manage */}
        {currentTier ? (
          <button
            onClick={() => onManage?.()}
            className="w-64 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-6"
          >
            MANAGE SUBSCRIPTION
          </button>
        ) : (
          <button
            onClick={() => handlePurchase(VIP_TIERS.basic.price_id)}
            className="w-64 bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-lg py-3 rounded-full hover:opacity-90 transition-opacity shadow-lg tracking-wide mb-6 animate-pulse"
          >
            🔥 PURCHASE VIP
          </button>
        )}
      </div>
    </div>
  );
};

export default VipFeaturesOverlay;
