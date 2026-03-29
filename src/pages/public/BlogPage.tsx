import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, Clock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PublicNav from "@/components/public/PublicNav";
import PublicFooter from "@/components/public/PublicFooter";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  category: string | null;
  published_at: string | null;
  content: string;
}

const BlogPage = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Blog — C24 Club | Tips, News & Rewards";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Read the latest tips, news, and guides from C24 Club. Learn how to earn more rewards, connect with friends, and make the most of video chatting.");
  }, []);

  useEffect(() => {
    const fetchPosts = async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, title, slug, excerpt, featured_image_url, author_name, category, published_at, content")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setPosts(data || []);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const estimateReadTime = (content: string) => {
    const words = content.split(/\s+/).length;
    return Math.max(1, Math.round(words / 200));
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white">
      <PublicNav />

      {/* Hero */}
      <section className="pt-28 pb-12 px-4 text-center">
        <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Antigone', sans-serif" }}>
          C24 Club Blog
        </h1>
        <p className="text-white/60 max-w-xl mx-auto text-lg">
          Tips, guides, and news to help you earn more rewards through video chatting.
        </p>
      </section>

      {/* Posts grid */}
      <section className="max-w-6xl mx-auto px-4 pb-20">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 rounded-2xl h-80 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-white/40">
            <p className="text-xl">No blog posts yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group bg-white/5 rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-300 flex flex-col"
              >
                {post.featured_image_url ? (
                  <img
                    src={post.featured_image_url}
                    alt={post.title}
                    className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-48 bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                    <span className="text-4xl">📝</span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  {post.category && (
                    <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                      {post.category}
                    </span>
                  )}
                  <h2 className="text-lg font-bold mb-2 group-hover:text-amber-400 transition-colors line-clamp-2">
                    {post.title}
                  </h2>
                  {post.excerpt && (
                    <p className="text-white/50 text-sm mb-4 line-clamp-3 flex-1">{post.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-white/40 mt-auto">
                    <div className="flex items-center gap-3">
                      {post.published_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(post.published_at), "MMM d, yyyy")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {estimateReadTime(post.content)} min read
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform text-amber-400" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <PublicFooter />
    </div>
  );
};

export default BlogPage;
