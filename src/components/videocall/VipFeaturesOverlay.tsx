import { X, Settings } from "lucide-react";
import { VIP_TIERS, VipFeature } from "@/config/vip-tiers";
import { toast } from "sonner";
import { useState } from "react";

interface VipFeaturesOverlayProps {
  onClose: () => void;
  currentTier: "basic" | "premium" | null;
  onPurchase: (priceId: string) => Promise<void>;
  onManage?: () => Promise<void>;
}

const FeatureCard = ({ feature }: { feature: VipFeature }) => (
  <div className="bg-neutral-900 rounded-2xl p-3 text-center border border-neutral-700/60 flex flex-col items-center gap-1.5 relative">
    {feature.icon && (
      <img src={feature.icon} alt="" className="w-14 h-14 object-contain" />
    )}
    <p className="text-white text-[11px] font-black leading-tight tracking-wide uppercase">{feature.label}</p>
  </div>
);

const VipFeaturesOverlay = ({ onClose, currentTier, onPurchase, onManage }: VipFeaturesOverlayProps) => {
  const [viewingTier, setViewingTier] = useState<"basic" | "premium">(currentTier || "basic");

  const handlePurchase = async (priceId: string) => {
    try {
      await onPurchase(priceId);
    } catch (e: any) {
      toast.error("Failed to start checkout", { description: e.message });
    }
  };

  const displayedFeatures = viewingTier === "premium"
    ? VIP_TIERS.premium.features
    : VIP_TIERS.basic.features;

  return (
    <div className="fixed inset-0 z-50 bg-black overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center px-4 py-5 font-['Antigone',sans-serif]">
        {/* Close */}
        <button onClick={onClose} className="self-start mb-3">
          <X className="w-8 h-8 text-red-500" />
        </button>

        {/* Header */}
        <h1 className="text-white text-3xl font-black tracking-wider mb-0" style={{ fontFamily: "'Antigone Compact Pro', sans-serif" }}>
          VIP FEATURES
        </h1>
        <p className="text-white text-sm font-black tracking-wider mb-4">INCLUDED</p>

        {/* VIP Settings Link */}
        {currentTier && onManage && (
          <button
            onClick={() => onManage()}
            className="flex items-center gap-2 text-neutral-400 text-sm font-black tracking-wide mb-5 hover:text-white transition-colors"
          >
            <Settings className="w-5 h-5" />
            OPEN VIP SETTINGS
          </button>
        )}

        {/* Tier Toggle Buttons */}
        <div className="flex gap-3 mb-6 w-full max-w-sm">
          {/* Basic Button */}
          <button
            onClick={() => setViewingTier("basic")}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all border-2 ${
              viewingTier === "basic"
                ? "bg-green-600 border-green-400 text-white"
                : "bg-neutral-800 border-neutral-600 text-neutral-400"
            }`}
          >
            <div className="flex items-baseline gap-1 justify-center">
              <span className="text-xl">{VIP_TIERS.basic.price}</span>
              {!currentTier && <span className="text-[8px] opacity-70">TAP TO BUY</span>}
            </div>
            <div className="text-[9px] opacity-70 tracking-wider">A WEEK BASIC PLAN</div>
            {currentTier === "basic" && <div className="text-[9px] mt-0.5 text-green-200">✓ YOUR PLAN</div>}
          </button>

          {/* Premium Button */}
          <button
            onClick={() => {
              setViewingTier("premium");
              if (!currentTier) handlePurchase(VIP_TIERS.premium.price_id);
            }}
            className={`flex-1 py-3 px-4 rounded-xl font-black text-sm transition-all border-2 ${
              viewingTier === "premium"
                ? "bg-gradient-to-b from-yellow-500 to-orange-700 border-yellow-400 text-white"
                : "bg-neutral-800 border-neutral-600 text-neutral-400"
            }`}
          >
            <div className="flex items-baseline gap-1 justify-center">
              <span className="text-xl">{VIP_TIERS.premium.price}</span>
              {!currentTier && <span className="text-[8px] opacity-70">TAP TO BUY</span>}
            </div>
            <div className="text-[9px] opacity-70 tracking-wider">A MONTH PREMIUM PLAN</div>
            {currentTier === "premium" && <div className="text-[9px] mt-0.5 text-yellow-200">✓ YOUR PLAN</div>}
          </button>
        </div>

        {/* Features Grid - switches based on selected tier */}
        <div className="w-full max-w-sm mb-8">
          <div className="grid grid-cols-2 gap-3">
            {displayedFeatures.map((f, i) => (
              <FeatureCard key={`${viewingTier}-${i}`} feature={f} />
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        {currentTier ? (
          <button
            onClick={() => onManage?.()}
            className="w-full max-w-sm bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-xl py-4 rounded-full hover:opacity-90 transition-opacity shadow-xl tracking-wider mb-8"
          >
            MANAGE SUBSCRIPTION
          </button>
        ) : (
          <button
            onClick={() => handlePurchase(
              viewingTier === "premium" ? VIP_TIERS.premium.price_id : VIP_TIERS.basic.price_id
            )}
            className="w-full max-w-sm bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-xl py-4 rounded-2xl hover:opacity-90 transition-opacity shadow-xl tracking-wider mb-8"
          >
            <div className="text-[10px] opacity-80">
              {viewingTier === "premium" ? "9.99 A Month" : "2.49 A Week"}
            </div>
            <div>PURCHASE</div>
          </button>
        )}
      </div>
    </div>
  );
};

export default VipFeaturesOverlay;
