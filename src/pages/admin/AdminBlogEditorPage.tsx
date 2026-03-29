import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const AdminBlogEditorPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    featured_image_url: "",
    meta_title: "",
    meta_description: "",
    author_name: "C24 Club",
    category: "",
    tags: "",
    status: "draft",
  });

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      const { data } = await supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
      if (data) {
        setForm({
          title: data.title || "",
          slug: data.slug || "",
          excerpt: data.excerpt || "",
          content: data.content || "",
          featured_image_url: data.featured_image_url || "",
          meta_title: data.meta_title || "",
          meta_description: data.meta_description || "",
          author_name: data.author_name || "C24 Club",
          category: data.category || "",
          tags: (data.tags || []).join(", "),
          status: data.status || "draft",
        });
      }
    };
    fetch();
  }, [id]);

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleTitleChange = (title: string) => {
    setForm((f) => ({
      ...f,
      title,
      slug: isEditing ? f.slug : generateSlug(title),
      meta_title: f.meta_title || title,
    }));
  };

  const handleSave = async () => {
    if (!form.title || !form.content) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);

    const payload = {
      title: form.title,
      slug: form.slug || generateSlug(form.title),
      excerpt: form.excerpt || null,
      content: form.content,
      featured_image_url: form.featured_image_url || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      author_name: form.author_name || "C24 Club",
      category: form.category || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      status: form.status,
      ...(form.status === "published" ? { published_at: new Date().toISOString() } : {}),
    };

    let error;
    if (isEditing) {
      ({ error } = await supabase.from("blog_posts").update(payload).eq("id", id));
    } else {
      ({ error } = await supabase.from("blog_posts").insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isEditing ? "Post updated!" : "Post created!");
    navigate("/admin/blog");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/blog")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">{isEditing ? "Edit Post" : "New Blog Post"}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Post title" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="post-url-slug" />
          </div>
          <div>
            <Label>Excerpt</Label>
            <Textarea value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} placeholder="Brief summary for listings" rows={2} />
          </div>
          <div>
            <Label>Content * (HTML supported)</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Write your blog post content here... HTML tags are supported." rows={16} className="font-mono text-sm" />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border p-4 space-y-4">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Tips, News" />
            </div>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="rewards, video-chat, tips" />
            </div>
            <div>
              <Label>Author</Label>
              <Input value={form.author_name} onChange={(e) => setForm({ ...form, author_name: e.target.value })} />
            </div>
            <div>
              <Label>Featured Image URL</Label>
              <Input value={form.featured_image_url} onChange={(e) => setForm({ ...form, featured_image_url: e.target.value })} placeholder="https://..." />
            </div>
          </div>

          <div className="bg-card rounded-xl border p-4 space-y-4">
            <h3 className="font-semibold text-sm">SEO Settings</h3>
            <div>
              <Label>Meta Title</Label>
              <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Custom title for search engines" />
              <p className="text-xs text-muted-foreground mt-1">{form.meta_title.length}/60 chars</p>
            </div>
            <div>
              <Label>Meta Description</Label>
              <Textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="Custom description for search engines" rows={3} />
              <p className="text-xs text-muted-foreground mt-1">{form.meta_description.length}/160 chars</p>
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Post"}
          </Button>

          {isEditing && (
            <Button variant="outline" className="w-full gap-2" onClick={() => window.open(`/blog/${form.slug}`, "_blank")}>
              <Eye className="w-4 h-4" /> Preview
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBlogEditorPage;
