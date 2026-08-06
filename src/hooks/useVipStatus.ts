import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VipTier } from "@/config/vip-tiers";
import { broadcastRechargeUpdate } from "@/hooks/useRechargeMinutes";

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

  const checkSubscription = useCallback(async (force = false) => {
    if (!userId) {
      setStatus({ subscribed: false, vipTier: null, subscriptionEnd: null, loading: false });
      return;
    }

    // Check session-init cache first (set by useAuth on page load)
    if (force) {
      sessionStorage.removeItem("vip_status_session_init");
      sessionStorage.removeItem(`vip_status_${userId}`);
    }
    const sessionInitCache = force ? null : sessionStorage.getItem("vip_status_session_init");
    const userCache = force ? null : sessionStorage.getItem(`vip_status_${userId}`);
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

      sessionStorage.setItem(`vip_status_${userId}`, JSON.stringify({ data, ts: Date.now() }));

      // VIP purchases/renewals credit 5 free call minutes server-side — refresh balances.
      if (data?.subscribed) broadcastRechargeUpdate();

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
    // Coming back from Stripe checkout — bypass the 5-minute cache.
    const pending = userId ? sessionStorage.getItem(`vip_pending_${userId}`) : null;
    checkSubscription(!!pending);
  }, [checkSubscription, userId]);

  // If a checkout was started, keep re-checking until VIP shows up (or 3 min).
  useEffect(() => {
    if (!userId) return;
    if (!sessionStorage.getItem(`vip_pending_${userId}`)) return;

    if (status.subscribed) {
      sessionStorage.removeItem(`vip_pending_${userId}`);
      return;
    }

    const startedAt = Number(sessionStorage.getItem(`vip_pending_${userId}`)) || Date.now();
    if (Date.now() - startedAt > 3 * 60_000) {
      sessionStorage.removeItem(`vip_pending_${userId}`);
      return;
    }

    const poll = setInterval(() => checkSubscription(true), 5000);
    const onFocus = () => checkSubscription(true);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [userId, status.subscribed, checkSubscription]);

  // Auto-refresh every 5 minutes (matches cache TTL)
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(checkSubscription, 5 * 60_000);
    return () => clearInterval(interval);
  }, [userId, checkSubscription]);

  const startCheckout = useCallback(async (priceId: string, source: string = "unknown") => {
    const tier =
      priceId === "price_1T9ygOA5n8uAZoY1tzoTfeMH"
        ? "basic"
        : "premium";
    if (userId) {
      sessionStorage.setItem(`vip_pending_${userId}`, String(Date.now()));
      sessionStorage.removeItem(`vip_status_${userId}`);
      sessionStorage.removeItem("vip_status_session_init");
    }
    const { data, error } = await supabase.functions.invoke("create-checkout", {
      body: { priceId, source, tier },
    });
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  }, [userId]);

  const openPortal = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("customer-portal");
    if (error) throw error;
    if (data?.url) {
      window.location.href = data.url;
    }
  }, []);

  return { ...status, checkSubscription, startCheckout, openPortal };
}
