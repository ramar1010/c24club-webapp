import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRechargeMinutes(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["recharge-minutes", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_minutes")
        .select("recharge_minutes")
        .eq("user_id", userId!)
        .maybeSingle();
      return (data as any)?.recharge_minutes ?? 0;
    },
  });
}

export async function startRechargeCheckout(pack: string) {
  const { data, error } = await supabase.functions.invoke("recharge-minutes", {
    body: { action: "create-checkout", pack },
  });
  if (error) throw error;
  if (data?.url) window.open(data.url, "_blank");
  return data?.url as string | undefined;
}
