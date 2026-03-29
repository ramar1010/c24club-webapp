
CREATE POLICY "Admins can manage member_minutes"
  ON public.member_minutes
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
