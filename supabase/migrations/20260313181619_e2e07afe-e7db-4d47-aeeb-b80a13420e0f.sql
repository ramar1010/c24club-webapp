CREATE POLICY "Users can update own shipping details"
ON public.member_redemptions
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());