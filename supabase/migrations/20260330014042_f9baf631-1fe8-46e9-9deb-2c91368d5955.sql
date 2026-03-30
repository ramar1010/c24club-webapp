CREATE POLICY "Admins can manage vip_settings"
ON public.vip_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role))