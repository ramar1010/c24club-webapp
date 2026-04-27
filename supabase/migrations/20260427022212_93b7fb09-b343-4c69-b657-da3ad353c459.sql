ALTER TABLE public.user_bans
  ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_user_bans_active_expires
  ON public.user_bans (user_id, is_active, expires_at);

CREATE TABLE IF NOT EXISTS public.fast_skip_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  reported_user_id uuid NOT NULL,
  room_id text,
  skip_seconds numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fast_skip_reports_reported_recent
  ON public.fast_skip_reports (reported_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fast_skip_reports_pair
  ON public.fast_skip_reports (reporter_id, reported_user_id, created_at DESC);

ALTER TABLE public.fast_skip_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own fast skip reports"
  ON public.fast_skip_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can read own fast skip reports"
  ON public.fast_skip_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Admins can manage fast skip reports"
  ON public.fast_skip_reports
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));