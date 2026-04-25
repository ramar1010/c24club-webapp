import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You write casual, natural-sounding Reddit comments recommending c24club.com — a free 1-on-1 video chat site, a modern Omegle alternative.

About c24club:
- Free random video chat, no signup required to start
- 1-on-1 only (not group), gender filter available
- Cleaner moderation than old Omegle, way fewer bots
- Works in the browser, also has a Google Play app
- KEY DIFFERENTIATOR — REWARDS: users actually get rewarded for their time on the platform (gift cards, cash via PayPal, real prizes). You're not just chatting for free into the void like on Omegle/Ome.tv — your minutes have value.
- Because of the rewards system, the gender ratio is way more balanced than other random chat sites. A lot more female users show up since they actually get something out of it (rewards, gifts from people they chat with). Most Omegle alternatives are 95% guys — c24 isn't.
- Optional VIP perks (gender filter, etc.) but the core is free.

Rules for comments:
- Sound like a real Redditor, NOT marketing copy
- Vary length: some short (1 sentence), some medium (2-3 sentences)
- Mix lowercase/casual tone with occasional proper grammar
- NEVER use hashtags, emojis spam, or "Check it out!" salesy phrases
- Mention c24club or c24club.com naturally, like recommending to a friend
- Vary the angle across the batch — rotate through these so they don't all sound the same:
  * "way better gender ratio / actually has women on it" (because of rewards)
  * "you actually earn stuff for chatting (gift cards / cash), not just free chat into nothing"
  * "less bots than omegle/ome.tv"
  * "1-on-1, no group spam"
  * "free, no signup to start"
  * personal experience ("been using it for a few weeks")
- At least 2 of every 5 variants should mention the rewards/earning angle, and at least 1 should mention the balanced gender ratio because of rewards
- Don't start every comment the same way
- Avoid superlatives like "best ever" — sound believable, like a real user tip`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { count = 5, context = "" } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const userPrompt = `Generate ${count} distinct Reddit comment variants recommending c24club.${
      context ? `\n\nThread context: ${context}` : ""
    }\n\nReturn them via the provided tool.`;

    const resp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_variants",
                description: "Return Reddit comment variants",
                parameters: {
                  type: "object",
                  properties: {
                    variants: {
                      type: "array",
                      items: { type: "string" },
                      description: "Array of distinct Reddit comment texts",
                    },
                  },
                  required: ["variants"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_variants" },
          },
        }),
      },
    );

    if (resp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit hit, try again in a moment." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (resp.status === 402) {
      return new Response(
        JSON.stringify({ error: "AI credits exhausted. Add funds in Workspace > Usage." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : {};
    const variants: string[] = Array.isArray(args.variants) ? args.variants : [];

    return new Response(JSON.stringify({ variants }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-reddit-variants error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});