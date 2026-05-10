CREATE OR REPLACE FUNCTION public.get_partner_nsfw_strikes(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(nsfw_strikes, 0)::int FROM public.member_minutes WHERE user_id = _user_id LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_partner_nsfw_strikes(uuid) TO authenticated, anon;