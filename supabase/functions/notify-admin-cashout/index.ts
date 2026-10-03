import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendResendEmail } from "../_shared/resend.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "business@c24club.com";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.record?.id;
    if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, reason: "invalid" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Never trust the request body — re-read the real row.
    const { data: row } = await admin
      .from("cashout_requests")
      .select("id, user_id, minutes_amount, cash_amount, paypal_email, status, source, created_at")
      .eq("id", id)
      .maybeSingle();
    if (!row) return json({ ok: false, reason: "not_found" });
    if (Date.now() - new Date(row.created_at).getTime() > 10 * 60 * 1000) return json({ ok: false, reason: "stale" });

    const { data: member } = await admin.from("members").select("name, email, gender").eq("id", row.user_id).maybeSingle();
    const amount = Number(row.cash_amount || 0).toFixed(2);

    const html = `
      <div style="font-family:Arial,sans-serif;background:#ffffff;padding:24px;color:#111">
        <h2 style="margin:0 0 12px">💵 New cash-out request: $${amount}</h2>
        <table style="border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Member</td><td>${esc(member?.name || "Unknown")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Account email</td><td>${esc(member?.email)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">PayPal</td><td>${esc(row.paypal_email)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Amount</td><td><b>$${amount}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Minutes</td><td>${esc(row.minutes_amount)}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Type</td><td>${esc(row.source || "minutes")}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Requested</td><td>${esc(new Date(row.created_at).toUTCString())}</td></tr>
        </table>
        <p style="margin-top:20px"><a href="https://c24club.com/admin" style="background:#e11d48;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Open admin</a></p>
      </div>`;

    await sendResendEmail({
      to: ADMIN_EMAIL,
      subject: `New cash-out request: $${amount} from ${member?.name || "a member"}`,
      html,
      force: true,
    });
    return json({ ok: true });
  } catch (e) {
    console.error("notify-admin-cashout error", e);
    return json({ ok: false, reason: "error" }, 500);
  }
});
