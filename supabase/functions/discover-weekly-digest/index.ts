import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER_DOMAIN = "notify.c24club.com";
const SITE_URL = "https://c24club.lovable.app";

function buildDigestHtml(member: any, stats: { newInterests: number; mutualMatches: number; totalDiscoverable: number }): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #1a1a1a; color: #fff; border-radius: 12px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #8b5cf6, #ec4899); padding: 24px; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; color: #fff;">Your Weekly Discover Update 📊</h1>
      </div>
      <div style="padding: 24px;">
        <p style="font-size: 16px; margin: 0 0 20px; text-align: center;">Hey <strong>${member.name}</strong>, here's what happened this week!</p>
        
        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
          <div style="flex: 1; background: #262626; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; color: #ec4899; margin: 0;">${stats.newInterests}</p>
            <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0;">New Interests</p>
          </div>
          <div style="flex: 1; background: #262626; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; color: #f59e0b; margin: 0;">${stats.mutualMatches}</p>
            <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0;">Matches</p>
          </div>
          <div style="flex: 1; background: #262626; border-radius: 10px; padding: 16px; text-align: center;">
            <p style="font-size: 28px; font-weight: bold; color: #3b82f6; margin: 0;">${stats.totalDiscoverable}</p>
            <p style="font-size: 12px; color: #9ca3af; margin: 4px 0 0;">People Online</p>
          </div>
        </div>

        ${stats.newInterests > 0 ? `
          <div style="background: #065f46; border: 1px solid #10b981; border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: center;">
            <p style="color: #34d399; font-weight: bold; margin: 0;">🔥 ${stats.newInterests} ${stats.newInterests === 1 ? "person wants" : "people want"} to connect with you!</p>
          </div>
        ` : ""}

        ${stats.mutualMatches > 0 ? `
          <div style="background: #78350f; border: 1px solid #f59e0b; border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: center;">
            <p style="color: #fbbf24; font-weight: bold; margin: 0;">🎉 You have ${stats.mutualMatches} mutual ${stats.mutualMatches === 1 ? "match" : "matches"}!</p>
          </div>
        ` : ""}

        ${member.gender?.toLowerCase() === "female" ? `
          <div style="background: #1e1b4b; border: 1px solid #6366f1; border-radius: 10px; padding: 14px; margin-bottom: 16px; text-align: center;">
            <p style="color: #a5b4fc; font-weight: bold; margin: 0;">💰 Don't forget — you earn CASH for every video chat!</p>
          </div>
        ` : ""}

        <a href="${SITE_URL}/discover" style="display: block; background: linear-gradient(135deg, #8b5cf6, #ec4899); color: #fff; text-align: center; padding: 14px; border-radius: 10px; text-decoration: none; font-weight: bold; font-size: 16px; margin-top: 16px;">Open Discover →</a>
        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 16px;">C24Club — Your weekly discovery recap</p>
      </div>
    </div>`;
}

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all discoverable members with emails
    const { data: discoverableMembers } = await supabase
      .from("members")
      .select("id, name, email, gender")
      .eq("is_discoverable", true)
      .not("email", "is", null);

    if (!discoverableMembers?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_discoverable_members" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get suppressed emails
    const { data: suppressedList } = await supabase.from("suppressed_emails").select("email");
    const suppressedSet = new Set((suppressedList || []).map((s: any) => s.email));

    // Get total discoverable count
    const totalDiscoverable = discoverableMembers.length;

    // Week boundary
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    let sent = 0;

    for (const member of discoverableMembers) {
      if (!member.email || suppressedSet.has(member.email)) continue;

      // Count new interests received this week
      const { count: newInterests } = await supabase
        .from("member_interests")
        .select("id", { count: "exact", head: true })
        .eq("interested_in_user_id", member.id)
        .gte("created_at", oneWeekAgo);

      // Count mutual matches
      const { data: myInterests } = await supabase
        .from("member_interests")
        .select("interested_in_user_id")
        .eq("user_id", member.id);

      const { data: interestedInMe } = await supabase
        .from("member_interests")
        .select("user_id")
        .eq("interested_in_user_id", member.id);

      const myTargets = new Set((myInterests || []).map((i: any) => i.interested_in_user_id));
      const incomingFrom = new Set((interestedInMe || []).map((i: any) => i.user_id));
      let mutualMatches = 0;
      for (const t of myTargets) {
        if (incomingFrom.has(t)) mutualMatches++;
      }

      // Skip if nothing to report
      if ((newInterests || 0) === 0 && mutualMatches === 0) continue;

      const html = buildDigestHtml(member, {
        newInterests: newInterests || 0,
        mutualMatches,
        totalDiscoverable,
      });

      const subject = (newInterests || 0) > 0
        ? `📊 ${newInterests} new ${(newInterests || 0) === 1 ? "person is" : "people are"} interested in you this week!`
        : `📊 Your weekly C24Club Discover update`;

      const messageId = `digest-${member.id}-${new Date().toISOString().slice(0, 10)}`;

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "discover_weekly_digest",
        recipient_email: member.email,
        status: "pending",
      });

      await supabase.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          run_id: crypto.randomUUID(),
          message_id: messageId,
          to: member.email,
          from: `C24Club <noreply@${SENDER_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject,
          html,
          text: html.replace(/<[^>]*>/g, ""),
          purpose: "transactional",
          label: "discover_weekly_digest",
          queued_at: new Date().toISOString(),
        },
      });
      sent++;
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("discover-weekly-digest error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
