import { useState, useEffect } from "react";
import { ChevronLeft, Gift, Package, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const RARITY_STYLES: Record<string, { bg: string; border: string }> = {
  common: { bg: "bg-neutral-700", border: "border-neutral-600" },
  rare: { bg: "bg-blue-600", border: "border-blue-500" },
  legendary: { bg: "bg-amber-500", border: "border-amber-400" },
};

interface LinkClicksRewardPickerProps {
  userId: string;
  onBack: () => void;
  onClaimed: () => void;
}

interface RewardItem {
  id: string;
  title: string;
  image_url: string | null;
  rarity: string;
  delivery: string | null;
  shipping_fee: number;
  minutes_cost: number;
  brief: string | null;
}

type PickerView = "browse" | "shipping";

const LinkClicksRewardPicker = ({ userId, onBack, onClaimed }: LinkClicksRewardPickerProps) => {
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReward, setSelectedReward] = useState<RewardItem | null>(null);
  const [view, setView] = useState<PickerView>("browse");
  const [submitting, setSubmitting] = useState(false);
  const [isPremiumVip, setIsPremiumVip] = useState(false);

  // Shipping form state
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    country: "",
    address: "",
    city: "",
    state: "",
    zip: "",
    notes: "",
  });

  const update = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  useEffect(() => {
    const fetchData = async () => {
      // Fetch rewards and VIP status in parallel
      const [{ data: rewardsData }, { data: vipData }] = await Promise.all([
        supabase.from("rewards").select("id, title, image_url, rarity, delivery, shipping_fee, minutes_cost, brief").eq("visible", true).order("minutes_cost"),
        supabase.from("member_minutes").select("is_vip, vip_tier").eq("user_id", userId).maybeSingle(),
      ]);
      setRewards((rewardsData as RewardItem[]) ?? []);
      setIsPremiumVip(vipData?.is_vip === true && vipData?.vip_tier === "premium");
      setLoading(false);
    };
    fetchData();
  }, [userId]);

  const handleSelectReward = (reward: RewardItem) => {
    setSelectedReward(reward);
    // Digital rewards don't need shipping
    if (reward.delivery === "digital") {
      handleConfirmFreeRedemption(reward, null);
    } else {
      setView("shipping");
    }
  };

  const handleConfirmFreeRedemption = async (reward: RewardItem, shipping: typeof form | null) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-reward", {
        body: {
          action: "create-free-redemption",
          rewardId: reward.id,
          shipping,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.requiresPayment && data?.checkoutUrl) {
        toast.success("Redirecting to shipping payment...");
        window.open(data.checkoutUrl, "_blank");
      } else {
        toast.success("🎉 Reward claimed successfully!");
      }
      onClaimed();
    } catch (e: any) {
      toast.error(e.message || "Failed to claim reward");
    }
    setSubmitting(false);
  };

  const shippingFee = selectedReward
    ? isPremiumVip ? 0 : Number(selectedReward.shipping_fee) || 0
    : 0;

  // ─── SHIPPING VIEW ───
  if (view === "shipping" && selectedReward) {
    return (
      <div className="min-h-screen bg-[#f5a623] text-black font-['Antigone',sans-serif] flex flex-col overflow-y-auto">
        <div className="flex items-center gap-3 px-4 py-4">
          <button onClick={() => { setView("browse"); setSelectedReward(null); }} className="flex items-center gap-1 font-black text-sm">
            <ChevronLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="flex-1 text-2xl font-black text-center pr-10">Shipping Details</h1>
        </div>

        {/* Selected reward preview */}
        <div className="flex items-center gap-3 px-4 mb-4">
          <div className="w-14 h-14 rounded-xl overflow-hidden bg-black/10 flex-shrink-0">
            {selectedReward.image_url ? (
              <img src={selectedReward.image_url} alt={selectedReward.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">🎁</div>
            )}
          </div>
          <div>
            <p className="font-black text-sm">{selectedReward.title}</p>
            <p className="text-xs font-bold text-black/60">FREE — Link Clicks Reward</p>
          </div>
        </div>

        <div className="flex-1 px-4 pb-6 space-y-4">
          <input placeholder="First name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />
          <input placeholder="Last name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => update("notes", e.target.value)} rows={2}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none resize-none" />

          <h2 className="font-black text-lg text-center mt-4">Address</h2>
          <input placeholder="Country/Region" value={form.country} onChange={(e) => update("country", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />
          <textarea placeholder="Address" value={form.address} onChange={(e) => update("address", e.target.value)} rows={2}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none resize-none" />
          <input placeholder="City" value={form.city} onChange={(e) => update("city", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />
          <input placeholder="State" value={form.state} onChange={(e) => update("state", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />
          <input placeholder="Zip" value={form.zip} onChange={(e) => update("zip", e.target.value)}
            className="w-full bg-transparent border-2 border-black rounded-xl px-4 py-3 font-bold placeholder:text-black/50 focus:outline-none" />

          <div className="pt-4 flex justify-center">
            <button
              onClick={() => {
                if (!form.firstName || !form.lastName || !form.country || !form.address) {
                  toast.error("Please fill in required fields");
                  return;
                }
                handleConfirmFreeRedemption(selectedReward, form);
              }}
              disabled={submitting}
              className="bg-green-700 text-white font-black text-xl px-10 py-3 rounded-full hover:bg-green-800 transition-colors disabled:opacity-50"
            >
              {submitting ? "Processing..." : shippingFee > 0 ? `Confirm & Pay $${shippingFee.toFixed(2)} Shipping` : "Confirm"}
            </button>
          </div>

          {shippingFee > 0 && (
            <p className="text-center text-sm font-bold text-black/70 mt-4 px-4">
              By clicking confirm you accept responsibility for the shipping fee of approximately ${shippingFee.toFixed(2)}.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── BROWSE VIEW ───
  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] p-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-neutral-400 hover:text-white font-bold text-sm">← Back</button>
          <h2 className="text-2xl font-black tracking-wide">Pick Your Reward</h2>
        </div>
      </div>

      <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 mb-6 text-center">
        <p className="text-green-400 font-black text-lg flex items-center justify-center gap-2">
          <Gift className="w-5 h-5" /> FREE Reward Unlocked!
        </p>
        <p className="text-neutral-400 text-xs mt-1">Choose any reward below — no minutes will be deducted</p>
      </div>

      {loading ? (
        <p className="text-center text-neutral-400 mt-8">Loading rewards...</p>
      ) : rewards.length === 0 ? (
        <p className="text-center text-neutral-500 mt-8">No rewards available right now.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          {rewards.map((reward) => {
            const style = RARITY_STYLES[reward.rarity] || RARITY_STYLES.common;
            return (
              <button
                key={reward.id}
                onClick={() => handleSelectReward(reward)}
                className={`bg-neutral-900 border ${style.border} rounded-2xl p-3 text-left hover:bg-neutral-800 transition-colors group`}
              >
                <div className="aspect-square rounded-xl overflow-hidden bg-neutral-800 mb-2">
                  {reward.image_url ? (
                    <img src={reward.image_url} alt={reward.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">🎁</div>
                  )}
                </div>
                <p className="font-bold text-sm truncate">{reward.title}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`${style.bg} text-white px-2 py-0.5 rounded text-[10px] font-bold`}>
                    {reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1)}
                  </span>
                  {reward.delivery === "digital" ? (
                    <span className="text-[10px] text-neutral-500 font-bold flex items-center gap-1"><Star className="w-3 h-3" />Digital</span>
                  ) : (
                    <span className="text-[10px] text-neutral-500 font-bold flex items-center gap-1"><Package className="w-3 h-3" />Ships</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LinkClicksRewardPicker;
