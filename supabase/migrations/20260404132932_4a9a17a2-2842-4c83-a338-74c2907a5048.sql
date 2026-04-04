CREATE POLICY "Moderators can manage bans"
ON public.user_bans
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));