
CREATE OR REPLACE FUNCTION public.clear_duplicate_push_tokens()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.push_token IS NOT NULL AND NEW.push_token IS DISTINCT FROM OLD.push_token THEN
    UPDATE public.members
    SET push_token = NULL, notify_enabled = false
    WHERE push_token = NEW.push_token
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_clear_duplicate_push_tokens
  BEFORE UPDATE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.clear_duplicate_push_tokens();
