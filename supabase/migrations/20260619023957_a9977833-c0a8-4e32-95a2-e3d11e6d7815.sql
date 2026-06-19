REVOKE EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO service_role;