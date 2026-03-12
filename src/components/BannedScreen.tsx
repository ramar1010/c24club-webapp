import { useState } from "react";
import { ShieldX, AlertTriangle, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BannedScreenProps {
  reason: string;
  banType: string;
  createdAt: string;
}

const BannedScreen = ({ reason, banType, createdAt }: BannedScreenProps) => {
  const [loading, setLoading] = useState(false);
  const { signOut } = useAuth();
  const canAppeal = banType !== "underage";

  const handlePayToUnban = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("unban-payment", {
        body: { action: "create-checkout" },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err: any) {
      console.error("Unban payment error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
          <ShieldX className="w-10 h-10 text-red-500" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-3xl font-black text-white mb-2">Account Banned</h1>
          <p className="text-neutral-400 text-sm">
            Banned on {new Date(createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>

        {/* Reason */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2 justify-center">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-bold text-sm uppercase tracking-wide">Reason</span>
          </div>
          <p className="text-white font-medium text-lg">{reason}</p>
        </div>

        {/* Appeal section */}
        {canAppeal ? (
          <div className="space-y-3">
            <p className="text-neutral-400 text-sm">
              You can appeal this ban by paying a one-time fee of <span className="text-green-400 font-bold">$10.00</span>
            </p>
            <button
              onClick={handlePayToUnban}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-neutral-700 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Pay $10 to Appeal Ban
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5">
            <p className="text-red-400 font-bold text-sm">
              This ban is permanent and cannot be appealed.
            </p>
          </div>
        )}

        {/* Sign out */}
        <button
          onClick={signOut}
          className="text-neutral-500 hover:text-neutral-300 text-sm font-bold transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
};

export default BannedScreen;
