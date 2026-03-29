import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, DollarSign, Percent, Save } from "lucide-react";

const CameraUnlockSettingsPage = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin_camera_unlock_settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("camera_unlock_settings" as any)
        .select("*")
        .limit(1)
        .single();
      return data as unknown as { id: string; price_cents: number; recipient_cut_percent: number } | null;
    },
  });

  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [recipientCut, setRecipientCut] = useState<number | null>(null);

  const currentPrice = priceCents ?? settings?.price_cents ?? 299;
  const currentCut = recipientCut ?? settings?.recipient_cut_percent ?? 25;

  const handleSave = async () => {
    if (!settings?.id) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("camera_unlock_settings")
        .update({
          price_cents: currentPrice,
          recipient_cut_percent: currentCut,
          updated_at: new Date().toISOString(),
        })
        .eq("id", settings.id);
      if (error) throw error;
      toast.success("Camera unlock settings saved!");
      queryClient.invalidateQueries({ queryKey: ["admin_camera_unlock_settings"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const recipientEarns = Math.floor(currentPrice * currentCut / 100);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-8 h-8 text-amber-500" />
        <div>
          <h1 className="text-2xl font-bold">Camera Unlock Settings</h1>
          <p className="text-muted-foreground text-sm">
            Configure the price and revenue split for camera unlock requests
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6 bg-card rounded-xl border p-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Unlock Price (cents)
            </Label>
            <Input
              type="number"
              min={50}
              max={9999}
              value={currentPrice}
              onChange={(e) => setPriceCents(Number(e.target.value))}
              placeholder="299"
            />
            <p className="text-xs text-muted-foreground">
              User pays ${(currentPrice / 100).toFixed(2)} to request camera unlock
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Percent className="w-4 h-4" />
              Recipient Cut (%)
            </Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={currentCut}
              onChange={(e) => setRecipientCut(Number(e.target.value))}
              placeholder="25"
            />
            <p className="text-xs text-muted-foreground">
              Recipient earns ${(recipientEarns / 100).toFixed(2)} ({currentCut}% of ${(currentPrice / 100).toFixed(2)}) converted to minutes
            </p>
          </div>

          <div className="bg-muted rounded-lg p-4 text-sm space-y-1">
            <p><strong>Price:</strong> ${(currentPrice / 100).toFixed(2)}</p>
            <p><strong>Recipient earns:</strong> ${(recipientEarns / 100).toFixed(2)} → converted to minutes at cashout rate</p>
            <p><strong>Platform keeps:</strong> ${((currentPrice - recipientEarns) / 100).toFixed(2)}</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      )}
    </div>
  );
};

export default CameraUnlockSettingsPage;
