
-- Blog posts table
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  excerpt text,
  content text NOT NULL,
  featured_image_url text,
  meta_title text,
  meta_description text,
  author_name text DEFAULT 'C24 Club',
  category text,
  tags text[] DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft',
  published_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read published posts (public blog)
CREATE POLICY "Anyone can read published posts"
ON public.blog_posts
FOR SELECT
TO anon, authenticated
USING (status = 'published');

-- Admins can manage all posts
CREATE POLICY "Admins can manage blog_posts"
ON public.blog_posts
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Auto-update updated_at
CREATE TRIGGER update_blog_posts_updated_at
  BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
