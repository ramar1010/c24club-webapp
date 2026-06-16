import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BountyConvert {
  amount_minutes: number;
  source: "basic" | "premium" | "renewal" | "streak";
  created_at: string;
  male_name: string | null;
  male_avatar: string | null;
}

export interface BountySummary {
  lifetime_minutes: number;
  streak_count: number;
  streak_needed: number;
  recent_converts: BountyConvert[];
}

export function useBounty(userId: string | null) {
  const [summary, setSummary] = useState<BountySummary | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase.rpc("get_bounty_summary");
    setSummary((data as unknown as BountySummary) ?? null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordInteraction = useCallback(
    async (maleId: string, type: "call" | "dm") => {
      const { data } = await supabase.rpc("record_bounty_interaction", {
        p_male_id: maleId,
        p_interaction_type: type,
      });
      return data;
    },
    []
  );

  return { summary, loading, refresh, recordInteraction };
}
