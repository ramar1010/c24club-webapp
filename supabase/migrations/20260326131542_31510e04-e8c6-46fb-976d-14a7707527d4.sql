-- Allow authenticated users to read user_roles so badges (Owner/VIP/Mod) work in DMs and Discover.
-- The table only contains user_id and role - no sensitive data.
CREATE POLICY "Authenticated can read user_roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);