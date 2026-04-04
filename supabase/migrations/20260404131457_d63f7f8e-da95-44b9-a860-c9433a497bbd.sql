CREATE POLICY "Moderators can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));