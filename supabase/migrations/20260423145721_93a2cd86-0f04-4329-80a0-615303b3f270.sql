CREATE POLICY "Users can view their own welcome DM log"
ON public.member_welcome_dm_log
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);