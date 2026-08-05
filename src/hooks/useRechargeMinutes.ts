import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const RECHARGE_UPDATED_EVENT = "recharge-minutes-updated";

/** Called after a successful checkout (possibly from another tab) to refresh balances everywhere. */
export function broadcastRechargeUpdate() {
  try {
    localStorage.setItem(RECHARGE_UPDATED_EVENT, String(Date.now()));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(RECHARGE_UPDATED_EVENT));
}

export function useRechargeMinutes(userId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["recharge-minutes", userId],
    enabled: !!userId,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("recharge_minutes")
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as any)?.recharge_minutes ?? 0;
    },
  });

  // Live update: same tab event + cross-tab storage event (checkout finishes in a new tab)
  useEffect(() => {
    if (!userId) return;
    const invalidate = () =>
      queryClient.invalidateQueries({ queryKey: ["recharge-minutes", userId] });
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECHARGE_UPDATED_EVENT) invalidate();
    };
    window.addEventListener(RECHARGE_UPDATED_EVENT, invalidate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RECHARGE_UPDATED_EVENT, invalidate);
      window.removeEventListener("storage", onStorage);
    };
  }, [userId, queryClient]);

  return query;
}

export async function startRechargeCheckout(pack: string) {
  const { data, error } = await supabase.functions.invoke("recharge-minutes", {
    body: { action: "create-checkout", pack },
  });
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
  return data?.url as string | undefined;
}
