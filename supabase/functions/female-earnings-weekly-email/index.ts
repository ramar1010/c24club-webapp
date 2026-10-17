import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://c24club.com";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function buildEmailHtml(opts: {
  name: string;
  weekEarned: number;
  cashable: number;
  nearCount: number;
  nearNames: string[];
}): string {
  const { name, weekEarned, cashable, nearCount, nearNames } = opts;
  const usd = (m: number) => (m * 0.01).toFixed(2);

  const nearBlock = nearCount > 0
    ? `<tr><td style="padding:0 24px 16px;">
        <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px;">
          <p style="color:#b45309;font-weight:bold;margin:0 0 6px;">🔥 ${nearCount} guy${nearCount > 1 ? "s are" : " is"} almost out of free messages${nearNames.length ? ` (${nearNames.slice(0, 3).join(", ")})` : ""}</p>
          <p style="color:#92400e;font-size:13px;margin:0;">After their free messages run out they must buy VIP to keep talking to you — and you get paid when they do. Reply to them today; a single reply is often all it takes.</p>
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
        <tr><td style="background:linear-gradient(135deg,#059669,#10b981);padding:24px;text-align:center;">
          <h1 style="margin:0;font-size:22px;color:#fff;">Your Weekly Earnings 💸</h1>
        </td></tr>
        <tr><td style="padding:24px 24px 8px;">
          <p style="font-size:16px;margin:0;text-align:center;color:#333;">Hey <strong>${name}</strong>, here's your money recap for the week!</p>
        </td></tr>
        <tr><td style="padding:16px 24px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="48%" style="text-align:center;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;padding:18px 6px;">
                <p style="font-size:26px;font-weight:bold;color:#059669;margin:0;">$${usd(weekEarned)}</p>
                <p style="font-size:11px;color:#888;margin:4px 0 0;">Earned this week<br/>(${weekEarned} min)</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="text-align:center;background:#fafafa;border-radius:10px;padding:18px 6px;">
                <p style="font-size:26px;font-weight:bold;color:#8b5cf6;margin:0;">$${usd(cashable)}</p>
                <p style="font-size:11px;color:#888;margin:4px 0 0;">Cashable balance<br/>(${cashable} min)</p>
              </td>
            </tr>
          </table>
        </td></tr>
        ${nearBlock}
        <tr><td style="padding:0 24px 16px;">
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px;">
            <p style="color:#0369a1;font-weight:bold;margin:0 0 6px;">💰 How to cash out</p>
            <p style="color:#075985;font-size:13px;margin:0;">Open the app → Profile → Cash Out. Enter your PayPal email and your minutes convert to cash at $0.01 per minute. That's it.</p>
          </div>
        </td></tr>
        <tr><td style="padding:0 24px 28px;" align="center">
          <a href="${SITE_URL}/profile" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#059669,#10b981);color:#fff;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;">Cash Out Now →</a>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:12px;color:#999;text-align:center;">© ${new Date().getFullYear()} C24 Club</p>
    </td></tr>
  </table>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  let testEmail: string | null = null;
  try {
    const payload = await req.json().catch(() => ({}));
    testEmail = payload?.test_email ?? null;
  } catch (_) { /* no body */ }

  try {
    // Female members with an email on file
    let memberQuery = supabase
      .from("members")
      .select("id, name, email")
      .ilike("gender", "female")
      .not("email", "is", null);
    if (testEmail) memberQuery = memberQuery.ilike("email", testEmail);
    const { data: females, error: femErr } = await memberQuery;
    if (femErr) throw femErr;
    if (!females?.length) return json({ success: true, sent: 0, reason: "no_females" });

    // Suppressed emails
    const { data: suppressedList } = await supabase.from("suppressed_emails").select("email");
    const suppressedSet = new Set((suppressedList || []).map((s: any) => s.email));

    // Near-limit guy data (reuses the daily digest RPC)
    const { data: digestRows } = await supabase.rpc("get_female_earnings_digest");
    const digestByFemale = new Map<string, any>(
      (digestRows ?? []).map((r: any) => [r.female_id, r]),
    );

    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    let sent = 0;
    let skipped = 0;

    for (const female of females) {
      if (!female.email || suppressedSet.has(female.email)) { skipped++; continue; }

      // Minutes earned in the last 7 days (bounty payouts, not clawed back)
      const { data: weekBounties } = await supabase
        .from("bounty_earnings")
        .select("amount_minutes")
        .eq("female_id", female.id)
        .eq("clawed_back", false)
        .gte("created_at", oneWeekAgo);
      const weekEarned = (weekBounties ?? []).reduce(
        (sum: number, b: any) => sum + Number(b.amount_minutes ?? 0), 0,
      );

      // Current cashable balance
      const { data: bal } = await supabase
        .from("member_minutes")
        .select("gifted_minutes")
        .eq("user_id", female.id)
        .maybeSingle();
      const cashable = Number(bal?.gifted_minutes ?? 0);

      const digest = digestByFemale.get(female.id);
      const nearCount = Number(digest?.near_limit_count ?? 0);
      const nearNames: string[] = digest?.near_limit_names ?? [];

      // Skip members with nothing to report
      if (!testEmail && weekEarned === 0 && cashable === 0 && nearCount === 0) { skipped++; continue; }

      const name = female.name || "there";
      const html = buildEmailHtml({ name, weekEarned, cashable, nearCount, nearNames });
      const subject = weekEarned > 0
        ? `💸 You earned $${(weekEarned * 0.01).toFixed(2)} this week — cash it out!`
        : cashable > 0
        ? `💰 You have $${(cashable * 0.01).toFixed(2)} waiting to cash out`
        : `🔥 ${nearCount} guy${nearCount === 1 ? " is" : "s are"} about to have to pay to keep chatting with you`;

      const messageId = `female-weekly-earnings-${female.id}-${new Date().toISOString().slice(0, 10)}`;

      try {
        await sendResendEmail({ to: female.email, subject, html });
        await supabase.from("email_send_log").insert({
          message_id: messageId,
          template_name: "female_weekly_earnings",
          recipient_email: female.email,
          status: "sent",
        });
        sent++;
      } catch (sendErr) {
        console.error(`[female-earnings-weekly-email] failed for ${female.email}:`, sendErr);
      }
    }

    console.log("[female-earnings-weekly-email] done", { candidates: females.length, sent, skipped });
    return json({ success: true, candidates: females.length, sent, skipped });
  } catch (err: any) {
    console.error("[female-earnings-weekly-email] error", err?.message ?? err);
    return json({ success: false, error: err?.message ?? String(err) }, 500);
  }
});
