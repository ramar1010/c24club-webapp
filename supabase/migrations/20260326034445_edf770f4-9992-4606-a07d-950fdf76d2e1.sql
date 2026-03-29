CREATE TABLE public.wishlist_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_minutes integer NOT NULL DEFAULT 400,
  max_minutes integer NOT NULL DEFAULT 800,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.wishlist_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage wishlist_settings" ON public.wishlist_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can read wishlist_settings" ON public.wishlist_settings
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.wishlist_settings (min_minutes, max_minutes) VALUES (200, 400);