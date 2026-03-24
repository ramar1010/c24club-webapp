const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 1: Get page content — use Firecrawl (renders JS) or fallback to direct fetch
    let pageContent = "";

    if (firecrawlKey) {
      console.log(`Using Firecrawl to scrape: ${formattedUrl}`);
      try {
        const fcRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: formattedUrl,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
            timeout: 60000,
          }),
        });

        const fcData = await fcRes.json();
        if (fcRes.ok && fcData?.data?.markdown) {
          pageContent = fcData.data.markdown;
          console.log(`Firecrawl returned ${pageContent.length} chars of markdown`);
        } else {
          console.warn("Firecrawl failed, falling back to direct fetch:", fcData?.error || fcRes.status);
        }
      } catch (fcErr) {
        console.warn("Firecrawl error, falling back:", fcErr);
      }
    }

    // Fallback: direct fetch (won't work well for JS-rendered pages)
    if (!pageContent) {
      console.log(`Direct fetch fallback: ${formattedUrl}`);
      try {
        const pageRes = await fetch(formattedUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
          redirect: "follow",
        });
        pageContent = await pageRes.text();
      } catch (fetchErr) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not fetch the product page. Check the URL and try again." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Truncate to fit AI context
    if (pageContent.length > 40000) {
      pageContent = pageContent.substring(0, 40000);
    }

    // Step 2: Use AI to extract structured product info
    const aiPrompt = `You are a product data extractor. Extract product information from this page content and return ONLY valid JSON (no markdown fences, no explanation).

Return this exact JSON structure:
{
  "title": "product title",
  "description": "product description",
  "price": "price as shown on page",
  "images": ["full URL of each product image"],
  "sizes": ["S", "M", "L", etc],
  "colors": [{"name": "color name", "image_url": "URL of color variant image"}]
}

Rules:
- For images: extract ALL product image URLs you can find. They must start with http. Look for full-size image URLs, not tiny thumbnails.
- For AliExpress images: look for URLs containing alicdn.com or aliexpress-media.com
- If a field has no data, use "" for strings or [] for arrays.
- Return ONLY the JSON object, nothing else.

Page content:
${pageContent}`;

    console.log("Calling AI for extraction...");
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: aiPrompt }],
        model: "google/gemini-2.5-flash",
        max_tokens: 8192,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "AI rate limit reached. Please wait a moment and try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ success: false, error: "AI extraction failed. Try again in a moment." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const aiContent = aiData?.choices?.[0]?.message?.content || "";
    const finishReason = aiData?.choices?.[0]?.finish_reason;
    console.log(`AI response length: ${aiContent.length}, finish_reason: ${finishReason}`);

    // Parse JSON from AI response
    let extracted: any = {};
    try {
      const jsonStr = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiContent.substring(0, 500));
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse product data from this page. Try a different URL." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = {
      success: true,
      title: extracted.title || "",
      description: extracted.description || "",
      price: extracted.price || "",
      images: (extracted.images || []).filter((u: string) => u && u.startsWith("http")),
      sizes: extracted.sizes || [],
      colors: (extracted.colors || []).map((c: any) => ({
        name: c.name || "",
        hex: "#000000",
        image_url: c.image_url || "",
      })),
    };

    console.log(`Extracted: "${result.title}", ${result.images.length} images, ${result.sizes.length} sizes, ${result.colors.length} colors`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
