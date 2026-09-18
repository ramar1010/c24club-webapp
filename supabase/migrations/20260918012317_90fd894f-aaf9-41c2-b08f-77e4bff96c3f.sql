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
  v_inserted INTEGER;
BEGIN
  IF p_is_renewal THEN
    RETURN jsonb_build_object('success', false, 'reason', 'renewal_no_bounty');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('vip_bounty:' || p_male_id::text));

  SELECT a.female_id INTO v_female_id
  FROM public.bounty_attributions a
  JOIN public.members f ON f.id = a.female_id
  WHERE a.male_id = p_male_id
    AND a.expires_at > now()
    AND COALESCE(f.last_active_at, f.created_at) > now() - interval '7 days'
  ORDER BY a.last_interaction_at DESC, a.created_at DESC
  LIMIT 1
  FOR UPDATE OF a;

  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_active_attribution');
  END IF;

  IF lower(coalesce(p_tier, '')) = 'premium' THEN
    v_minutes := 500;
    v_source := 'premium';
  ELSIF lower(coalesce(p_tier, '')) = 'basic' THEN
    v_minutes := 125;
    v_source := 'basic';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'unknown_tier');
  END IF;

  INSERT INTO public.vip_bounty_payout_claims (male_id, female_id)
  VALUES (p_male_id, v_female_id)
  ON CONFLICT (male_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  INSERT INTO public.bounty_earnings (
    female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out
  )
  VALUES (v_female_id, p_male_id, v_minutes, v_minutes, v_source, p_stripe_subscription_id, true);

  INSERT INTO public.member_minutes (user_id, gifted_minutes)
  VALUES (v_female_id, v_minutes)
  ON CONFLICT (user_id) DO UPDATE
    SET gifted_minutes = COALESCE(public.member_minutes.gifted_minutes, 0) + v_minutes,
        updated_at = now();

  SELECT COUNT(*) INTO v_streak_count
  FROM public.bounty_earnings
  WHERE female_id = v_female_id
    AND source IN ('basic', 'premium')
    AND created_at > now() - interval '7 days'
    AND clawed_back = false;

  IF v_streak_count = 3 THEN
    INSERT INTO public.bounty_earnings (
      female_id, male_id, amount_cents, amount_minutes, source, stripe_subscription_id, paid_out
    )
    VALUES (v_female_id, p_male_id, 500, 500, 'streak', p_stripe_subscription_id || ':streak', true);

    UPDATE public.member_minutes
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

REVOKE EXECUTE ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_bounty_for_subscription(uuid, text, text, boolean) TO service_role;