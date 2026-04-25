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
    const {
      count = 5,
      context = "",
      noLinkMode = false,
      length = "mixed", // "short" | "medium" | "long" | "mixed"
      tone = "casual", // "casual" | "enthusiastic" | "skeptical" | "blunt" | "helpful" | "mixed"
      angles = [] as string[], // subset of: rewards, gender-ratio, less-bots, one-on-one, free-no-signup, personal-experience
      customInstructions = "",
      avoidPhrases = "", // newline or comma-separated phrases to avoid (e.g. previously generated openings)
    } = await req.json().catch(() => ({}));
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const noLinkInstruction = noLinkMode
      ? `\n\nIMPORTANT — NO-LINK MODE: Do NOT include the full URL "c24club.com" (no ".com", no "https://", no clickable link). BUT you MUST mention the brand name "c24club" or "c24" naturally in EVERY comment so readers know what to search for (e.g. "I've been using c24club", "try c24", "there's this site called c24club"). Do NOT tell the reader to check a bio, profile, or DM. Curious readers will Google "c24club" themselves. This avoids Reddit's link-spam filter while still giving the brand recognition.`
      : "";

    const lengthMap: Record<string, string> = {
      short: "Every variant must be SHORT — 1 sentence, max ~15 words. Punchy, casual, like a quick drive-by recommendation.",
      medium: "Every variant must be MEDIUM — 2-3 sentences, ~20-45 words. Conversational.",
      long: "Every variant must be LONGER — 3-5 sentences, ~50-90 words. Sounds like a thoughtful personal recommendation with a small story or detail.",
      mixed: "VARY the length deliberately across the batch: at least one 1-sentence punchy reply, at least one 2-3 sentence medium, and at least one 3-5 sentence longer reply. Do not make them all the same length.",
    };

    const toneMap: Record<string, string> = {
      casual: "Tone: casual, lowercase-leaning, like a regular Redditor commenting on their phone. Occasional typos or sentence fragments are fine.",
      enthusiastic: "Tone: genuinely enthusiastic and positive, like recommending something you actually love — but without sounding like an ad.",
      skeptical: "Tone: slightly skeptical at first, then admits it's actually decent (e.g. 'wasn't expecting much but...'). Sounds more believable.",
      blunt: "Tone: blunt, short, matter-of-fact. No fluff. Like 'just use c24, way less bots.'",
      helpful: "Tone: helpful and informative, like answering someone's actual question patiently.",
      mixed: "VARY the tone across the batch — mix casual, slightly skeptical/honest, enthusiastic, and blunt. Don't make them all sound the same.",
    };

    const angleLabels: Record<string, string> = {
      rewards: "users actually earn rewards (gift cards / cash / PayPal) for chat time",
      "gender-ratio": "way more balanced gender ratio than other random chat sites because of the rewards system",
      "less-bots": "way fewer bots than Omegle / Ome.tv",
      "one-on-one": "1-on-1 only, no group chat spam",
      "free-no-signup": "free to start, no signup required",
      "personal-experience": "first-person personal experience ('been using it for a few weeks', 'met someone cool on there', etc.)",
    };

    const angleInstruction = angles && angles.length > 0
      ? `\n\nFOCUS THE BATCH on these angles ONLY — rotate through them so different variants emphasize different things:\n${angles
          .map((a: string) => `- ${angleLabels[a] || a}`)
          .join("\n")}\n\nDo NOT use angles outside this list.`
      : "";

    const customInstr = customInstructions && customInstructions.trim()
      ? `\n\nADDITIONAL ADMIN INSTRUCTIONS (highest priority — follow these exactly):\n${customInstructions.trim()}`
      : "";

    const avoidInstr = avoidPhrases && avoidPhrases.trim()
      ? `\n\nAVOID these openings/phrasings entirely (already used in prior batches — write something distinctly different):\n${avoidPhrases.trim()}`
      : "";

    const userPrompt = `Generate ${count} distinct Reddit comment variants recommending c24club.${
      context ? `\n\nThread context: ${context}` : ""
    }\n\nLENGTH RULE: ${lengthMap[length] || lengthMap.mixed}\n\nTONE RULE: ${toneMap[tone] || toneMap.casual}${angleInstruction}${customInstr}${avoidInstr}${noLinkInstruction}\n\nMake every variant clearly distinct from the others — different opening words, different sentence structure, different angle. Return them via the provided tool.`;

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