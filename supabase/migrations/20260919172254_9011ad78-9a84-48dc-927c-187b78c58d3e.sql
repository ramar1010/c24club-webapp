REVOKE EXECUTE ON FUNCTION public.get_ready_to_chat_limits() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_ready_to_chat_limits() TO service_role;