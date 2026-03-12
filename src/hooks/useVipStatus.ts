import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VipTier } from "@/config/vip-tiers";

interface VipStatus {
  subscribed: boolean;
  vipTier: VipTier;
  subscriptionEnd: string | null;
  loading: boolean;
}

export function useVipStatus(userId: string | null) {
  const [status, setStatus] = useState<VipStatus>({
    subscribed: false,
    vipTier: null,
    subscriptionEnd: null,
    loading: true,
  });

  const checkSubscription = useCallback(async () => {
    if (!userId) {
      setStatus({ subscribed: false, vipTier: null, subscriptionEnd: null, loading: false });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      setStatus({
        subscribed: data?.subscribed ?? false,
        vipTier: data?.vip_tier ?? null,
        subscriptionEnd: data?.subscription_end ?? null,
        loading: false,
      });
    } catch (e) {
      console.error("Failed to check subscription:", e);
      // Fallback: read from DB
      const { data: mm } = await supabase
        .from("member_minutes")
        .select("is_vip, vip_tier, subscription_end")
        .eq("user_id", userId)
        .maybeSingle();

      setStatus({
        subscribed: mm?.is_vip ?? false,
        vipTier: (mm?.vip_tier as VipTier) ?? null,
        subscriptionEnd: mm?.subscription_end ?? null,
        loading: false,
      });
    }
  }, [userId]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [userId, checkSubscription]);

  const startCheckout = useCallback(async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  }, []);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, "_blank");
    }
  }, []);

  return { ...status, checkSubscription, startCheckout, openPortal };
}
