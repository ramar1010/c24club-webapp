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

    // Check session-init cache first (set by useAuth on page load)
    const sessionInitCache = sessionStorage.getItem("vip_status_session_init");
    const userCache = sessionStorage.getItem(`vip_status_${userId}`);
    const cached = userCache || sessionInitCache;
    if (cached) {
      try {
        const { data: cachedData, ts } = JSON.parse(cached);
        if (Date.now() - ts < 5 * 60 * 1000) {
          setStatus({
            subscribed: cachedData?.subscribed ?? false,
            vipTier: cachedData?.vip_tier ?? null,
            subscriptionEnd: cachedData?.subscription_end ?? null,
            loading: false,
          });
          return;
        }
      } catch {}
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;

      sessionStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));

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

  // Auto-refresh every 5 minutes (matches cache TTL)
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(checkSubscription, 5 * 60_000);
    return () => clearInterval(interval);
  }, [userId, checkSubscription]);

  const startCheckout = useCallback(async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  }, []);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  }, []);

  return { ...status, checkSubscription, startCheckout, openPortal };
}
