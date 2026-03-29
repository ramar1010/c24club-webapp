import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Clock, DollarSign, Settings } from "lucide-react";

const AdminReferralsPage = () => {
  const queryClient = useQueryClient();
  const [editingSettings, setEditingSettings] = useState(false);
  const [rewardAmount, setRewardAmount] = useState("");
  const [threshold, setThreshold] = useState("");

  const { data } = useQuery({
    queryKey: ["admin_referrals"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("referral", {
        body: { action: "admin_get_all" },
      });
      if (error) throw error;
      return data;
    },
  });

  const tracking = data?.tracking || [];
  const settings = data?.settings;

  const payReferral = async (trackingId: string) => {
    const { error } = await supabase.functions.invoke("referral", {
      body: { action: "admin_pay_referral", tracking_id: trackingId },
    });
    if (error) toast.error("Failed");
    else {
      toast.success("Marked as paid");
      queryClient.invalidateQueries({ queryKey: ["admin_referrals"] });
    }
  };

  const saveSettings = async () => {
    const { error } = await supabase.functions.invoke("referral", {
      body: {
        action: "admin_update_settings",
        reward_per_referral: parseFloat(rewardAmount),
        engagement_threshold_minutes: parseInt(threshold),
      },
    });
    if (error) toast.error("Failed");
    else {
      toast.success("Settings updated");
      setEditingSettings(false);
      queryClient.invalidateQueries({ queryKey: ["admin_referrals"] });
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Referral Management</h1>

      {/* Settings */}
      <div className="bg-card border rounded-lg p-4 mb-6 max-w-lg">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold flex items-center gap-2">
            <Settings className="w-4 h-4" /> Referral Settings
          </h2>
          {!editingSettings && (
            <button
              onClick={() => {
                setRewardAmount(String(settings?.reward_per_referral ?? 5));
                setThreshold(String(settings?.engagement_threshold_minutes ?? 10));
                setEditingSettings(true);
              }}
              className="text-xs font-bold px-3 py-1 rounded-lg border hover:bg-accent"
            >
              Edit
            </button>
          )}
        </div>

        {editingSettings ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground">Cash Reward per Referral ($)</label>
              <input
                type="number"
                step="0.5"
                value={rewardAmount}
                onChange={(e) => setRewardAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground">Engagement Threshold (minutes)</label>
              <input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={saveSettings} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-lg">
                Save
              </button>
              <button onClick={() => setEditingSettings(false)} className="border font-bold px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="text-sm space-y-1">
            <p>Reward: <span className="font-bold">${settings?.reward_per_referral ?? 5} per referral</span></p>
            <p>Engagement: <span className="font-bold">{settings?.engagement_threshold_minutes ?? 10} minutes</span></p>
          </div>
        )}
      </div>

      {/* Tracking */}
      <div className="space-y-3 max-w-2xl">
        <h2 className="font-bold mb-2">All Referrals ({tracking.length})</h2>
        {tracking.length === 0 ? (
          <p className="text-muted-foreground text-sm">No referrals yet.</p>
        ) : (
          tracking.map((t: any) => (
            <div key={t.id} className="bg-card border rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                    t.status === "engaged"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}>
                    {t.status === "engaged" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {t.status.toUpperCase()}
                  </span>
                  {t.reward_paid && (
                    <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                      PAID
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Code: {t.referral_codes?.code} | Referrer: {t.referrer_id?.slice(0, 8)}... | Referred: {t.referred_user_id?.slice(0, 8)}...
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString()}
                  {t.engaged_at && ` → Engaged ${new Date(t.engaged_at).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">${Number(t.reward_amount).toFixed(2)}</span>
                {t.status === "engaged" && !t.reward_paid && (
                  <button
                    onClick={() => payReferral(t.id)}
                    className="bg-green-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 hover:opacity-90"
                  >
                    <DollarSign className="w-3 h-3" /> PAY
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminReferralsPage;
