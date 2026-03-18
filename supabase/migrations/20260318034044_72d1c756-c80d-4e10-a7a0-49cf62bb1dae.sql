-- Allow authenticated users to read members who have the admin role
-- This enables showing admin profiles in Discover even if not listed
CREATE POLICY "Users can read admin members"
ON public.members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = members.id
      AND user_roles.role = 'admin'::app_role
  )
);