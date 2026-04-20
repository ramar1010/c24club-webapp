
-- ============================================
-- FIX #1: Restrict user_roles SELECT to own role + admins
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read user_roles" ON public.user_roles;

-- Admins can read all role assignments (needed for AdminUserRolesPage)
CREATE POLICY "Admins can read all user_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- FIX #2: Enable RLS on male_search_batch_log
-- (Only used by SECURITY DEFINER functions, which bypass RLS)
-- ============================================
ALTER TABLE public.male_search_batch_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FIX #5: Set search_path on all public functions
-- ============================================
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.increment_male_search_count(uuid) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.notify_redemption_status_change() SET search_path = public;
ALTER FUNCTION public.notify_on_queue_join() SET search_path = public;
ALTER FUNCTION public.process_male_search_batch_notifications() SET search_path = public;
ALTER FUNCTION public.notify_dm_push() SET search_path = public;
ALTER FUNCTION public.is_blocked_by(uuid) SET search_path = public;
ALTER FUNCTION public.request_cashout(integer, text) SET search_path = public;

-- ============================================
-- FIX #6: Restrict storage SELECT policies on public buckets
-- to prevent listing (direct URL access still works)
-- ============================================
DROP POLICY IF EXISTS "Anyone can read blog images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view member photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view promo images" ON storage.objects;
-- Note: Public buckets still allow direct URL access via the bucket's public flag.
-- Removing these broad SELECT policies prevents authenticated/anon clients from
-- listing all files in the bucket via the storage API.
