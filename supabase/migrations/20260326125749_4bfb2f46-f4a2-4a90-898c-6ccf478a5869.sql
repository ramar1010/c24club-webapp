
-- Function to get all admin user IDs (returns only IDs, no sensitive data)
CREATE OR REPLACE FUNCTION public.get_admin_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'admin'
$$;

-- Function to get all moderator user IDs
CREATE OR REPLACE FUNCTION public.get_moderator_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM public.user_roles WHERE role = 'moderator'
$$;

-- Function to get all VIP user IDs
CREATE OR REPLACE FUNCTION public.get_vip_user_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT user_id FROM public.member_minutes WHERE is_vip = true
$$;
