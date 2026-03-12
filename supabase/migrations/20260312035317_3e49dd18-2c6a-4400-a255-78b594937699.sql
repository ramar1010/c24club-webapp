
CREATE POLICY "Authenticated can read vip_settings get_gifted"
  ON public.vip_settings FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own vip_settings" ON public.vip_settings;
