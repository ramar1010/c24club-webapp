import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "c24club.com";
const SITE_URL = "https://c24club.com";

function buildInterestEmailHtml(interested: any, target: any): { subject: string; html: string } {
  const isFemale = target.gender?.toLowerCase() === "female";

  if (isFemale) {
    return {
      subject: `💰 ${interested.name} wants to video chat — Earn CASH by connecting!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 24px; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; color: #fff;">Someone Wants to Chat! 💬</h1>
          </div>
          <div style="padding: 24px;">
            ${interested.image_url ? `<img src="${interested.image_url}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; border: 3px solid #ec4899;" />` : ""}
            <p style="text-align: center; font-size: 18px; margin: 0 0 8px;"><strong>${interested.name}</strong> wants to video chat with you!</p>
            ${interested.icebreaker ? `<p style="text-align: center; color: #c084fc; font-size: 14px; font-style: italic; margin: 8px 0;">"${interested.icebreaker}"</p>` : ""}
            <div style="background: #065f46; border: 1px solid #10b981; border-radius: 12px; padding: 16px; margin: 16px 0; text-align: center;">
              <p style="font-size: 20px; font-weight: bold; color: #34d399; margin: 0 0 4px;">💰 Earn CASH</p>
              <p style="color: #a7f3d0; font-size: 14px; margin: 0;">Connect and start earning real money just by chatting!</p>
            </div>
            <a href="${SITE_URL}/discover" style="display: block; background: #ec4899; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px;">View Profile & Connect →</a>
            <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Get rewarded for connecting</p>
          </div>
        </div>`,
    };
  }

  return {
    subject: `💬 ${interested.name} wants to video chat with you on C24Club!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #3b82f6, #6366f1); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 22px; color: #fff;">You've Got an Admirer! 👀</h1>
        </div>
        <div style="padding: 24px;">
          ${interested.image_url ? `<img src="${interested.image_url}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; border: 3px solid #3b82f6;" />` : ""}
          <p style="text-align: center; font-size: 18px; margin: 0 0 8px;"><strong>${interested.name}</strong> wants to connect with you!</p>
          ${interested.icebreaker ? `<p style="text-align: center; color: #93c5fd; font-size: 14px; font-style: italic; margin: 8px 0;">"${interested.icebreaker}"</p>` : ""}
          <p style="text-align: center; color: #9ca3af; font-size: 14px;">They saw your profile and are interested in a video chat.</p>
          <a href="${SITE_URL}/discover" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 20px;">View & Connect →</a>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Meet new people through video chat</p>
        </div>
      </div>`,
  };
}

