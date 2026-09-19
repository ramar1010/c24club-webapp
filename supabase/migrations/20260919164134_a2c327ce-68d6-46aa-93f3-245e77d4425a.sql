GRANT SELECT ON public.call_minutes_log TO authenticated;
GRANT ALL ON public.call_minutes_log TO service_role;
ALTER TABLE public.call_minutes_log REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'call_minutes_log'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.call_minutes_log';
  END IF;
END
$$;