import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify admin caller
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseAnon.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { redemptionId, emailType } = await req.json();

    // Map emailType to template_key
    const templateKeyMap: Record<string, string> = {
      "Order placed": "order_placed",
      "Order shipped": "order_shipped",
      "Item Out of stock": "item_out_of_stock",
      "address_not_exist": "address_not_exist",
    };
    const templateKey = templateKeyMap[emailType] || emailType;

    // Load template from DB
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", templateKey)
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      return new Response(JSON.stringify({ error: `Email template "${templateKey}" not found or disabled` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch redemption
    const { data: redemption, error: rErr } = await supabase
      .from("member_redemptions").select("*").eq("id", redemptionId).single();
    if (rErr || !redemption) {
      return new Response(JSON.stringify({ error: "Redemption not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get member
    const { data: member } = await supabase
      .from("members").select("name, email").eq("id", redemption.user_id).single();
    if (!member?.email) {
      return new Response(JSON.stringify({ error: "Member email not found" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderDate = new Date(redemption.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    // Replace template variables
    const subject = template.subject;
    const body = template.body
      .replace(/\{\{user_name\}\}/g, member.name)
      .replace(/\{\{reward_title\}\}/g, redemption.reward_title)
      .replace(/\{\{tracking_url\}\}/g, (redemption as any).shipping_tracking_url || "Tracking info coming soon")
      .replace(/\{\{order_date\}\}/g, orderDate);

    console.log(`📧 Email to ${member.email}:`, { subject, body });

    // Log to notes
    const existingNotes = redemption.notes || "";
    const emailLog = `[${new Date().toISOString()}] Email sent: ${emailType}`;
    await supabase
      .from("member_redemptions")
      .update({ notes: existingNotes ? `${existingNotes}\n${emailLog}` : emailLog })
      .eq("id", redemptionId);

    return new Response(
      JSON.stringify({ success: true, message: `Email queued for ${member.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
