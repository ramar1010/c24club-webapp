import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dices, Save, AlertTriangle } from "lucide-react";

const AdminWagerSettingsPage = () => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    min_wager_minutes: 5,
    max_wager_minutes: 50,
    max_daily_wagers: 3,
    max_weekly_wagers: 10,
    jackpot_amount: 200,
    jackpot_chance_percent: 0.5,
    double_chance_percent: 20,
    cash_win_chance_percent: 15,
    lose_chance_percent: 64.5,
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ["wager-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wager_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setForm({
        min_wager_minutes: settings.min_wager_minutes,
        max_wager_minutes: settings.max_wager_minutes,
        max_daily_wagers: settings.max_daily_wagers,
        max_weekly_wagers: settings.max_weekly_wagers,
        jackpot_amount: Number(settings.jackpot_amount),
        jackpot_chance_percent: Number(settings.jackpot_chance_percent),
        double_chance_percent: Number(settings.double_chance_percent),
        cash_win_chance_percent: Number(settings.cash_win_chance_percent),
        lose_chance_percent: Number(settings.lose_chance_percent),
      });
    }
  }, [settings]);

  const totalChance =
    Number(form.jackpot_chance_percent) +
    Number(form.double_chance_percent) +
    Number(form.cash_win_chance_percent) +
    Number(form.lose_chance_percent);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: Number(value) }));
  };

  const autoCalcLose = () => {
    const lose =
      100 -
      Number(form.jackpot_chance_percent) -
      Number(form.double_chance_percent) -
      Number(form.cash_win_chance_percent);
    setForm((prev) => ({ ...prev, lose_chance_percent: Math.max(0, parseFloat(lose.toFixed(2))) }));
  };

  const handleSave = async () => {
    if (Math.abs(totalChance - 100) > 0.01) {
      toast.error("Chances must add up to 100%");
      return;
    }
    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from("wager_settings")
          .update({
            ...form,
            updated_at: new Date().toISOString(),
          })
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wager_settings")
          .insert(form as any);
        if (error) throw error;
      }
      toast.success("Wager settings saved");
      queryClient.invalidateQueries({ queryKey: ["wager-settings"] });
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  if (isLoading) {
    return <p className="text-white/50 text-center py-12">Loading...</p>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Dices className="w-6 h-6 text-yellow-400" /> Wager Settings
        </h1>
        <p className="text-sm text-white/60 mt-1">
          Configure the minute gambling / jackpot system
        </p>
      </div>

      {/* Wager Limits */}
      <Card className="bg-[#232323] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Wager Limits</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-white/70 text-xs">Min Wager (minutes)</Label>
            <Input
              type="number"
              value={form.min_wager_minutes}
              onChange={(e) => handleChange("min_wager_minutes", e.target.value)}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/70 text-xs">Max Wager (minutes)</Label>
            <Input
              type="number"
              value={form.max_wager_minutes}
              onChange={(e) => handleChange("max_wager_minutes", e.target.value)}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/70 text-xs">Max Daily Wagers</Label>
            <Input
              type="number"
              value={form.max_daily_wagers}
              onChange={(e) => handleChange("max_daily_wagers", e.target.value)}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
          <div>
            <Label className="text-white/70 text-xs">Max Weekly Wagers</Label>
            <Input
              type="number"
              value={form.max_weekly_wagers}
              onChange={(e) => handleChange("max_weekly_wagers", e.target.value)}
              className="bg-[#1a1a1a] border-white/10 text-white mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Jackpot */}
      <Card className="bg-[#232323] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Jackpot Prize</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-white/70 text-xs">Jackpot Amount ($)</Label>
          <Input
            type="number"
            value={form.jackpot_amount}
            onChange={(e) => handleChange("jackpot_amount", e.target.value)}
            className="bg-[#1a1a1a] border-white/10 text-white mt-1 max-w-xs"
          />
          <p className="text-xs text-white/40 mt-1">
            Cash value awarded on jackpot win, converted to cashable minutes at the DB rate
          </p>
        </CardContent>
      </Card>

      {/* Win Chances */}
      <Card className="bg-[#232323] border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center justify-between">
            Win Chances
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-white/20 text-white/70 hover:text-white"
              onClick={autoCalcLose}
            >
              Auto-calc Lose %
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-white/70 text-xs">Jackpot Chance (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.jackpot_chance_percent}
                onChange={(e) => handleChange("jackpot_chance_percent", e.target.value)}
                className="bg-[#1a1a1a] border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Double Chance (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.double_chance_percent}
                onChange={(e) => handleChange("double_chance_percent", e.target.value)}
                className="bg-[#1a1a1a] border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Cash Win Chance (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.cash_win_chance_percent}
                onChange={(e) => handleChange("cash_win_chance_percent", e.target.value)}
                className="bg-[#1a1a1a] border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/70 text-xs">Lose Chance (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.lose_chance_percent}
                onChange={(e) => handleChange("lose_chance_percent", e.target.value)}
                className="bg-[#1a1a1a] border-white/10 text-white mt-1"
              />
            </div>
          </div>

          {/* Total indicator */}
          <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${Math.abs(totalChance - 100) > 0.01 ? "bg-red-500/20 text-red-400" : "bg-green-500/20 text-green-400"}`}>
            {Math.abs(totalChance - 100) > 0.01 && <AlertTriangle className="w-4 h-4" />}
            Total: {totalChance.toFixed(2)}% {Math.abs(totalChance - 100) > 0.01 ? "(must equal 100%)" : "✓"}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving || Math.abs(totalChance - 100) > 0.01}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        <Save className="w-4 h-4 mr-2" /> {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
};

export default AdminWagerSettingsPage;
