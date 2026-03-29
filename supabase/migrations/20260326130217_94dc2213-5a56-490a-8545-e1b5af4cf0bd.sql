
-- Fix: The "Users can read admin members" policy on members table 
-- uses a subquery on user_roles which non-admin users can no longer access.
-- Replace with a policy that uses the security definer function.

DROP POLICY IF EXISTS "Users can read admin members" ON public.members;

CREATE POLICY "Users can read admin members"
  ON public.members
  FOR SELECT
  TO authenticated
  USING (has_role(id, 'admin'::app_role));
