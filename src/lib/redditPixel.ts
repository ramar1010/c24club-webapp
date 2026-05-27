// Reddit Pixel helper with advanced matching + dedup support.
// The base pixel is loaded in index.html. This module wraps rdt() calls
// and mirrors events to our server-side CAPI edge function for dedup.

import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    rdt?: (...args: any[]) => void;
  }
}

const PIXEL_ID = "t2_80vn1q03";

type AdvancedMatching = {
  email?: string;
  externalId?: string;
  phoneNumber?: string;
};

let initialized = false;
let lastIdentity: string | null = null;

/** Re-init the pixel with advanced matching once a user is known. */
export function identifyRedditUser(match: AdvancedMatching) {
  if (typeof window === "undefined" || !window.rdt) return;
  const key = JSON.stringify(match);
  if (key === lastIdentity) return;
  lastIdentity = key;
  try {
    window.rdt("init", PIXEL_ID, {
      ...(match.email ? { email: match.email } : {}),
      ...(match.externalId ? { externalId: match.externalId } : {}),
      ...(match.phoneNumber ? { phoneNumber: match.phoneNumber } : {}),
    });
    if (!initialized) {
      window.rdt("track", "PageVisit");
      initialized = true;
    }
  } catch (e) {
    console.warn("Reddit pixel identify failed", e);
  }
}

export type RedditEvent =
  | "SignUp"
  | "Lead"
  | "Purchase"
  | "AddToCart"
  | "ViewContent"
  | "Search"
  | "AddToWishlist"
  | "CompleteRegistration"
  | "Custom";

export type RedditEventPayload = {
  conversionId?: string;
  value?: number;
  currency?: string;
  itemCount?: number;
  customEventName?: string;
  // Advanced matching (mirrored to CAPI)
  email?: string;
  externalId?: string;
};

function genId() {
  return (
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36))
  );
}

/**
 * Track a Reddit conversion event on both the browser pixel and the server CAPI.
 * Uses the same conversionId on both sides so Reddit can deduplicate.
 */
export async function trackRedditEvent(
  event: RedditEvent,
  payload: RedditEventPayload = {}
) {
  const conversionId = payload.conversionId ?? genId();

  // 1) Browser pixel
  if (typeof window !== "undefined" && window.rdt) {
    try {
      const pixelPayload: Record<string, any> = { conversionId };
      if (payload.value != null) pixelPayload.value = payload.value;
      if (payload.currency) pixelPayload.currency = payload.currency;
      if (payload.itemCount != null) pixelPayload.itemCount = payload.itemCount;
      if (event === "Custom" && payload.customEventName) {
        pixelPayload.customEventName = payload.customEventName;
      }
      window.rdt("track", event, pixelPayload);
    } catch (e) {
      console.warn("Reddit pixel track failed", e);
    }
  }

  // 2) Server CAPI (fire-and-forget)
  try {
    // Capture Reddit click ID from URL (?rdt_cid=...) and persist for later events
    let clickId: string | undefined;
    if (typeof window !== "undefined") {
      try {
        const url = new URL(window.location.href);
        const fromUrl = url.searchParams.get("rdt_cid");
        if (fromUrl) {
          localStorage.setItem("rdt_cid", fromUrl);
          clickId = fromUrl;
        } else {
          clickId = localStorage.getItem("rdt_cid") || undefined;
        }
      } catch {}
    }
    const screen =
      typeof window !== "undefined" && window.screen
        ? { width: window.screen.width, height: window.screen.height }
        : undefined;
    await supabase.functions.invoke("reddit-capi", {
      body: {
        event,
        conversionId,
        value: payload.value,
        currency: payload.currency,
        itemCount: payload.itemCount,
        customEventName: payload.customEventName,
        email: payload.email,
        externalId: payload.externalId,
        clickId,
        screen,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        referrer: typeof document !== "undefined" ? document.referrer : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      },
    });
  } catch (e) {
    console.warn("Reddit CAPI mirror failed", e);
  }

  return conversionId;
}