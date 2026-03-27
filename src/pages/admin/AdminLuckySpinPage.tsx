import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const AdminLuckySpinPage = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-lucky-spin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lucky_spin_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Record<string, unknown>) => {
      const { error } = await supabase
        .from("lucky_spin_settings")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", settings!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lucky-spin-settings"] });
      toast.success("Settings updated");
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Lucky Spin Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Lucky Spin — Waiting Room</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Enable Lucky Spin</Label>
                  <p className="text-sm text-muted-foreground">
                    Auto-spinning slot machine while users wait for a match. Winners earn gifted minutes (cashable).
                  </p>
                </div>
                <Switch
                  checked={settings?.is_enabled ?? false}
                  onCheckedChange={(v) => updateMutation.mutate({ is_enabled: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Hide Waiting Carousel</Label>
                  <p className="text-sm text-muted-foreground">
                    Hide the Discover & Reward teaser carousel on the waiting screen.
                  </p>
                </div>
                <Switch
                  checked={settings?.hide_carousel ?? false}
                  onCheckedChange={(v) => updateMutation.mutate({ hide_carousel: v })}
                />
              </div>
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p><strong>Spin interval:</strong> Every {(settings?.spin_interval_ms ?? 5000) / 1000}s</p>
                <p><strong>Daily cap:</strong> ${((settings?.daily_cap_cents ?? 500) / 100).toFixed(2)} per user</p>
                <p><strong>Prizes:</strong> $0.10 (8%), $0.35 (3%), $0.50 (1%), $5.00 (0.1%)</p>
                <p><strong>Wait boost:</strong> Odds double after 3 min waiting</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLuckySpinPage;
