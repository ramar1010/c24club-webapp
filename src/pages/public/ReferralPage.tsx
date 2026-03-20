import { useState } from "react";
import { ChevronLeft, Copy, Check, UserPlus, DollarSign, Clock, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ReferralPage = ({ onClose }: { onClose?: () => void }) => {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["my_referrals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("referral", {
        body: { action: "my_referrals" },
      });
      if (error) throw error;
      return data;
    },
  });

  const generateCode = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("referral", {
        body: { action: "generate_code" },
      });
      if (error) throw error;
      refetch();
      toast.success("Referral code generated!");
    } catch {
      toast.error("Failed to generate code");
    }
    setGenerating(false);
  };

  const referralLink = data?.code
    ? `${window.location.origin}/?ref=${data.code}`
    : null;

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast.success("Link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-black text-white font-['Antigone',sans-serif] flex flex-col items-center px-4 pb-8">
      <div className="w-full flex items-center pt-3 pb-2">
        <button onClick={onClose} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
          <ChevronLeft className="w-7 h-7" />
          <span className="font-black text-sm tracking-wider">BACK</span>
        </button>
      </div>

      <h1 className="text-3xl font-black tracking-wide mt-4 mb-2">💸 REFER & EARN</h1>
      <p className="text-neutral-400 text-sm mb-6 text-center max-w-sm">
        Invite friends and earn cash when they join and start chatting!
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-sm mb-6">
        <div className="bg-neutral-900 rounded-xl p-3 text-center border border-neutral-800">
          <Users className="w-5 h-5 mx-auto mb-1 text-blue-400" />
          <p className="text-xl font-black">{data?.totalReferrals ?? 0}</p>
          <p className="text-[10px] text-neutral-500 font-bold">INVITED</p>
        </div>
        <div className="bg-neutral-900 rounded-xl p-3 text-center border border-neutral-800">
          <Check className="w-5 h-5 mx-auto mb-1 text-green-400" />
          <p className="text-xl font-black">{data?.engagedCount ?? 0}</p>
          <p className="text-[10px] text-neutral-500 font-bold">ENGAGED</p>
        </div>
        <div className="bg-neutral-900 rounded-xl p-3 text-center border border-neutral-800">
          <DollarSign className="w-5 h-5 mx-auto mb-1 text-yellow-400" />
          <p className="text-xl font-black">${(data?.totalEarned ?? 0).toFixed(2)}</p>
          <p className="text-[10px] text-neutral-500 font-bold">EARNED</p>
        </div>
      </div>

      {/* Pending Earnings */}
      {(data?.pendingEarnings ?? 0) > 0 && (
        <div className="w-full max-w-sm bg-yellow-900/30 border border-yellow-600/30 rounded-xl p-3 mb-4 text-center">
          <p className="text-yellow-300 font-bold text-sm">
            💰 ${data.pendingEarnings.toFixed(2)} pending payout
          </p>
        </div>
      )}

      {/* Referral Link */}
      <div className="w-full max-w-sm">
        {referralLink ? (
          <div className="bg-neutral-900 rounded-xl p-4 border border-neutral-800">
            <p className="text-xs text-neutral-400 font-bold mb-2">YOUR REFERRAL LINK</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white truncate"
              />
              <button
                onClick={copyLink}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-sm px-4 py-2 rounded-lg flex items-center gap-1 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "COPIED" : "COPY"}
              </button>
            </div>
            <p className="text-[10px] text-neutral-500 mt-2">
              Share this link — you earn cash when friends sign up and chat for 10+ minutes!
            </p>
          </div>
        ) : (
          <button
            onClick={generateCode}
            disabled={generating}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-black text-lg py-4 rounded-2xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
          >
            <UserPlus className="w-5 h-5" />
            {generating ? "GENERATING..." : "GET MY REFERRAL LINK"}
          </button>
        )}
      </div>

      {/* Recent Referrals */}
      {data?.referrals?.length > 0 && (
        <div className="w-full max-w-sm mt-6">
          <h2 className="font-black text-sm tracking-wider mb-3">RECENT REFERRALS</h2>
          <div className="space-y-2">
            {data.referrals.map((r: any, i: number) => (
              <div key={i} className="bg-neutral-900 rounded-xl p-3 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {r.status === "engaged" ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-400" />
                  )}
                  <div>
                    <p className="text-xs font-bold">
                      {r.status === "engaged" ? "Engaged ✓" : "Signed up — waiting"}
                    </p>
                    <p className="text-[10px] text-neutral-500">
                      {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <p className={`font-black text-sm ${r.status === "engaged" ? "text-green-400" : "text-neutral-500"}`}>
                  {r.status === "engaged" ? `+$${Number(r.reward_amount).toFixed(2)}` : "Pending"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReferralPage;
