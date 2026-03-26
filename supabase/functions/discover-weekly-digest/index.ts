import { createClient } from "npm:@supabase/supabase-js@2";

const SENDER_DOMAIN = "c24club.com";
const SITE_URL = "https://c24club.com";

function buildDigestHtml(member: any, stats: { newInterests: number; mutualMatches: number; totalDiscoverable: number; profileViews: number }): string {
  const earnBlock = member.gender?.toLowerCase() === "female"
    ? `<tr><td style="padding:0 24px 16px;">
        <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;text-align:center;">
          <p style="color:#059669;font-weight:bold;margin:0;">💰 Don't forget — you earn CASH for every video chat!</p>
        </div>
      </td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background-color:#f7f9fb;font-family:Inter,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f9fb;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,hsl(205,65%,45%),#6366f1);padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#fff;">Your Weekly Discover Update 📊</h1>
        </td></tr>
        <tr><td style="padding:24px;">
          <p style="font-size:16px;margin:0 0 20px;text-align:center;color:#333;">Hey <strong>${member.name}</strong>, here's what happened this week!</p>
        </td></tr>
        <tr><td style="padding:0 24px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="25%" style="text-align:center;background:#fafafa;border-radius:10px;padding:16px 6px;">
                <p style="font-size:26px;font-weight:bold;color:#8b5cf6;margin:0;">${stats.profileViews}</p>
                <p style="font-size:10px;color:#888;margin:4px 0 0;">👀 Profile Views</p>
              </td>
              <td width="4"></td>
              <td width="25%" style="text-align:center;background:#fafafa;border-radius:10px;padding:16px 6px;">
                <p style="font-size:26px;font-weight:bold;color:#ec4899;margin:0;">${stats.newInterests}</p>
                <p style="font-size:10px;color:#888;margin:4px 0 0;">💌 Interests</p>
              </td>
              <td width="4"></td>
              <td width="25%" style="text-align:center;background:#fafafa;border-radius:10px;padding:16px 6px;">
                <p style="font-size:26px;font-weight:bold;color:#f59e0b;margin:0;">${stats.mutualMatches}</p>
                <p style="font-size:10px;color:#888;margin:4px 0 0;">🎉 Matches</p>
              </td>
              <td width="4"></td>
              <td width="25%" style="text-align:center;background:#fafafa;border-radius:10px;padding:16px 6px;">
                <p style="font-size:26px;font-weight:bold;color:hsl(205,65%,45%);margin:0;">${stats.totalDiscoverable}</p>
                <p style="font-size:10px;color:#888;margin:4px 0 0;">🌐 Online</p>
              </td>
            </tr>
          </table>
        </td></tr>

        ${stats.newInterests > 0 ? `
        <tr><td style="padding:0 24px 16px;">
          <div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:14px;text-align:center;">
            <p style="color:#059669;font-weight:bold;margin:0;">🔥 ${stats.newInterests} ${stats.newInterests === 1 ? "person wants" : "people want"} to connect with you!</p>
          </div>
        </td></tr>
        ` : ""}

        ${stats.mutualMatches > 0 ? `
        <tr><td style="padding:0 24px 16px;">
          <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;text-align:center;">
            <p style="color:#b45309;font-weight:bold;margin:0;">🎉 You have ${stats.mutualMatches} mutual ${stats.mutualMatches === 1 ? "match" : "matches"}!</p>
          </div>
        </td></tr>
        ` : ""}

        ${earnBlock}

        <tr><td style="padding:0 24px 28px;" align="center">
          <a href="${SITE_URL}/discover" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,hsl(205,65%,45%),#6366f1);color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;">Open Discover →</a>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#999;text-align:center;">© ${new Date().getFullYear()} C24 Club</p>
    </td></tr>
  </table>
</body>
</html>`;
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

      // More curiosity-driven subject line
      const subject = (newInterests || 0) > 0
        ? `${newInterests} ${(newInterests || 0) === 1 ? "person" : "people"} checked out your profile this week 👀`
        : `Your weekly C24Club update — ${mutualMatches} match${mutualMatches === 1 ? "" : "es"} 🎉`;

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
          from: `C24Club <support@${SENDER_DOMAIN}>`,
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
