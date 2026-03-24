import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Calendar, Clock, ArrowLeft, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  author_name: string | null;
  category: string | null;
  tags: string[] | null;
  published_at: string | null;
}

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      if (!slug) return;
      const { data } = await supabase
        .from("blog_posts")
        .select("*")
        .eq("slug", slug)
        .eq("status", "published")
        .maybeSingle();
      setPost(data);
      setLoading(false);
    };
    fetchPost();
  }, [slug]);

  // SEO meta tags
  useEffect(() => {
    if (!post) return;
    document.title = post.meta_title || `${post.title} — C24 Club Blog`;
    
    const setMeta = (name: string, content: string) => {
      let el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        if (name.startsWith("og:") || name.startsWith("article:")) {
          el.setAttribute("property", name);
        } else {
          el.setAttribute("name", name);
        }
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };

    const desc = post.meta_description || post.excerpt || post.title;
    setMeta("description", desc);
    setMeta("og:title", post.meta_title || post.title);
    setMeta("og:description", desc);
    setMeta("og:type", "article");
    if (post.featured_image_url) setMeta("og:image", post.featured_image_url);
    if (post.published_at) setMeta("article:published_time", post.published_at);
    if (post.author_name) setMeta("article:author", post.author_name);

    // JSON-LD structured data
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: desc,
      image: post.featured_image_url || undefined,
      datePublished: post.published_at || undefined,
      author: { "@type": "Person", name: post.author_name || "C24 Club" },
      publisher: { "@type": "Organization", name: "C24 Club" },
    };
    let script = document.getElementById("blog-jsonld") as HTMLScriptElement;
    if (!script) {
      script = document.createElement("script");
      script.id = "blog-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(jsonLd);

    return () => {
      script?.remove();
    };
  }, [post]);

  const estimateReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <PublicNav />
        <div className="max-w-3xl mx-auto px-4 pt-28">
          <div className="h-8 w-2/3 bg-white/10 rounded animate-pulse mb-4" />
          <div className="h-64 bg-white/5 rounded-2xl animate-pulse mb-6" />
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] text-white">
        <PublicNav />
        <div className="max-w-3xl mx-auto px-4 pt-28 text-center">
          <h1 className="text-3xl font-bold mb-4">Post Not Found</h1>
          <p className="text-white/50 mb-6">The blog post you're looking for doesn't exist.</p>
          <Link to="/blog" className="text-amber-400 hover:underline">← Back to Blog</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <PublicNav />

      <article className="max-w-3xl mx-auto px-4 pt-28 pb-20">
        <Link to="/blog" className="inline-flex items-center gap-2 text-white/50 hover:text-amber-400 transition-colors mb-8 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>

        {post.category && (
          <span className="inline-block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-3">
            {post.category}
          </span>
        )}

        <h1 className="text-3xl md:text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Antigone', sans-serif" }}>
          {post.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-white/40 mb-8">
          <span className="flex items-center gap-1">
            <User className="w-4 h-4" /> {post.author_name || "C24 Club"}
          </span>
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(new Date(post.published_at), "MMMM d, yyyy")}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {estimateReadTime(post.content)} min read
          </span>
        </div>

        {post.featured_image_url && (
          <img
            src={post.featured_image_url}
            alt={post.title}
            className="w-full rounded-2xl mb-8 max-h-[400px] object-cover"
          />
        )}

        <div
          className="prose prose-invert prose-lg max-w-none prose-headings:font-bold prose-headings:mt-10 prose-headings:mb-4 prose-h2:mt-12 prose-h3:mt-8 prose-p:my-5 prose-p:leading-relaxed prose-ul:my-5 prose-ul:space-y-2 prose-ol:my-5 prose-ol:space-y-2 prose-li:my-1 prose-a:text-amber-400 prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-white/10">
            {post.tags.map((tag) => (
              <span key={tag} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/60">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      <PublicFooter />
    </div>
  );
};

export default BlogPostPage;
