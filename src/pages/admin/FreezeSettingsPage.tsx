import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const FreezeSettingsPage = () => {
  const [threshold, setThreshold] = useState(400);
  const [frozenRate, setFrozenRate] = useState(2);
  const [vipUnfreezes, setVipUnfreezes] = useState(3);
  const [unfreezePrice, setUnfreezePrice] = useState(1.99);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("freeze_settings")
      .select("*")
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSettingsId(data.id);
          setThreshold(data.minute_threshold);
          setFrozenRate(data.frozen_earn_rate);
          setVipUnfreezes(data.vip_unfreezes_per_month);
          setUnfreezePrice(Number(data.one_time_unfreeze_price));
        }
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      minute_threshold: threshold,
      frozen_earn_rate: frozenRate,
      vip_unfreezes_per_month: vipUnfreezes,
      one_time_unfreeze_price: unfreezePrice,
      updated_at: new Date().toISOString(),
    };

    if (settingsId) {
      await supabase.from("freeze_settings").update(payload).eq("id", settingsId);
    }

    toast.success("Freeze settings saved!");
    setSaving(false);
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Freeze Settings</h1>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Minute Threshold (triggers freeze)</label>
          <input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            When a user reaches this many total minutes, freeze logic activates.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Frozen Earn Rate (minutes per user)</label>
          <input
            type="number"
            value={frozenRate}
            onChange={(e) => setFrozenRate(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
          />
          <p className="text-xs text-muted-foreground mt-1">
            While frozen, users earn this many minutes per partner instead of 10/30.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">VIP Unfreezes Per Month</label>
          <input
            type="number"
            value={vipUnfreezes}
            onChange={(e) => setVipUnfreezes(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">One-Time Unfreeze Price ($)</label>
          <input
            type="number"
            step="0.01"
            value={unfreezePrice}
            onChange={(e) => setUnfreezePrice(Number(e.target.value))}
            className="w-full border rounded-lg px-3 py-2 bg-background text-foreground"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-primary-foreground font-bold px-6 py-2 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
};

export default FreezeSettingsPage;
