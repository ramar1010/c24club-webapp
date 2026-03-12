import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ShippingFormProps {
  reward: any;
  onBack: () => void;
  onSuccess: () => void;
}

const ShippingForm = ({ reward, onBack, onSuccess }: ShippingFormProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    notes: "",
    country: "",
    address: "",
    state: "",
    zip: "",
    city: "",
  });

  const update = (key: string, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const shippingFee = Number(reward.shipping_fee) || 0;

  const handleConfirm = async () => {
    if (!form.firstName || !form.lastName || !form.country || !form.address) {
      toast.error("Please fill in required fields");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("redeem-reward", {
        body: {
          action: "create-redemption",
          rewardId: reward.id,
          shipping: form,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data.requiresPayment && data.checkoutUrl) {
        toast.success("Redirecting to payment...");
        window.open(data.checkoutUrl, "_blank");
      } else {
        toast.success("Reward redeemed successfully!");
      }
      onSuccess();
    } catch (e: any) {
      toast.error(e.message || "Failed to redeem");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white font-['Antigone',sans-serif] flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4">
        <button onClick={onBack} className="flex items-center gap-1 font-black text-sm text-white/90 hover:text-white">
          <ChevronLeft className="w-5 h-5" />
          Back
        </button>
        <h1 className="flex-1 text-2xl font-black text-center pr-10">
          Shipping Details
        </h1>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-4">
        {/* Name row */}
        <input
          placeholder="First name"
          value={form.firstName}
          onChange={(e) => update("firstName", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />
        <input
          placeholder="Last name"
          value={form.lastName}
          onChange={(e) => update("lastName", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />

        <input
          placeholder="Mobile"
          value={form.mobile}
          onChange={(e) => update("mobile", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          rows={3}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60 resize-none"
        />

        <h2 className="font-black text-lg text-center mt-4 text-white/90">Address</h2>

        <input
          placeholder="Country/Region"
          value={form.country}
          onChange={(e) => update("country", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />

        <textarea
          placeholder="Address"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
          rows={2}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60 resize-none"
        />

        <input
          placeholder="City"
          value={form.city}
          onChange={(e) => update("city", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />

        <input
          placeholder="State"
          value={form.state}
          onChange={(e) => update("state", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />
        <input
          placeholder="Zip"
          value={form.zip}
          onChange={(e) => update("zip", e.target.value)}
          className="w-full bg-white/10 border-2 border-white/30 rounded-xl px-4 py-3 font-bold text-white placeholder:text-white/50 focus:outline-none focus:border-white/60"
        />

        {/* Confirm button */}
        <div className="pt-4 flex justify-center">
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="bg-primary text-primary-foreground font-black text-xl px-10 py-3 rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading
              ? "Processing..."
              : shippingFee > 0
              ? `Confirm & Pay $${shippingFee.toFixed(2)} Shipping`
              : "Confirm"}
          </button>
        </div>

        {/* Disclaimer */}
        {shippingFee > 0 && (
          <p className="text-center text-sm font-bold text-white/60 mt-4 px-4">
            By clicking confirm you acknowledge and accept the responsibility to
            cover the shipping fees associated with this product, estimated to be
            approximately ${shippingFee.toFixed(2)} depending on your region.
          </p>
        )}
      </div>
    </div>
  );
};

export default ShippingForm;
