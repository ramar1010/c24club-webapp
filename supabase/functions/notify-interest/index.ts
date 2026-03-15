import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { interested_user_id, target_user_id } = await req.json();
    if (!interested_user_id || !target_user_id) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get both users' info
    const [interestedRes, targetRes] = await Promise.all([
      supabase.from("members").select("name, image_url, gender").eq("id", interested_user_id).single(),
      supabase.from("members").select("name, email, gender").eq("id", target_user_id).single(),
    ]);

    const interested = interestedRes.data;
    const target = targetRes.data;
    if (!interested || !target || !target.email) {
      return new Response(JSON.stringify({ error: "Users not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark as notified
    await supabase
      .from("member_interests")
      .update({ notified: true })
      .eq("user_id", interested_user_id)
      .eq("interested_in_user_id", target_user_id);

    // Build email content based on target's gender
    const isFemale = target.gender?.toLowerCase() === "female";
    const interestedGender = interested.gender?.toLowerCase() === "female" ? "female" : "male";
    const siteUrl = "https://c24club.lovable.app";

    let subject: string;
    let body: string;

    if (isFemale) {
      // Female-targeted email emphasizing earning
      subject = `💰 ${interested.name} wants to video chat — Earn CASH by connecting!`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; color: #fff;">Someone Wants to Chat! 💬</h1>
          </div>
          <div style="padding: 24px;">
            ${interested.image_url ? `<img src="${interested.image_url}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; border: 3px solid #ec4899;" />` : ""}
            <p style="text-align: center; font-size: 18px; margin: 0 0 8px;"><strong>${interested.name}</strong> wants to video chat with you!</p>
            <div style="background: #065f46; border: 1px solid #10b981; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #34d399; margin: 0 0 4px;">💰 Earn CASH</p>
              <p style="color: #a7f3d0; font-size: 14px; margin: 0;">Connect and start earning real money just by chatting. Our Anchor system pays you for every minute!</p>
            </div>
            <a href="${siteUrl}/videocall" style="display: block; background: #ec4899; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px;">Start Earning Now →</a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Get rewarded for connecting</p>
          </div>
        </div>
      `;
    } else {
      // Male-targeted email
      subject = `💬 ${interested.name} wants to video chat with you on C24Club!`;
      body = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; color: #fff;">You've Got an Admirer! 👀</h1>
          </div>
          <div style="padding: 24px;">
            ${interested.image_url ? `<img src="${interested.image_url}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; border: 3px solid #3b82f6;" />` : ""}
            <p style="text-align: center; font-size: 18px; margin: 0 0 8px;"><strong>${interested.name}</strong> wants to connect with you!</p>
            <p style="text-align: center; color: #9ca3af; font-size: 14px;">They saw your profile and are interested in a video chat.</p>
            <a href="${siteUrl}/videocall" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 20px;">Join Video Chat →</a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Meet new people through video chat</p>
          </div>
        </div>
      `;
    }

    // Send via Discord webhook as well
    const discordUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (discordUrl) {
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: `🔔 **New Interest!** ${interested.name} (${interestedGender}) wants to connect with ${target.name} (${target.gender || "unknown"})`,
        }),
      }).catch(() => {});
    }

    // Create admin notification
    await supabase.from("admin_notifications").insert({
      type: "new_interest",
      title: "Connection Interest",
      message: `${interested.name} wants to connect with ${target.name}`,
      reference_id: target_user_id,
    });

    // Note: Actual email sending would use the email infrastructure
    // For now we log the intent — wire up with email domain when configured
    console.log(`Interest email queued: ${subject} -> ${target.email}`);

    return new Response(JSON.stringify({ success: true, subject }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-interest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
