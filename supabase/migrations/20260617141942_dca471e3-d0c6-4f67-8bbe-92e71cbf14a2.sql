GRANT SELECT ON public.bounty_earnings TO authenticated;
GRANT ALL ON public.bounty_earnings TO service_role;

GRANT SELECT ON public.members TO authenticated;
GRANT ALL ON public.members TO service_role;

GRANT EXECUTE ON FUNCTION public.get_bounty_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_bounty_interaction(uuid, text) TO authenticated;