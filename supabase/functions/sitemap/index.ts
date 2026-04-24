import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/xml; charset=utf-8",
};

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const domain = "https://c24club.com";

  // Static pages
  const staticPages = [
    { loc: "/", priority: "1.0", changefreq: "daily" },
    { loc: "/blog", priority: "0.9", changefreq: "daily" },
    { loc: "/how-to-guide", priority: "0.8", changefreq: "monthly" },
    { loc: "/rules", priority: "0.5", changefreq: "monthly" },
    { loc: "/privacy-policy", priority: "0.3", changefreq: "yearly" },
    { loc: "/terms", priority: "0.3", changefreq: "yearly" },
    { loc: "/rewards", priority: "0.7", changefreq: "weekly" },
    { loc: "/events", priority: "0.6", changefreq: "weekly" },
    { loc: "/challenges", priority: "0.7", changefreq: "weekly" },
    { loc: "/spin", priority: "0.6", changefreq: "monthly" },
    { loc: "/referral", priority: "0.6", changefreq: "monthly" },
    { loc: "/omegle-alternative", priority: "0.9", changefreq: "weekly" },
    { loc: "/top-omegle-alternatives", priority: "0.9", changefreq: "weekly" },
    { loc: "/video-chat-with-strangers", priority: "0.9", changefreq: "weekly" },
    { loc: "/random-video-chat", priority: "0.9", changefreq: "weekly" },
    { loc: "/talk-to-strangers", priority: "0.9", changefreq: "weekly" },
    { loc: "/free-video-chat-no-sign-up", priority: "0.9", changefreq: "weekly" },
    { loc: "/cam-chat", priority: "0.9", changefreq: "weekly" },
  ];

  // Fetch published blog posts
  const { data: posts } = await supabase
    .from("blog_posts")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const today = new Date().toISOString().split("T")[0];

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${domain}${page.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Add blog posts
  if (posts) {
    for (const post of posts) {
      const lastmod = post.updated_at
        ? new Date(post.updated_at).toISOString().split("T")[0]
        : today;
      xml += `  <url>
    <loc>${domain}/blog/${post.slug}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
    }
  }

  xml += `</urlset>`;

  return new Response(xml, { status: 200, headers: corsHeaders });
});
