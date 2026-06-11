ALTER TABLE public.app_download_clicks
  ADD COLUMN IF NOT EXISTS context text,
  ADD COLUMN IF NOT EXISTS clicked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dismissed_at timestamptz;

ALTER TABLE public.app_download_clicks ALTER COLUMN source DROP NOT NULL;

CREATE POLICY "Users can update own app_download_clicks"
  ON public.app_download_clicks
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);