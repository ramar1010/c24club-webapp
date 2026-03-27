import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
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

  const toggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("lucky_spin_settings")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("id", settings!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-lucky-spin-settings"] });
      toast.success("Lucky Spin settings updated");
    },
  });

  return (
    <AdminLayout title="Lucky Spin Settings">
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
                  onCheckedChange={(v) => toggleMutation.mutate(v)}
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
    </AdminLayout>
  );
};

export default AdminLuckySpinPage;
