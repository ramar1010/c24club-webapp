import { useState } from "react";
import { useRewards } from "@/hooks/useCrud";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { DollarSign, RotateCcw, Send } from "lucide-react";

const LegendaryCashoutPage = () => {
  const { data: rewards, isLoading } = useRewards();
  const queryClient = useQueryClient();
  const [distributeAmount, setDistributeAmount] = useState("");
  const [distributing, setDistributing] = useState(false);

  const legendaryRewards = (rewards as any[])?.filter((r) => r.rarity === "legendary") ?? [];
  const totalMinutesCost = legendaryRewards.reduce((sum, r) => sum + (r.minutes_cost || 1), 0);
  const totalCashoutPool = legendaryRewards.reduce((sum, r) => sum + Number(r.cashout_value || 0), 0);

  const handleDistribute = async () => {
    const amount = parseFloat(distributeAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid dollar amount");
      return;
    }
    if (legendaryRewards.length === 0) {
      toast.error("No legendary items to distribute to");
      return;
    }

    setDistributing(true);
    try {
      // Weighted distribution by minutes_cost
      for (const reward of legendaryRewards) {
        const weight = (reward.minutes_cost || 1) / totalMinutesCost;
        const share = Math.round(weight * amount * 100) / 100;
        const newValue = Number(reward.cashout_value || 0) + share;

        const { error } = await supabase
          .from("rewards")
          .update({ cashout_value: newValue })
          .eq("id", reward.id);
        if (error) throw error;
      }

      toast.success(`$${amount.toFixed(2)} distributed across ${legendaryRewards.length} legendary items`);
      setDistributeAmount("");
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
    } catch (e: any) {
      toast.error(e.message || "Failed to distribute");
    }
    setDistributing(false);
  };

  const handleReset = async (rewardId: string, title: string) => {
    const { error } = await supabase
      .from("rewards")
      .update({ cashout_value: 0 })
      .eq("id", rewardId);
    if (error) {
      toast.error("Failed to reset");
    } else {
      toast.success(`Cashout value reset for "${title}"`);
      queryClient.invalidateQueries({ queryKey: ["rewards"] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Legendary Items Cashout</h2>
        <p className="text-muted-foreground mt-1">
          Distribute real monetary value across legendary items. Premium VIP users can cash out when they win.
        </p>
      </div>

      {/* Distribute Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-500" />
            Distribute Cash Pool
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">$</span>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="10.00"
                value={distributeAmount}
                onChange={(e) => setDistributeAmount(e.target.value)}
                className="pl-7"
              />
            </div>
            <Button onClick={handleDistribute} disabled={distributing || legendaryRewards.length === 0}>
              <Send className="mr-2 h-4 w-4" />
              {distributing ? "Distributing..." : "Distribute"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Amount will be split across <strong>{legendaryRewards.length}</strong> legendary items, weighted by their minutes cost.
            Current total pool: <strong className="text-green-500">${totalCashoutPool.toFixed(2)}</strong>
          </p>
        </CardContent>
      </Card>

      {/* Legendary Items List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Legendary Items</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : legendaryRewards.length === 0 ? (
            <p className="text-muted-foreground">No legendary rewards found. Create rewards with "legendary" rarity first.</p>
          ) : (
            <div className="space-y-3">
              {legendaryRewards.map((reward: any) => (
                <div key={reward.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-3">
                    {reward.image_url ? (
                      <img src={reward.image_url} alt={reward.title} className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center text-xl">👑</div>
                    )}
                    <div>
                      <p className="font-bold text-sm">{reward.title}</p>
                      <p className="text-xs text-muted-foreground">🪙 {reward.minutes_cost} min</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className="bg-green-500/10 text-green-500 text-sm px-3">
                      ${Number(reward.cashout_value || 0).toFixed(2)}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(reward.id, reward.title)}
                      disabled={Number(reward.cashout_value || 0) === 0}
                    >
                      <RotateCcw className="mr-1 h-3 w-3" />
                      Reset
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LegendaryCashoutPage;
