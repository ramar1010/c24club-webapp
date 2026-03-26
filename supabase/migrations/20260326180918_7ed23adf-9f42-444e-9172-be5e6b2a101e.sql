
CREATE TABLE public.discover_profile_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id uuid NOT NULL,
  viewed_member_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_profile_views_viewed_member ON public.discover_profile_views (viewed_member_id);
CREATE INDEX idx_profile_views_created_at ON public.discover_profile_views (created_at);

ALTER TABLE public.discover_profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own views"
  ON public.discover_profile_views
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = viewer_id);

CREATE POLICY "Users can read views on own profile"
  ON public.discover_profile_views
  FOR SELECT TO authenticated
  USING (auth.uid() = viewed_member_id);

CREATE POLICY "Service role full access"
  ON public.discover_profile_views
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
