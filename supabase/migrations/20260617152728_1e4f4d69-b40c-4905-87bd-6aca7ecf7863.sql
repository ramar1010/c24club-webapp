CREATE OR REPLACE FUNCTION public.auto_award_bounty_from_member_minutes_vip()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gender TEXT;
  v_result JSONB;
  v_tier TEXT;
  v_was_vip BOOLEAN;
BEGIN
  -- Fire on both INSERT (first-ever member_minutes row created during purchase)
  -- and UPDATE (existing user upgrading to VIP).
  IF TG_OP = 'UPDATE' THEN
    v_was_vip := COALESCE(OLD.is_vip, false);
  ELSIF TG_OP = 'INSERT' THEN
    v_was_vip := false;
  ELSE
    RETURN NEW;
  END IF;

  -- Only fire when this change flips them into VIP.
  IF v_was_vip = true OR COALESCE(NEW.is_vip, false) <> true THEN
    RETURN NEW;
  END IF;

  SELECT lower(gender) INTO v_gender
  FROM public.members
  WHERE id = NEW.user_id;

  IF v_gender <> 'male' THEN
    RETURN NEW;
  END IF;

  v_tier := CASE
    WHEN lower(coalesce(NEW.vip_tier, '')) = 'premium' THEN 'premium'
    ELSE 'basic'
  END;

  SELECT public.award_bounty_for_subscription(
    NEW.user_id,
    v_tier,
    'member_minutes:auto_vip:' || NEW.user_id::text,
    false
  ) INTO v_result;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_award_bounty_member_minutes_vip ON public.member_minutes;
CREATE TRIGGER trg_auto_award_bounty_member_minutes_vip
AFTER INSERT OR UPDATE OF is_vip ON public.member_minutes
FOR EACH ROW
EXECUTE FUNCTION public.auto_award_bounty_from_member_minutes_vip();