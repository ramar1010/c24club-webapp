-- 1) Atomic reset on successful, minutes-costing redemptions (all reward/product/giftcard/spin paths)
CREATE OR REPLACE FUNCTION public.reset_female_call_earned_on_redemption()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only successful redemptions that actually cost minutes
  IF COALESCE(NEW.minutes_cost, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.status, '') IN ('cancelled', 'rejected', 'failed', 'out_of_stock') THEN
    RETURN NEW;
  END IF;

  -- Female users only
  IF NOT EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = NEW.user_id AND lower(m.gender) = 'female'
  ) THEN
    RETURN NEW;
  END IF;

  UPDATE public.member_minutes
  SET call_earned_minutes = 0,
      updated_at = now()
  WHERE user_id = NEW.user_id
    AND COALESCE(call_earned_minutes, 0) <> 0;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_female_call_earned_on_redemption ON public.member_redemptions;
CREATE TRIGGER trg_reset_female_call_earned_on_redemption
AFTER INSERT ON public.member_redemptions
FOR EACH ROW EXECUTE FUNCTION public.reset_female_call_earned_on_redemption();

-- 2) Reset on successful PayPal cashout, inside the same request_cashout transaction
CREATE OR REPLACE FUNCTION public.request_cashout(p_minutes_amount integer, p_paypal_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gifted_balance float8;
  v_min_cashout integer;
  v_max_cashout integer;
  v_rate float8;
  v_cash_amount float8;
  v_has_pending boolean;
  v_notes text;
  v_breakdown text;
BEGIN
  SELECT
    COALESCE(min_cashout_minutes, 100),
    COALESCE(max_cashout_minutes, 5000),
    COALESCE(rate_per_minute, 0.02)
  INTO v_min_cashout, v_max_cashout, v_rate
  FROM public.cashout_settings
  LIMIT 1;

  IF p_minutes_amount < v_min_cashout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum cashout is ' || v_min_cashout || ' gifted minutes');
  END IF;
  IF p_minutes_amount > v_max_cashout THEN
    RETURN jsonb_build_object('success', false, 'error', 'Maximum cashout is ' || v_max_cashout || ' gifted minutes');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.cashout_requests
    WHERE user_id = auth.uid() AND status = 'pending'
  ) INTO v_has_pending;

  IF v_has_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending cashout request');
  END IF;

  SELECT COALESCE(gifted_minutes, 0)
  INTO v_gifted_balance
  FROM public.member_minutes
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF v_gifted_balance < p_minutes_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient gifted minutes. You have ' || v_gifted_balance || ' available.');
  END IF;

  UPDATE public.member_minutes
  SET gifted_minutes = gifted_minutes - p_minutes_amount
  WHERE user_id = auth.uid();

  v_cash_amount := p_minutes_amount * v_rate;

  SELECT string_agg(
    line, E'\n' ORDER BY total_minutes DESC
  ) INTO v_breakdown
  FROM (
    SELECT
      COALESCE(m.name, 'Unknown') AS male_name,
      SUM(be.amount_minutes) AS total_minutes,
      CASE
        WHEN BOOL_OR(be.source = 'premium') AND BOOL_OR(be.source = 'basic') THEN 'Basic+Premium VIP'
        WHEN BOOL_OR(be.source = 'premium') THEN 'Premium VIP'
        WHEN BOOL_OR(be.source = 'basic') THEN 'Basic VIP'
        WHEN BOOL_OR(be.source = 'renewal') THEN 'Renewal'
        WHEN BOOL_OR(be.source = 'streak') THEN 'Streak Bonus'
        ELSE 'Bounty'
      END AS src,
      COALESCE(m.name, 'Unknown') || ' — ' || SUM(be.amount_minutes) || ' min' AS line
    FROM public.bounty_earnings be
    LEFT JOIN public.members m ON m.id = be.male_id
    WHERE be.female_id = auth.uid()
      AND COALESCE(be.clawed_back, false) = false
    GROUP BY m.name
    LIMIT 5
  ) sub;

  v_notes := CASE WHEN v_breakdown IS NULL THEN NULL ELSE 'Earnings breakdown:' || E'\n' || v_breakdown END;

  INSERT INTO public.cashout_requests (user_id, minutes_amount, cash_amount, paypal_email, status, notes)
  VALUES (auth.uid(), p_minutes_amount, v_cash_amount, p_paypal_email, 'pending', v_notes);

  -- Reset accumulated call-earned minutes for female users only
  UPDATE public.member_minutes mm
  SET call_earned_minutes = 0,
      updated_at = now()
  WHERE mm.user_id = auth.uid()
    AND COALESCE(mm.call_earned_minutes, 0) <> 0
    AND EXISTS (
      SELECT 1 FROM public.members m
      WHERE m.id = auth.uid() AND lower(m.gender) = 'female'
    );

  RETURN jsonb_build_object(
    'success', true,
    'minutes_cashed_out', p_minutes_amount,
    'cash_amount', v_cash_amount,
    'paypal_email', p_paypal_email,
    'call_earned_minutes', COALESCE((SELECT call_earned_minutes FROM public.member_minutes WHERE user_id = auth.uid()), 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.request_cashout(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_cashout(integer, text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.reset_female_call_earned_on_redemption() FROM PUBLIC, anon;