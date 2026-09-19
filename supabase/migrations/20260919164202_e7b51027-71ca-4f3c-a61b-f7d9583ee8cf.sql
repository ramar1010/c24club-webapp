REVOKE ALL ON public.call_minutes_log FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.call_minutes_log FROM authenticated;
GRANT SELECT ON public.call_minutes_log TO authenticated;
GRANT ALL ON public.call_minutes_log TO service_role;