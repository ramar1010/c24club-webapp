CREATE TABLE public.vip_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  show_promo_ads BOOLEAN NOT NULL DEFAULT true,
  get_gifted BOOLEAN NOT NULL DEFAULT false,
  pinned_socials TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vip_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own vip_settings"
  ON public.vip_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own vip_settings"
  ON public.vip_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own vip_settings"
  ON public.vip_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);