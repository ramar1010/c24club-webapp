import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: { user } } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleCheck } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!roleCheck) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { xml } = await req.json();
    if (!xml) {
      return new Response(JSON.stringify({ error: 'XML content required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse WordPress XML export
    const posts = parseWordPressXML(xml);
    
    let imported = 0;
    let skipped = 0;

    for (const post of posts) {
      // Check if slug already exists
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', post.slug)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error } = await supabase.from('blog_posts').insert({
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt || null,
        content: post.content,
        featured_image_url: post.featured_image_url || null,
        meta_title: post.meta_title || null,
        meta_description: post.meta_description || null,
        author_name: post.author || 'C24 Club',
        category: post.category || null,
        tags: post.tags || [],
        status: post.status === 'publish' ? 'published' : 'draft',
        published_at: post.published_at || null,
      });

      if (!error) imported++;
      else console.error('Insert error:', error.message);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      imported, 
      skipped, 
      total: posts.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Import error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function parseWordPressXML(xml: string) {
  const posts: any[] = [];
  
  // Extract all <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1];
    
    // Only process posts (not pages, attachments, etc.)
    const postType = extractTag(item, 'wp:post_type');
    if (postType && postType !== 'post') continue;

    const title = extractTag(item, 'title') || '';
    const link = extractTag(item, 'link') || '';
    const slug = extractTag(item, 'wp:post_name') || generateSlug(title);
    const status = extractTag(item, 'wp:status') || 'draft';
    const pubDate = extractTag(item, 'pubDate');
    const creator = extractTag(item, 'dc:creator');
    
    // Get content from CDATA
    const content = extractCDATA(item, 'content:encoded') || '';
    const excerpt = extractCDATA(item, 'excerpt:encoded') || '';

    // Extract categories and tags
    const categories: string[] = [];
    const tags: string[] = [];
    const catRegex = /<category\s+domain="([^"]+)"[^>]*><!\[CDATA\[(.*?)\]\]><\/category>/g;
    let catMatch;
    while ((catMatch = catRegex.exec(item)) !== null) {
      if (catMatch[1] === 'category') categories.push(catMatch[2]);
      else if (catMatch[1] === 'post_tag') tags.push(catMatch[2]);
    }

    // Try to extract Yoast/RankMath SEO meta
    const metaTitle = extractMeta(item, '_yoast_wpseo_title') || 
                      extractMeta(item, 'rank_math_title') || '';
    const metaDescription = extractMeta(item, '_yoast_wpseo_metadesc') || 
                            extractMeta(item, 'rank_math_description') || '';

    // Extract featured image (thumbnail)
    const featuredImage = extractMeta(item, '_thumbnail_url') || '';

    posts.push({
      title: decodeHTMLEntities(title),
      slug,
      content,
      excerpt: excerpt || null,
      status,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
      author: creator || 'C24 Club',
      category: categories[0] || null,
      tags,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      featured_image_url: featuredImage || null,
    });
  }

  return posts;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1];

  // Handle plain text
  const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractCDATA(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`);
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function extractMeta(xml: string, metaKey: string): string | null {
  const regex = new RegExp(
    `<wp:postmeta>\\s*<wp:meta_key><!\\[CDATA\\[${metaKey}\\]\\]><\\/wp:meta_key>\\s*<wp:meta_value><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/wp:meta_value>\\s*<\\/wp:postmeta>`
  );
  const match = regex.exec(xml);
  return match ? match[1] : null;
}

function generateSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"');
}
