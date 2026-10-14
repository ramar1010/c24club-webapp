CREATE OR REPLACE FUNCTION public.enforce_paid_private_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  g_inviter text; g_invitee text; payer uuid; bal integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT (NEW.status IN ('accepted','matched') AND OLD.status IS DISTINCT FROM NEW.status) THEN
      RETURN NEW;
    END IF;
  ELSIF NEW.status NOT IN ('pending','accepted','matched') THEN
    RETURN NEW;
  END IF;

  SELECT lower(gender) INTO g_inviter FROM members WHERE id = NEW.inviter_id;
  SELECT lower(gender) INTO g_invitee FROM members WHERE id = NEW.invitee_id;

  IF g_inviter = 'male' AND g_invitee = 'female' THEN payer := NEW.inviter_id;
  ELSIF g_invitee = 'male' AND g_inviter = 'female' THEN payer := NEW.invitee_id;
  ELSE RETURN NEW;
  END IF;

  SELECT COALESCE(recharge_minutes, 0) INTO bal FROM member_minutes WHERE user_id = payer;
  IF COALESCE(bal, 0) <= 0 THEN
    RAISE EXCEPTION 'no_call_minutes: The guy needs call minutes to start a private call.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_paid_private_call ON public.direct_call_invites;
CREATE TRIGGER trg_enforce_paid_private_call
BEFORE INSERT OR UPDATE OF status ON public.direct_call_invites
FOR EACH ROW EXECUTE FUNCTION public.enforce_paid_private_call();