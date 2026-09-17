-- Female-only cashout enforcement at the database level.
-- Mirrors the edge-function checks so no client path can create a cashout for a male member.
CREATE OR REPLACE FUNCTION public.enforce_female_only_cashout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gender text;
BEGIN
  SELECT lower(gender) INTO v_gender FROM public.members WHERE id = NEW.user_id;
  IF v_gender IS DISTINCT FROM 'female' THEN
    RAISE EXCEPTION 'Cash out is only available to female members';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_female_only_cashout ON public.cashout_requests;
CREATE TRIGGER trg_female_only_cashout
BEFORE INSERT ON public.cashout_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_female_only_cashout();