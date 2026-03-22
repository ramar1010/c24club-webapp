import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return new Response("Missing tracking code", { status: 400 });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Look up the send record
  const { data: send, error } = await supabase
    .from("sms_campaign_sends")
    .select("id, campaign_id, clicked_at")
    .eq("tracking_code", code)
    .single();

  if (error || !send) {
    return new Response("Invalid tracking code", { status: 404 });
  }

  // Record the click (only first click)
  if (!send.clicked_at) {
    await supabase
      .from("sms_campaign_sends")
      .update({ clicked_at: new Date().toISOString() })
      .eq("id", send.id);
  }

  // Get the destination URL
  const { data: campaign } = await supabase
    .from("sms_campaigns")
    .select("destination_url")
    .eq("id", send.campaign_id)
    .single();

  const redirectUrl = campaign?.destination_url || "https://c24club.lovable.app";

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
});
