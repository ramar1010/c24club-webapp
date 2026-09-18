
-- 1) Compatibility columns expected by the mobile client
ALTER TABLE public.bounty_attributions
  ADD COLUMN IF NOT EXISTS attribution_kind text
    GENERATED ALWAYS AS (interaction_type) STORED;

ALTER TABLE public.bounty_attributions
  ADD COLUMN IF NOT EXISTS bounty_awarded_at timestamptz;

-- 2) Backfill award timestamps from existing earnings (pair-scoped)
UPDATE public.bounty_attributions a
SET bounty_awarded_at = e.created_at
FROM (
  SELECT female_id, male_id, MIN(created_at) AS created_at
  FROM public.bounty_earnings
  WHERE clawed_back = false
  GROUP BY female_id, male_id
) e
WHERE a.bounty_awarded_at IS NULL
  AND a.female_id = e.female_id
  AND a.male_id = e.male_id
  AND e.created_at >= a.created_at;

-- 3) Indexes: pair-scoped + activity winner
CREATE UNIQUE INDEX IF NOT EXISTS idx_bounty_attr_pair
  ON public.bounty_attributions (male_id, female_id);

CREATE INDEX IF NOT EXISTS idx_bounty_attr_pending_winner
  ON public.bounty_attributions (male_id, last_interaction_at DESC)
  WHERE bounty_awarded_at IS NULL;

-- 4) Award function: stamp bounty_awarded_at on the winning pair
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
    AND a.bounty_awarded_at IS NULL
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

  UPDATE public.bounty_attributions
    SET bounty_awarded_at = now()
    WHERE male_id = p_male_id
      AND female_id = v_female_id
      AND bounty_awarded_at IS NULL;

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

-- 5) Connected profiles: exclude awarded links via the new column too
CREATE OR REPLACE FUNCTION public.get_active_connected_profiles()
 RETURNS TABLE(profile_id uuid, name text, image_url text, image_thumb_url text, gender text, last_active_at timestamp with time zone, connection_expires_at timestamp with time zone, connection_status text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT
    m.id,
    m.name,
    m.image_url,
    m.image_thumb_url,
    m.gender,
    m.last_active_at,
    a.expires_at,
    'active'::text
  FROM public.bounty_attributions a
  JOIN public.members m ON m.id = a.male_id
  WHERE a.female_id = auth.uid()
    AND a.expires_at > now()
    AND a.bounty_awarded_at IS NULL
    AND m.image_status = 'approved'
    AND m.image_url IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_bans b
      WHERE b.user_id = m.id AND b.is_active = true
        AND (b.expires_at IS NULL OR b.expires_at > now())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.blocked_users bu
      WHERE (bu.blocker_id = auth.uid() AND bu.blocked_id = m.id)
         OR (bu.blocker_id = m.id AND bu.blocked_id = auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.bounty_earnings e
      WHERE e.female_id = a.female_id
        AND e.male_id = a.male_id
        AND e.created_at >= a.created_at
    )
  ORDER BY a.last_interaction_at DESC;
$function$;

-- 6) Grants / RLS remain: females read their own rows only, no client writes
GRANT SELECT ON public.bounty_attributions TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.bounty_attributions FROM authenticated, anon;
GRANT ALL ON public.bounty_attributions TO service_role;
