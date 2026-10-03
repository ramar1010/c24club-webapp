CREATE OR REPLACE FUNCTION public.notify_admin_new_cashout()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','net' AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-admin-cashout',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('record', jsonb_build_object('id', NEW.id))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Admin cashout email enqueue failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.notify_admin_new_cashout() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_notify_admin_new_cashout ON public.cashout_requests;
CREATE TRIGGER trg_notify_admin_new_cashout AFTER INSERT ON public.cashout_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admin_new_cashout();