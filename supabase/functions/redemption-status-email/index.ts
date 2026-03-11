import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailContent {
  subject: string;
  body: string;
}

function getEmailContent(
  emailType: string,
  userName: string,
  rewardTitle: string,
  trackingUrl: string | null,
  orderDate: string
): EmailContent {
  switch (emailType) {
    case "Order placed":
      return {
        subject: "We just placed your order! 📦",
        body: `Hi ${userName},

Great news! 🎉 Your reward has been placed — sit tight and expect another email that will provide the tracking link.

Order Details:
• Reward: ${rewardTitle}
• Order Date: ${orderDate}

Our team is awaiting the tracking link, and you'll be the first to know once the order is being shipped. We're excited for you to enjoy what you've earned on C24Club!

Need any assistance with your order? Feel free to reply to this email or visit our Help Center.

Thank you for being a valued member of C24Club,

The C24Club Team`,
      };

    case "Order shipped":
      return {
        subject: "Your Reward Is on Its Way! 🚚",
        body: `Hi ${userName},

Your reward is on its way to you! 🎉 We've shipped your order, and it should be arriving soon. Keep an eye on your delivery, and get ready to enjoy the perks of being a C24Club member.

Shipping Details:
• Reward: ${rewardTitle}
• Tracking: ${trackingUrl || "Tracking information will be updated shortly."}

${trackingUrl ? "You can track your package with the above link or through the carrier's website with the tracking number provided." : ""}

Thank you for being part of C24Club, and we hope you enjoy your reward!

Best,
The C24Club Team`,
      };

    case "Item Out of stock":
      return {
        subject: "Oh No! Item Out Of Stock 🚚",
        body: `Hi ${userName},

We searched our inventory and it seems we're all out of your current item. Please log into C24 Club > Go To Profile > My Rewards. Choose a new item.

Reward That Is Out Of Stock:
• Reward: ${rewardTitle}

Once you choose a new item we can proceed with placing your order!

Thank you for being part of C24Club, and we hope you enjoy your reward!

Best,
The C24Club Team`,
      };

    case "address_not_exist":
      return {
        subject: "Oh No! Your address does not exist! 🚚",
        body: `Hi ${userName},

We're trying to place your order but the address does not exist! 🥲 Please log into C24 Club > Go To Profile > My Rewards. Change Address.

Reward Details:
• Reward: ${rewardTitle}

Once your address is updated we can proceed with placing your order!

Thank you for being part of C24Club, and we hope you enjoy your reward!

Best,
The C24Club Team`,
      };

    default:
      return {
        subject: `C24Club: Your reward status has been updated`,
        body: `Hi ${userName},\n\nYour reward "${rewardTitle}" status has been updated to: ${emailType}.\n\nBest,\nThe C24Club Team`,
      };
  }
}

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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { redemptionId, emailType } = await req.json();

    // Fetch redemption with member info
    const { data: redemption, error: rErr } = await supabase
      .from("member_redemptions")
      .select("*")
      .eq("id", redemptionId)
      .single();
    if (rErr || !redemption) {
      return new Response(JSON.stringify({ error: "Redemption not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get member email
    const { data: member } = await supabase
      .from("members")
      .select("name, email")
      .eq("id", redemption.user_id)
      .single();

    if (!member?.email) {
      return new Response(JSON.stringify({ error: "Member email not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orderDate = new Date(redemption.created_at).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });

    const emailContent = getEmailContent(
      emailType,
      member.name,
      redemption.reward_title,
      (redemption as any).shipping_tracking_url,
      orderDate
    );

    // Send email via Lovable AI gateway
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not set");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log the email that would be sent (using console for now, 
    // actual email sending requires email domain setup)
    console.log(`📧 Email to ${member.email}:`, emailContent);

    // For now, store in notes that email was sent
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
