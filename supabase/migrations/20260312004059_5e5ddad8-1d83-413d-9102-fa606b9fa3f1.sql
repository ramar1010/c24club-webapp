
-- Add ad_points to member_minutes
ALTER TABLE public.member_minutes ADD COLUMN ad_points integer NOT NULL DEFAULT 0;

-- Add url_text and is_active to promos
ALTER TABLE public.promos ADD COLUMN url_text text DEFAULT 'Join Now';
ALTER TABLE public.promos ADD COLUMN is_active boolean DEFAULT true;

-- Create promo_templates table
CREATE TABLE public.promo_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text,
  description text,
  url text,
  url_text text DEFAULT 'Join Now',
  image_url text,
  country text,
  interest text,
  gender text,
  sameuser boolean DEFAULT false,
  ad_points_balance integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates" ON public.promo_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create promo_analytics table
CREATE TABLE public.promo_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_id uuid NOT NULL REFERENCES public.promos(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  watch_time_seconds integer NOT NULL DEFAULT 0,
  paused boolean NOT NULL DEFAULT false,
  link_clicked boolean NOT NULL DEFAULT false
);

ALTER TABLE public.promo_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Promo owners can read own analytics" ON public.promo_analytics
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.promos WHERE promos.id = promo_analytics.promo_id AND promos.member_id = auth.uid()));

CREATE POLICY "Users can insert analytics" ON public.promo_analytics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Admins can manage analytics" ON public.promo_analytics
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- Allow users to manage their own promos
CREATE POLICY "Users can manage own promos" ON public.promos
  FOR ALL TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

-- Allow any authenticated user to read active promos (for display between skips)
CREATE POLICY "Anyone can read active promos" ON public.promos
  FOR SELECT TO authenticated
  USING (is_active = true AND status = 'Active');

-- Storage bucket for promo images
INSERT INTO storage.buckets (id, name, public) VALUES ('promo-images', 'promo-images', true);

CREATE POLICY "Authenticated users can upload promo images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'promo-images');

CREATE POLICY "Anyone can view promo images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'promo-images');

CREATE POLICY "Users can delete own promo images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'promo-images' AND auth.uid()::text = (storage.foldername(name))[1]);
