GRANT SELECT ON public.gift_transactions TO authenticated;
GRANT ALL ON public.gift_transactions TO service_role;
REVOKE ALL ON public.gift_transactions FROM anon;
ALTER TABLE public.gift_transactions REPLICA IDENTITY FULL;