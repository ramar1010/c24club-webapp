const RESEND_API_URL = "https://api.resend.com/emails";

export interface ResendEmailOptions {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendResendEmail(options: ResendEmailOptions): Promise<{ id: string }> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured");
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