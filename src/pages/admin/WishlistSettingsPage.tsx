import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const WishlistSettingsPage = () => {
  const [minMinutes, setMinMinutes] = useState(200);
  const [maxMinutes, setMaxMinutes] = useState(400);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("wishlist_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) {
        setMinMinutes((data as any).min_minutes);
        setMaxMinutes((data as any).max_minutes);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const handleSave = async () => {
    if (minMinutes < 1 || maxMinutes < minMinutes) {
      toast.error("Max must be ≥ Min, and Min must be ≥ 1");
      return;
    }
    setSaving(true);
    const { data: existing } = await supabase
      .from("wishlist_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("wishlist_settings")
        .update({ min_minutes: minMinutes, max_minutes: maxMinutes } as any)
        .eq("id", (existing as any).id);
    }
    toast.success("Wishlist minutes settings saved!");
    setSaving(false);
  };

  return (
    <AdminLayout title="Wishlist Minutes Settings">
      {loading ? (
        <p className="text-neutral-400">Loading...</p>
      ) : (
        <div className="max-w-md space-y-6">
          <p className="text-sm text-neutral-400">
            Control the random minutes range assigned when a female user picks a
            wishlist item. The actual cost will be a random value between min and
            max.
          </p>
          <div className="space-y-2">
            <Label>Minimum Minutes</Label>
            <Input
              type="number"
              min={1}
              value={minMinutes}
              onChange={(e) => setMinMinutes(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum Minutes</Label>
            <Input
              type="number"
              min={1}
              value={maxMinutes}
              onChange={(e) => setMaxMinutes(Number(e.target.value))}
            />
          </div>
          <p className="text-xs text-neutral-500">
            Current range: {minMinutes}–{maxMinutes} minutes per item
          </p>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </AdminLayout>
  );
};

export default WishlistSettingsPage;
