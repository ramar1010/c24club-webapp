import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user?.id) throw new Error("User not found or not authenticated");

    const body = await req.json();
    const { action, purchaseToken } = body;

    if (action === "verify-iap") {
      // Mark the user as unbanned in the user_bans table
      const { data, error: updateError } = await supabaseAdmin
        .from("user_bans")
        .update({
          is_active: false,
          unbanned_at: new Date().toISOString(),
          unban_payment_session: purchaseToken || "IAP_VERIFIED",
        })
        .eq("user_id", user.id)
        .eq("is_active", true)
        .select();

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ 
        success: true, 
        unbanned: true,
        updatedRows: data?.length ?? 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action provided");
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});    });
  }
});
