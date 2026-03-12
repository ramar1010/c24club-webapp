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

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    const toAliExpressMobileUrl = (inputUrl: string) => {
      try {
        const parsed = new URL(inputUrl);
        if (!parsed.hostname.includes("aliexpress")) return null;
        return `https://m.aliexpress.com${parsed.pathname}`;
      } catch {
        return null;
      }
    };

    const mobileUrl = toAliExpressMobileUrl(formattedUrl);
    const attempts = [
      {
        label: "primary",
        url: formattedUrl,
        waitFor: 2500,
        timeout: 45000,
        onlyMainContent: true,
      },
      mobileUrl && mobileUrl !== formattedUrl
        ? {
            label: "mobile-fallback",
            url: mobileUrl,
            waitFor: 3500,
            timeout: 70000,
            onlyMainContent: true,
          }
        : {
            label: "slow-fallback",
            url: formattedUrl,
            waitFor: 5000,
            timeout: 90000,
            onlyMainContent: false,
          },
    ];

    const schema = {
      type: "object",
      properties: {
        title: { type: "string", description: "Product title/name" },
        description: { type: "string", description: "Product description text" },
        price: { type: "string", description: "Product price" },
        images: {
          type: "array",
          items: { type: "string" },
          description: "All product image URLs (full resolution, not thumbnails)",
        },
        sizes: {
          type: "array",
          items: { type: "string" },
          description: "Available sizes like S, M, L, XL, or numeric sizes",
        },
        colors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Color name" },
              image_url: { type: "string", description: "Image URL for this color variant" },
            },
          },
          description: "Available color options with their variant images",
        },
      },
    };

    let lastTimeoutError: string | null = null;

    for (const attempt of attempts) {
      console.log(
        `Scraping product URL (${attempt.label}): ${attempt.url} | waitFor=${attempt.waitFor} timeout=${attempt.timeout}`
      );

      const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: attempt.url,
          formats: ["extract"],
          extract: {
            schema,
            prompt:
              "Extract the product title, description, all product image URLs (not thumbnails — full size images), available sizes, available colors with their variant image URLs, and the price. For images, get ALL product gallery images.",
          },
          onlyMainContent: attempt.onlyMainContent,
          waitFor: attempt.waitFor,
          timeout: attempt.timeout,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        const extracted = data?.data?.extract || data?.extract || data?.data?.json || data?.json || {};

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

        console.log(
          `Scraped: ${result.title}, ${result.images.length} images, ${result.sizes.length} sizes, ${result.colors.length} colors`
        );

        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isTimeout = response.status === 408 || data?.code === "SCRAPE_TIMEOUT";
      if (isTimeout) {
        lastTimeoutError =
          data?.error ||
          "The scrape operation timed out before completing."
;
        console.warn(`Timeout on ${attempt.label}, trying next strategy...`);
        continue;
      }

      console.error("Firecrawl error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Scrape failed (${response.status})` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error:
          lastTimeoutError ||
          "Scrape timed out after multiple attempts. Try a different product URL or retry in a moment.",
      }),
      { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
