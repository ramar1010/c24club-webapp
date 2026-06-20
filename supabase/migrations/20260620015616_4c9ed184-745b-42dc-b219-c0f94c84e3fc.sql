CREATE OR REPLACE FUNCTION public.notify_bounty_earning_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-bounty',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jcGJpeW1uYWZ4ZGZzdnB4aXJiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNDY0MjgsImV4cCI6MjA4ODgyMjQyOH0.gMgtPIrRCFfHC7yaUSxajl-uTrXIh2GYvaVgs1SXFfA'
    ),
    body := jsonb_build_object('bounty_earning_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_bounty_earning_created failed for bounty %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bounty_earning_created ON public.bounty_earnings;
CREATE TRIGGER trg_notify_bounty_earning_created
AFTER INSERT ON public.bounty_earnings
FOR EACH ROW
EXECUTE FUNCTION public.notify_bounty_earning_created();