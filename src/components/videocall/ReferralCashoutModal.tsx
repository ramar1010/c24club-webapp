import { useState } from "react";
import { X, DollarSign, CheckCircle, Clock, XCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface ReferralCashoutModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ReferralCashoutModal = ({ onClose, onSuccess }: ReferralCashoutModalProps) => {
  const { user } = useAuth();
  const [paypalEmail, setPaypalEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["referral_cashout_summary", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("referral", {
        body: { action: "cashout_summary" },
      });
      if (error) throw error;
      return data;
    },
  });

  const totalEarned = Number(data?.totalEarned ?? 0);
  const totalCashedOut = Number(data?.totalCashedOut ?? 0);
  const availableCash = Number(data?.available ?? 0);
  const hasPending = !!data?.hasPending;
  const history = data?.history ?? [];
  const canCashout = !hasPending && availableCash > 0;

  const handleCashout = async () => {
    if (!paypalEmail.includes("@")) {
      toast.error("Enter a valid PayPal email");
      return;
    }
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("referral", {
        body: { action: "request_cashout", paypal_email: paypalEmail },
      });
      if (error) throw error;
      if (res?.error) throw new Error(res.error);
      toast.success(`💰 Cashout request submitted for $${res.cash_amount}!`);
      onSuccess();
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Cashout failed");
    } finally {
      setLoading(false);
    }
  };

  const statusIcon = (status: string) => {
    if (status === "pending") return <Clock className="w-3.5 h-3.5 text-amber-400" />;
    if (status === "approved" || status === "paid") return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
    return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  };

  const statusColor = (status: string) => {
    if (status === "pending") return "text-amber-400";
    if (status === "approved" || status === "paid") return "text-emerald-400";
    return "text-red-400";
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md relative max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white">
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <Users className="w-7 h-7 text-emerald-400" />
          </div>
          <h2 className="text-white font-bold text-xl">Referral Cashout</h2>
          <p className="text-white/50 text-sm mt-1">
            Cash earned from inviting friends who signed up and chatted
          </p>
        </div>

        {/* Summary */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-5 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">🎁 Total Referral Earnings</span>
            <span className="text-emerald-400 font-bold text-base">${totalEarned.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-white/60 text-sm">💸 Already Cashed Out</span>
            <span className="text-white/60 font-bold text-base">${totalCashedOut.toFixed(2)}</span>
          </div>
          <div className="border-t border-white/10 pt-2 flex justify-between items-center">
            <span className="text-white/60 text-sm">💰 Available to Cash Out</span>
            <span className="text-emerald-400 font-bold text-xl">${availableCash.toFixed(2)}</span>
          </div>
        </div>

        {availableCash <= 0 && !hasPending && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-5 text-center">
            <p className="text-white/40 text-base font-bold">No referral cash available yet</p>
            <p className="text-white/25 text-sm mt-1">
              Invite friends — you earn when they sign up and chat for 10+ minutes.
            </p>
          </div>
        )}

        {/* PayPal Email + Cashout */}
        {availableCash > 0 && (
          <>
            <div className="mb-4">
              <label className="text-white/60 text-sm block mb-1.5">PayPal Email</label>
              <input
                type="email"
                placeholder="your@paypal.com"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-base placeholder:text-white/30 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {hasPending && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-4">
                <p className="text-amber-400 text-sm font-bold">⏳ Pending cashout</p>
                <p className="text-white/50 text-sm mt-1">
                  You already have a pending referral cashout. Please wait for it to be processed.
                </p>
              </div>
            )}

            <button
              onClick={handleCashout}
              disabled={loading || !canCashout || !paypalEmail.includes("@")}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold py-3.5 rounded-xl transition-colors disabled:opacity-50 text-base flex items-center justify-center gap-2"
            >
              <DollarSign className="w-5 h-5" />
              {loading ? "Submitting..." : hasPending ? "Pending Request..." : `Cash Out $${availableCash.toFixed(2)}`}
            </button>

            <p className="text-white/30 text-xs text-center mt-2.5">
              Paid via PayPal • Admin approval required
            </p>
          </>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-white/70 text-sm font-bold uppercase tracking-wider mb-3">Cashout History</h3>
            <div className="space-y-2.5 max-h-40 overflow-y-auto">
              {history.map((req: any) => (
                <div key={req.id} className="bg-white/5 rounded-lg px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-white text-sm font-bold">${Number(req.cash_amount).toFixed(2)}</p>
                    <p className="text-white/30 text-xs">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {statusIcon(req.status)}
                    <span className={`text-xs font-bold uppercase ${statusColor(req.status)}`}>
                      {req.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReferralCashoutModal;