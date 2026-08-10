const RESEND_API_URL = "https://api.resend.com/emails";

export interface ResendEmailOptions {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  /** Set true for critical/transactional mail that ignores the user's email opt-out. */
  force?: boolean;
}

async function isEmailOptedOut(email: string): Promise<boolean> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return false;
    const res = await fetch(
      `${url}/rest/v1/members?select=email_notifications_enabled&email=eq.${encodeURIComponent(email)}&limit=1`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );
    if (!res.ok) return false;
    const rows = await res.json();
    return rows?.[0]?.email_notifications_enabled === false;
  } catch (_e) {
    return false;
  }
}

export async function sendResendEmail(options: ResendEmailOptions): Promise<{ id: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
  }

  if (!options.force && (await isEmailOptedOut(options.to))) {
    console.log(`[resend] skipped: ${options.to} has email notifications turned off`);
    return { id: "skipped-opted-out" };
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: options.from || "C24Club <support@c24club.com>",
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ""),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("Resend API error:", JSON.stringify(data));
    throw new Error(`Resend API error [${res.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}