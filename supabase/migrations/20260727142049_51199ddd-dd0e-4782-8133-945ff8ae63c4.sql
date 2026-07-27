CREATE POLICY "Admins and moderators view all bounty earnings"
ON public.bounty_earnings FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));