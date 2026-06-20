import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface BountyEarningLog {
  id: string;
  amount_minutes: number;
  source: "basic" | "premium" | "renewal" | "streak";
  created_at: string;
  paid_out: boolean;
  partner_name: string | null;
  partner_image_url: string | null;
}

export interface BountyPendingLog {
  id: string;
  partner_name: string | null;
  partner_image_url: string | null;
  last_interaction_at: string;
  expires_at: string;
  interaction_type: "call" | "dm";
}

export interface BountySummary {
  total_minutes_earned: number;
  total_usd_earned: number;
  active_links_count: number;
  recent_logs: BountyEarningLog[];
  pending_logs: BountyPendingLog[];
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
