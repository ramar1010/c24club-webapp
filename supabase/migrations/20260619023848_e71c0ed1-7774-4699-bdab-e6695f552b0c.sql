GRANT SELECT, INSERT ON public.gift_transactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_transactions TO service_role;

GRANT SELECT ON public.member_minutes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_minutes TO service_role;

GRANT SELECT, INSERT ON public.iap_purchases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.iap_purchases TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.cashout_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashout_requests TO service_role;