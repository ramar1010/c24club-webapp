
-- Fix 1: sms_campaign_sends - Remove overly permissive anon policies
-- The track-sms-click edge function uses service_role key, so it bypasses RLS.
-- Admin dashboard queries use authenticated admin role.
DROP POLICY IF EXISTS "Anon can read sends by tracking_code" ON public.sms_campaign_sends;
DROP POLICY IF EXISTS "Anon can update clicked_at by tracking_code" ON public.sms_campaign_sends;

-- No anon policies needed since edge functions use service_role key.
-- Admin access is already covered by existing admin policies.

-- Fix 2: user_roles - Remove overly permissive SELECT policy
-- The "Users can read own role" policy already exists and is sufficient.
DROP POLICY IF EXISTS "Authenticated can read user_roles" ON public.user_roles;
