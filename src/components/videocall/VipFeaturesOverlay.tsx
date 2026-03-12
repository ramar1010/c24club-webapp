import { X } from "lucide-react";
import { VIP_TIERS, VipFeature } from "@/config/vip-tiers";
import { toast } from "sonner";
import vipRocketImg from "@/assets/videocall/vip-rocket.png";

interface VipFeaturesOverlayProps {
  onClose: () => void;
  currentTier: "basic" | "premium" | null;
  onPurchase: (priceId: string) => Promise<void>;
  onManage?: () => Promise<void>;
}

const FeatureCard = ({ feature }: { feature: VipFeature }) => (
  <div className="bg-neutral-900/80 rounded-2xl p-4 text-center border border-neutral-700/50 flex flex-col items-center gap-2 hover:border-yellow-500/30 transition-colors">
    {feature.icon && (
      <img src={feature.icon} alt="" className="w-10 h-10 object-contain" />
    )}
    <p className="text-white text-xs font-black leading-tight tracking-wide">{feature.label}</p>
  </div>
);

const VipFeaturesOverlay = ({ onClose, currentTier, onPurchase, onManage }: VipFeaturesOverlayProps) => {
  const handlePurchase = async (priceId: string) => {
    try {
      await onPurchase(priceId);
    } catch (e: any) {
      toast.error("Failed to start checkout", { description: e.message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-screen flex flex-col items-center px-4 py-6 font-['Antigone',sans-serif]">
        {/* Close */}
        <button onClick={onClose} className="self-start mb-4">
          <X className="w-8 h-8 text-red-500" />
        </button>

        {/* Header */}
        <img src={vipRocketImg} alt="VIP" className="w-16 h-16 mb-2" />
        <h1 className="text-white text-3xl font-black tracking-widest mb-1">VIP FEATURES</h1>
        <p className="text-neutral-500 text-xs font-black tracking-widest mb-8">INCLUDED WITH YOUR PLAN</p>

        {/* Tier Buttons */}
        <div className="flex gap-4 mb-10">
          <button
            onClick={() => handlePurchase(VIP_TIERS.basic.price_id)}
            className={`px-6 py-4 rounded-2xl font-black text-sm transition-all border-2 min-w-[140px] ${
              currentTier === "basic"
                ? "bg-green-600 border-green-400 text-white shadow-lg shadow-green-500/20"
                : "bg-gradient-to-b from-green-600 to-green-800 border-green-500/30 text-white hover:opacity-90 hover:shadow-lg hover:shadow-green-500/10"
            }`}
          >
            <div className="text-2xl">{VIP_TIERS.basic.price}</div>
            <div className="text-[10px] opacity-70 tracking-wider">A WEEK • BASIC</div>
            {currentTier === "basic" && <div className="text-[10px] mt-1 text-green-200">✓ YOUR PLAN</div>}
          </button>

          <button
            onClick={() => handlePurchase(VIP_TIERS.premium.price_id)}
            className={`px-6 py-4 rounded-2xl font-black text-sm transition-all border-2 min-w-[140px] ${
              currentTier === "premium"
                ? "bg-yellow-600 border-yellow-400 text-white shadow-lg shadow-yellow-500/20"
                : "bg-gradient-to-b from-yellow-500 to-orange-700 border-yellow-500/30 text-white hover:opacity-90 hover:shadow-lg hover:shadow-yellow-500/10"
            }`}
          >
            <div className="text-2xl">{VIP_TIERS.premium.price}</div>
            <div className="text-[10px] opacity-70 tracking-wider">A MONTH • PREMIUM</div>
            {currentTier === "premium" && <div className="text-[10px] mt-1 text-yellow-200">✓ YOUR PLAN</div>}
          </button>
        </div>

        {/* Basic Features */}
        <div className="w-full max-w-md mb-8">
          <h2 className="text-green-400 font-black text-sm tracking-[0.2em] mb-4 text-center">— BASIC VIP —</h2>
          <div className="grid grid-cols-2 gap-3">
            {VIP_TIERS.basic.features.map((f, i) => (
              <FeatureCard key={i} feature={f} />
            ))}
          </div>
        </div>

        {/* Premium Features */}
        <div className="w-full max-w-md mb-10">
          <h2 className="text-yellow-400 font-black text-sm tracking-[0.2em] mb-4 text-center">— PREMIUM VIP —</h2>
          <div className="grid grid-cols-2 gap-3">
            {VIP_TIERS.premium.features.map((f, i) => (
              <FeatureCard key={i} feature={f} />
            ))}
          </div>
        </div>

        {/* CTA */}
        {currentTier ? (
          <button
            onClick={() => onManage?.()}
            className="w-72 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black text-lg py-4 rounded-full hover:opacity-90 transition-opacity shadow-xl shadow-yellow-500/20 tracking-widest mb-8"
          >
            MANAGE SUBSCRIPTION
          </button>
        ) : (
          <button
            onClick={() => handlePurchase(VIP_TIERS.basic.price_id)}
            className="w-72 bg-gradient-to-r from-green-500 to-green-600 text-white font-black text-lg py-4 rounded-full hover:opacity-90 transition-opacity shadow-xl shadow-green-500/20 tracking-widest mb-8 animate-pulse"
          >
            🔥 PURCHASE VIP
          </button>
        )}
      </div>
    </div>
  );
};

export default VipFeaturesOverlay;
