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

    // Step 1: Fetch the page HTML
    console.log(`Fetching page: ${formattedUrl}`);
    let pageHtml = "";
    try {
      const pageRes = await fetch(formattedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        redirect: "follow",
      });
      pageHtml = await pageRes.text();
      // Truncate to ~30k chars to fit in AI context
      if (pageHtml.length > 30000) {
        pageHtml = pageHtml.substring(0, 30000);
      }
    } catch (fetchErr) {
      console.error("Page fetch failed:", fetchErr);
      return new Response(
        JSON.stringify({ success: false, error: "Could not fetch the product page. Check the URL and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Use AI to extract product info from the HTML
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiPrompt = `Extract product information from this HTML page. Return ONLY valid JSON with these fields:
{
  "title": "product title",
  "description": "product description text",
  "price": "price as shown",
  "images": ["array of full product image URLs (https://...) - get ALL product gallery images, not thumbnails"],
  "sizes": ["array of available sizes like S, M, L, XL"],
  "colors": [{"name": "color name", "image_url": "image URL for this color variant"}]
}

Rules:
- For images: extract ALL product image URLs. Look for high-res/full-size URLs in img tags, data attributes, and JSON-LD data. Skip tiny icons/logos.
- For AliExpress: look for image URLs in window.runParams, <script> blocks with JSON data, and img tags with src containing ae01.alicdn.com
- If a field is not found, use empty string or empty array.
- Return ONLY the JSON object, no markdown, no explanation.

HTML content:
${pageHtml}`;

    const aiRes = await fetch("https://ai.lovable.dev/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: aiPrompt }],
        model: "google/gemini-2.5-flash",
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({ success: false, error: "AI extraction failed. Try pasting product details manually." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiRes.json();
    const aiContent = aiData?.choices?.[0]?.message?.content || "";

    // Parse JSON from AI response (strip markdown code fences if present)
    let extracted: any = {};
    try {
      const jsonStr = aiContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(
        JSON.stringify({ success: false, error: "Could not parse product data. Try a different URL." }),
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

    console.log(`Extracted: ${result.title}, ${result.images.length} images, ${result.sizes.length} sizes, ${result.colors.length} colors`);

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
