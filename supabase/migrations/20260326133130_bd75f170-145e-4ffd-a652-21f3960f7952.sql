CREATE OR REPLACE FUNCTION public.is_user_vip(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (
      SELECT (is_vip OR admin_granted_vip)
      FROM public.member_minutes
      WHERE user_id = _user_id
      LIMIT 1
    ),
    false
  )
$$;