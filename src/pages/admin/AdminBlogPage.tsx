import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Eye, EyeOff, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  status: string;
  category: string | null;
  published_at: string | null;
  created_at: string;
}

const AdminBlogPage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);

  const fetchPosts = async () => {
    const { data } = await supabase
      .from("blog_posts")
      .select("id, title, slug, status, category, published_at, created_at")
      .order("created_at", { ascending: false });
    setPosts(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchPosts(); }, []);

  const toggleStatus = async (post: BlogPost) => {
    const newStatus = post.status === "published" ? "draft" : "published";
    const updates: any = { status: newStatus };
    if (newStatus === "published" && !post.published_at) {
      updates.published_at = new Date().toISOString();
    }
    const { error } = await supabase.from("blog_posts").update(updates).eq("id", post.id);
    if (error) { toast.error("Failed to update"); return; }
    toast.success(newStatus === "published" ? "Post published!" : "Post unpublished");
    fetchPosts();
  };

  const deletePost = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    await supabase.from("blog_posts").delete().eq("id", id);
    toast.success("Post deleted");
    fetchPosts();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blog Posts</h1>
        <Button onClick={() => navigate("/admin/blog/new")} className="gap-2">
          <Plus className="w-4 h-4" /> New Post
        </Button>
      </div>

      <div className="bg-card rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Title</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Category</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium hidden md:table-cell">Date</th>
              <th className="text-right p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading...</td></tr>
            ) : posts.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No blog posts yet</td></tr>
            ) : posts.map((post) => (
              <tr key={post.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium max-w-[200px] truncate">{post.title}</td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">{post.category || "—"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${post.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                    {post.status}
                  </span>
                </td>
                <td className="p-3 hidden md:table-cell text-muted-foreground">
                  {format(new Date(post.published_at || post.created_at), "MMM d, yyyy")}
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(post)} title={post.status === "published" ? "Unpublish" : "Publish"}>
                      {post.status === "published" ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/blog/${post.id}/edit`)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePost(post.id)} className="text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminBlogPage;
