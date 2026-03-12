import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PRIZE_TYPES = [
  { value: "product_points", label: "Product Points" },
  { value: "ad_points", label: "Ad Points" },
  { value: "bonus_minutes", label: "Bonus Minutes" },
  { value: "unfreeze", label: "Unfreeze (days)" },
  { value: "vip_week", label: "VIP Week" },
  { value: "gift_card", label: "Gift Card ($)" },
  { value: "chance_enhancer", label: "Chance Enhancer (%)" },
];

const AdminSpinPrizesPage = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Record<string, any>>({});

  const { data: prizes = [], isLoading } = useQuery({
    queryKey: ["admin-spin-prizes"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spin_prizes")
        .select("*")
        .order("sort_order");
      return data || [];
    },
  });

  const handleUpdate = async (id: string, updates: Record<string, any>) => {
    const { error } = await supabase
      .from("spin_prizes")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update", { description: error.message });
    } else {
      toast.success("Prize updated!");
      queryClient.invalidateQueries({ queryKey: ["admin-spin-prizes"] });
      setEditing({});
    }
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    await handleUpdate(id, { is_active: !currentActive });
  };

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Manage Spin to Win Prizes</h1>
      <p className="text-muted-foreground text-sm">
        Configure prizes, amounts, and chance percentages for the spin wheel.
      </p>

      <div className="grid gap-4">
        {prizes.map((prize: any) => {
          const isEditing = editing[prize.id];
          return (
            <Card key={prize.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{prize.label}</CardTitle>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {prize.is_active ? "Active" : "Inactive"}
                    </span>
                    <Switch
                      checked={prize.is_active}
                      onCheckedChange={() => handleToggle(prize.id, prize.is_active)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">Type</label>
                    <p className="text-sm font-medium capitalize">
                      {PRIZE_TYPES.find((t) => t.value === prize.prize_type)?.label || prize.prize_type}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Amount</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        defaultValue={prize.amount}
                        className="h-8 text-sm"
                        onBlur={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [prize.id]: { ...prev[prize.id], amount: Number(e.target.value) },
                          }))
                        }
                      />
                    ) : (
                      <p className="text-sm font-medium">{prize.amount}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Chance %</label>
                    {isEditing ? (
                      <Input
                        type="number"
                        defaultValue={prize.chance_percent}
                        className="h-8 text-sm"
                        onBlur={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [prize.id]: { ...prev[prize.id], chance_percent: Number(e.target.value) },
                          }))
                        }
                      />
                    ) : (
                      <p className="text-sm font-medium">{prize.chance_percent}%</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(prize.id, editing[prize.id] || {})}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditing((prev) => {
                          const next = { ...prev };
                          delete next[prize.id];
                          return next;
                        })}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing((prev) => ({ ...prev, [prize.id]: {} }))}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AdminSpinPrizesPage;
