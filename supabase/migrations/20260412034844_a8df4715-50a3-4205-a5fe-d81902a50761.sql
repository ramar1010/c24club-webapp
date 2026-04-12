CREATE OR REPLACE FUNCTION public.notify_direct_call_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  service_key text;
  auth_key text;
BEGIN
  IF NEW.inviter_id IS NULL OR NEW.invitee_id IS NULL OR NEW.status IS DISTINCT FROM 'pending' THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret
    INTO service_key
    FROM vault.decrypted_secrets
    WHERE name IN ('SUPABASE_SERVICE_ROLE_KEY', 'service_role_key')
    ORDER BY CASE WHEN name = 'SUPABASE_SERVICE_ROLE_KEY' THEN 0 ELSE 1 END
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    service_key := NULL;
  END;

  auth_key := COALESCE(service_key, current_setting('app.settings.service_role_key', true));

  IF auth_key IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := 'https://ncpbiymnafxdfsvpxirb.supabase.co/functions/v1/notify-direct-call',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || auth_key
    ),
    body := jsonb_build_object(
      'inviterId', NEW.inviter_id::text,
      'inviteeId', NEW.invitee_id::text
    )
  );

  RETURN NEW;
END;
$$;