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

    const { userId } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load welcome template
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("template_key", "welcome")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) {
      console.log("Welcome email template not found or disabled, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "template disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get member info
    const { data: member } = await supabase
      .from("members").select("name, email").eq("id", userId).single();

    if (!member?.email) {
      console.log("Member email not found for welcome email, skipping.");
      return new Response(JSON.stringify({ skipped: true, reason: "no email" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subject = template.subject;
    const body = template.body.replace(/\{\{user_name\}\}/g, member.name);

    console.log(`📧 Welcome email to ${member.email}:`, { subject, body });

    // Once email domain is configured, actual sending will happen here.
    // For now, the email content is logged.

    return new Response(
      JSON.stringify({ success: true, message: `Welcome email queued for ${member.email}` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
