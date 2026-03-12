import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    console.log("Scraping product URL:", formattedUrl);

    // Use Firecrawl with JSON extraction for structured data + markdown for description
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: [
          "markdown",
          {
            type: "json",
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "Product title/name" },
                description: { type: "string", description: "Product description text" },
                price: { type: "string", description: "Product price" },
                images: {
                  type: "array",
                  items: { type: "string" },
                  description: "All product image URLs (full resolution)",
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
            },
            prompt:
              "Extract the product title, description, all product image URLs (not thumbnails — full size images), available sizes, available colors with their variant image URLs, and the price. For images, get ALL product gallery images.",
          },
        ],
        waitFor: 3000,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Firecrawl error:", data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Scrape failed (${response.status})` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract structured data
    const json = data?.data?.json || data?.json || {};
    const markdown = data?.data?.markdown || data?.markdown || "";

    const result = {
      success: true,
      title: json.title || "",
      description: json.description || markdown?.slice(0, 500) || "",
      price: json.price || "",
      images: (json.images || []).filter((u: string) => u && u.startsWith("http")),
      sizes: json.sizes || [],
      colors: (json.colors || []).map((c: any) => ({
        name: c.name || "",
        hex: "#000000",
        image_url: c.image_url || "",
      })),
    };

    console.log(`Scraped: ${result.title}, ${result.images.length} images, ${result.sizes.length} sizes, ${result.colors.length} colors`);

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
