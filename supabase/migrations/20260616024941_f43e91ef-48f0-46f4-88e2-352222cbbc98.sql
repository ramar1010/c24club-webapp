
ALTER TABLE public.cashout_requests ADD COLUMN IF NOT EXISTS notes text;

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
  WHERE user_id = auth.uid();

  IF v_gifted_balance < p_minutes_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient gifted minutes. You have ' || v_gifted_balance || ' available.');
  END IF;

  UPDATE public.member_minutes
  SET gifted_minutes = gifted_minutes - p_minutes_amount
  WHERE user_id = auth.uid();

  v_cash_amount := p_minutes_amount * v_rate;

  -- Build a breakdown note from recent bounty earnings (top 5 contributors)
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
      END AS source_label,
      '• Bounty: ' || SUM(be.amount_minutes) || ' min from ' || COALESCE(m.name, 'Unknown') || ' (' ||
        CASE
          WHEN BOOL_OR(be.source = 'premium') AND BOOL_OR(be.source = 'basic') THEN 'Basic+Premium VIP'
          WHEN BOOL_OR(be.source = 'premium') THEN 'Premium VIP'
          WHEN BOOL_OR(be.source = 'basic') THEN 'Basic VIP'
          WHEN BOOL_OR(be.source = 'renewal') THEN 'Renewal'
          WHEN BOOL_OR(be.source = 'streak') THEN 'Streak Bonus'
          ELSE 'Bounty'
        END || ')' AS line
    FROM public.bounty_earnings be
    LEFT JOIN public.members m ON m.id = be.male_id
    WHERE be.female_id = auth.uid() AND be.clawed_back = false
    GROUP BY m.name
    ORDER BY total_minutes DESC
    LIMIT 5
  ) sub;

  IF v_breakdown IS NULL OR length(v_breakdown) = 0 THEN
    v_notes := 'Gifted minutes balance cashout';
  ELSE
    v_notes := 'Sources (lifetime bounty totals):' || E'\n' || v_breakdown;
  END IF;

  INSERT INTO public.cashout_requests (user_id, minutes_amount, paypal_email, cash_amount, status, notes)
  VALUES (auth.uid(), p_minutes_amount, p_paypal_email, v_cash_amount, 'pending', v_notes);

  RETURN jsonb_build_object(
    'success', true,
    'minutes_cashed_out', p_minutes_amount,
    'cash_amount', v_cash_amount,
    'notes', v_notes
  );
END;
$function$;
