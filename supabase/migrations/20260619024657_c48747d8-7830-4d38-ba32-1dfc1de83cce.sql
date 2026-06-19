GRANT SELECT, INSERT ON public.gift_transactions TO authenticated;
GRANT ALL ON public.gift_transactions TO service_role;

GRANT SELECT ON public.member_minutes TO authenticated;
GRANT ALL ON public.member_minutes TO service_role;

GRANT SELECT, INSERT ON public.iap_purchases TO authenticated;
GRANT ALL ON public.iap_purchases TO service_role;

GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.atomic_increment_minutes(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_minutes(uuid, integer) TO service_role;