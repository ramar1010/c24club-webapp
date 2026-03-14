CREATE POLICY "Users can insert own member"
ON public.members
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());