function buildMutualMatchEmailHtml(matchedUser: any, recipient: any): { subject: string; html: string } {
  return {
    subject: `🎉 It's a Match! ${matchedUser.name} likes you back on C24Club!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #f59e0b, #ef4444); padding: 24px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; color: #fff;">🎉 It's a Match!</h1>
        </div>
        <div style="padding: 24px;">
          ${matchedUser.image_url ? `<img src="${matchedUser.image_url}" style="width: 120px; height: 120px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; border: 4px solid #f59e0b;" />` : ""}
          <p style="text-align: center; font-size: 18px; margin: 0 0 8px;">You and <strong>${matchedUser.name}</strong> both want to connect!</p>
          <p style="text-align: center; color: #fbbf24; font-size: 14px; margin: 8px 0;">Check their profile to see their socials and start chatting 🔥</p>
          <a href="${SITE_URL}/discover" style="display: block; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 20px;">See Your Match →</a>
          <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Real connections through video chat</p>
        </div>
      </div>`,
  };
}

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

    // Get icebreaker message if any
    const { data: interestRow } = await supabase
      .from("member_interests")
      .select("icebreaker_message")
      .eq("user_id", interested_user_id)
      .eq("interested_in_user_id", target_user_id)
      .single();

    interested.icebreaker = interestRow?.icebreaker_message || null;

    // Mark as notified
    await supabase
      .from("member_interests")
      .update({ notified: true })
      .eq("user_id", interested_user_id)
      .eq("interested_in_user_id", target_user_id);

    // Check if suppressed
    const { data: suppressed } = await supabase
      .from("suppressed_emails")
      .select("id")
      .eq("email", target.email)
      .maybeSingle();

    const emailsSent: string[] = [];

    if (!suppressed) {
      // 1. Send interest notification email to target
      const { subject, html } = buildInterestEmailHtml(interested, target);
      const messageId = `interest-${interested_user_id}-${target_user_id}`;

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "discover_interest",
        recipient_email: target.email,
        status: "pending",
      });

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          message_id: messageId,
          to: target.email,
          from: `C24Club <support@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text: html.replace(/<[^>]*>/g, ""),
          purpose: "transactional",
          label: "discover_interest",
          queued_at: new Date().toISOString(),
        },
      });
      emailsSent.push("interest");

      // 2. Check for mutual match — if target also interested in this user
      const { data: reverseInterest } = await supabase
        .from("member_interests")
        .select("id")
        .eq("user_id", target_user_id)
        .eq("interested_in_user_id", interested_user_id)
        .maybeSingle();

      if (reverseInterest) {
        // It's a mutual match! Send match emails to both users
        const interestedEmail = (await supabase.from("members").select("email").eq("id", interested_user_id).single()).data?.email;

        // Email to target about the match
        const matchEmailTarget = buildMutualMatchEmailHtml(interested, target);
        const matchIdTarget = `match-${interested_user_id}-${target_user_id}`;

        await supabase.from("email_send_log").insert({
          message_id: matchIdTarget,
          template_name: "discover_mutual_match",
          recipient_email: target.email,
          status: "pending",
        });

        await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            run_id: crypto.randomUUID(),
            message_id: matchIdTarget,
            to: target.email,
            from: `C24Club <support@${SENDER_DOMAIN}>`,
            sender_domain: SENDER_DOMAIN,
            subject: matchEmailTarget.subject,
            html: matchEmailTarget.html,
            text: matchEmailTarget.html.replace(/<[^>]*>/g, ""),
            purpose: "transactional",
            label: "discover_mutual_match",
            queued_at: new Date().toISOString(),
          },
        });

        // Email to interested user about the match
        if (interestedEmail) {
          const { data: intSuppressed } = await supabase
            .from("suppressed_emails")
            .select("id")
            .eq("email", interestedEmail)
            .maybeSingle();

          if (!intSuppressed) {
            const matchEmailInterested = buildMutualMatchEmailHtml(target, interested);
            const matchIdInterested = `match-${target_user_id}-${interested_user_id}`;

            await supabase.from("email_send_log").insert({
              message_id: matchIdInterested,
              template_name: "discover_mutual_match",
              recipient_email: interestedEmail,
              status: "pending",
            });

            await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                run_id: crypto.randomUUID(),
                message_id: matchIdInterested,
                to: interestedEmail,
                from: `C24Club <support@${SENDER_DOMAIN}>`,
                sender_domain: SENDER_DOMAIN,
                subject: matchEmailInterested.subject,
                html: matchEmailInterested.html,
                text: matchEmailInterested.html.replace(/<[^>]*>/g, ""),
                purpose: "transactional",
                label: "discover_mutual_match",
                queued_at: new Date().toISOString(),
              },
            });
          }
        }
        emailsSent.push("mutual_match");
      }
    }

    // Discord webhook
    const discordUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
    if (discordUrl) {
      const isMutual = emailsSent.includes("mutual_match");
      const siteUrl = "https://c24club.lovable.app/discover";
      await fetch(discordUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: isMutual
            ? `🎉 **Mutual Match!** ${interested.name} ↔ ${target.name} — both interested!\n👉 ${siteUrl}`
            : `🔔 **New Interest!** ${interested.name} (${interested.gender || "unknown"}) → ${target.name} (${target.gender || "unknown"}) — He's looking for someone to chat with!\n👉 ${siteUrl}`,
        }),
      }).catch(() => {});
    }

    // Admin notification
    await supabase.from("admin_notifications").insert({
      type: "new_interest",
      title: emailsSent.includes("mutual_match") ? "Mutual Match!" : "Connection Interest",
      message: emailsSent.includes("mutual_match")
        ? `${interested.name} ↔ ${target.name} — mutual match!`
        : `${interested.name} wants to connect with ${target.name}`,
      reference_id: target_user_id,
    });

    return new Response(JSON.stringify({ success: true, emails_sent: emailsSent }), {
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
