
CREATE POLICY "Authenticated can read is_vip status"
  ON public.member_minutes FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can read own minutes" ON public.member_minutes;
