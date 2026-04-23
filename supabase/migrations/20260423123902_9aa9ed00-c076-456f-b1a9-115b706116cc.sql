
CREATE TABLE public.app_download_clicks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source TEXT NOT NULL DEFAULT 'popup',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.app_download_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own app_download_clicks"
ON public.app_download_clicks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own app_download_clicks"
ON public.app_download_clicks
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage app_download_clicks"
ON public.app_download_clicks
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_app_download_clicks_user_id ON public.app_download_clicks(user_id);
CREATE INDEX idx_app_download_clicks_created_at ON public.app_download_clicks(created_at DESC);
