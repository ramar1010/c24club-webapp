DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT jobid, jobname FROM cron.job
    WHERE command ILIKE '%send-sms-reminder%'
       OR command ILIKE '%power-hour-email%'
  LOOP
    PERFORM cron.unschedule(r.jobid);
    RAISE NOTICE 'Unscheduled cron job % (%)', r.jobname, r.jobid;
  END LOOP;
END $$;