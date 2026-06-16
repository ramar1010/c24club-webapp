CREATE OR REPLACE FUNCTION public.award_bounty_for_subscription(p_male_id uuid, p_tier text, p_stripe_subscription_id text, p_is_renewal boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_female_id UUID;
  v_minutes INTEGER;
  v_source TEXT;
  v_streak_count INTEGER;
  v_existing UUID;
BEGIN
  SELECT female_id INTO v_female_id
  FROM bounty_attributions
  WHERE male_id = p_male_id AND expires_at > now()
  ORDER BY last_interaction_at DESC
  LIMIT 1;

  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_attribution');
  END IF;

  IF p_is_renewal THEN
    v_minutes := 100; v_source := 'renewal';
  ELSIF p_tier = 'premium' THEN
    v_minutes := 249; v_source := 'premium';
  ELSIF p_tier = 'basic' THEN
    v_minutes := 75; v_source := 'basic';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'unknown_tier');
  END IF;

  SELECT id INTO v_existing FROM bounty_earnings
  WHERE female_id = v_female_id AND male_id = p_male_id
    AND stripe_subscription_id = p_stripe_subscription_id AND source = v_source;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  INSERT INTO bounty_earnings (female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out)
  VALUES (v_female_id, p_male_id, v_minutes, v_minutes, v_source, p_stripe_subscription_id, true);

  INSERT INTO member_minutes (user_id, gifted_minutes)
  VALUES (v_female_id, v_minutes)
  ON CONFLICT (user_id) DO UPDATE
    SET gifted_minutes = COALESCE(member_minutes.gifted_minutes, 0) + v_minutes,
        updated_at = now();

  SELECT COUNT(*) INTO v_streak_count
  FROM bounty_earnings
  WHERE female_id = v_female_id
    AND source IN ('basic','premium')
    AND created_at > now() - interval '7 days'
    AND clawed_back = false;

  IF v_streak_count = 3 THEN
    INSERT INTO bounty_earnings (female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out)
    VALUES (v_female_id, p_male_id, 500, 500, 'streak', p_stripe_subscription_id || ':streak', true);

    UPDATE member_minutes
    SET gifted_minutes = COALESCE(gifted_minutes, 0) + 500,
        updated_at = now()
    WHERE user_id = v_female_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'female_id', v_female_id,
    'minutes', v_minutes,
    'streak_count', v_streak_count
  );
END;
$function$;