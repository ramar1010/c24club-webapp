-- Allow any authenticated user to read any member row.
-- The old narrow policies (admin-only, discoverable-only) broke DMs, video calls, gifts, etc.

DROP POLICY IF EXISTS "Users can read admin members" ON public.members;
DROP POLICY IF EXISTS "Users can read discoverable members" ON public.members;
DROP POLICY IF EXISTS "Users can read own member" ON public.members;

CREATE POLICY "Authenticated can read all members"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (true);