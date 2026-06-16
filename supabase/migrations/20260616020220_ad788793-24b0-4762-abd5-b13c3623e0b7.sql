
-- 1. Attribution table: last female who interacted with a male, within 7 days
CREATE TABLE public.bounty_attributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  male_id UUID NOT NULL,
  female_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('call','dm')),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (male_id, female_id)
);
CREATE INDEX idx_bounty_attr_male ON public.bounty_attributions (male_id, expires_at DESC);
GRANT SELECT ON public.bounty_attributions TO authenticated;
GRANT ALL ON public.bounty_attributions TO service_role;
ALTER TABLE public.bounty_attributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Females see own attributions" ON public.bounty_attributions
  FOR SELECT TO authenticated USING (auth.uid() = female_id);

-- 2. Earnings ledger
CREATE TABLE public.bounty_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  female_id UUID NOT NULL,
  male_id UUID NOT NULL,
  amount_cents INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('basic','premium','renewal','streak')),
  stripe_subscription_id TEXT,
  paid_out BOOLEAN NOT NULL DEFAULT false,
  cashout_request_id UUID,
  clawed_back BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bounty_earnings_female ON public.bounty_earnings (female_id, created_at DESC);
CREATE UNIQUE INDEX idx_bounty_earnings_unique_sub ON public.bounty_earnings (female_id, male_id, stripe_subscription_id, source)
  WHERE stripe_subscription_id IS NOT NULL;
GRANT SELECT ON public.bounty_earnings TO authenticated;
GRANT ALL ON public.bounty_earnings TO service_role;
ALTER TABLE public.bounty_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Females see own earnings" ON public.bounty_earnings
  FOR SELECT TO authenticated USING (auth.uid() = female_id);

-- 3. Record interaction (called from web + apps)
CREATE OR REPLACE FUNCTION public.record_bounty_interaction(
  p_male_id UUID,
  p_interaction_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_female_id UUID := auth.uid();
  v_female_gender TEXT;
  v_male_gender TEXT;
  v_male_is_vip BOOLEAN;
BEGIN
  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_interaction_type NOT IN ('call','dm') THEN
    RETURN jsonb_build_object('success', false, 'error', 'bad_type');
  END IF;

  SELECT lower(gender) INTO v_female_gender FROM members WHERE id = v_female_id;
  SELECT lower(gender) INTO v_male_gender FROM members WHERE id = p_male_id;

  IF v_female_gender <> 'female' OR v_male_gender <> 'male' THEN
    RETURN jsonb_build_object('success', false, 'error', 'gender_mismatch');
  END IF;

  -- Skip if male is already VIP
  SELECT (is_vip OR admin_granted_vip) INTO v_male_is_vip
  FROM member_minutes WHERE user_id = p_male_id;
  IF COALESCE(v_male_is_vip, false) THEN
    RETURN jsonb_build_object('success', true, 'skipped', 'already_vip');
  END IF;

  -- Last-touch wins: overwrite any other female's attribution for this male
  DELETE FROM bounty_attributions
    WHERE male_id = p_male_id AND female_id <> v_female_id;

  INSERT INTO bounty_attributions (male_id, female_id, interaction_type, last_interaction_at, expires_at)
  VALUES (p_male_id, v_female_id, p_interaction_type, now(), now() + interval '7 days')
  ON CONFLICT (male_id, female_id) DO UPDATE
    SET interaction_type = EXCLUDED.interaction_type,
        last_interaction_at = now(),
        expires_at = now() + interval '7 days';

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Award bounty (called by Stripe sync edge function when male subscribes)
CREATE OR REPLACE FUNCTION public.award_bounty_for_subscription(
  p_male_id UUID,
  p_tier TEXT,
  p_stripe_subscription_id TEXT,
  p_is_renewal BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_female_id UUID;
  v_amount_cents INTEGER;
  v_source TEXT;
  v_streak_count INTEGER;
  v_existing UUID;
BEGIN
  -- Find active attribution
  SELECT female_id INTO v_female_id
  FROM bounty_attributions
  WHERE male_id = p_male_id AND expires_at > now()
  ORDER BY last_interaction_at DESC
  LIMIT 1;

  IF v_female_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_attribution');
  END IF;

  IF p_is_renewal THEN
    v_amount_cents := 100; v_source := 'renewal';
  ELSIF p_tier = 'premium' THEN
    v_amount_cents := 249; v_source := 'premium';
  ELSIF p_tier = 'basic' THEN
    v_amount_cents := 75; v_source := 'basic';
  ELSE
    RETURN jsonb_build_object('success', false, 'reason', 'unknown_tier');
  END IF;

  -- Dedupe
  SELECT id INTO v_existing FROM bounty_earnings
  WHERE female_id = v_female_id AND male_id = p_male_id
    AND stripe_subscription_id = p_stripe_subscription_id AND source = v_source;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'already_awarded');
  END IF;

  INSERT INTO bounty_earnings (female_id, male_id, amount_cents, source, stripe_subscription_id)
  VALUES (v_female_id, p_male_id, v_amount_cents, v_source, p_stripe_subscription_id);

  -- Streak bonus: 3+ converts in rolling 7d (counts non-renewal only)
  SELECT COUNT(*) INTO v_streak_count
  FROM bounty_earnings
  WHERE female_id = v_female_id
    AND source IN ('basic','premium')
    AND created_at > now() - interval '7 days'
    AND clawed_back = false;

  IF v_streak_count = 3 THEN
    INSERT INTO bounty_earnings (female_id, male_id, amount_cents, source, stripe_subscription_id)
    VALUES (v_female_id, p_male_id, 500, 'streak', p_stripe_subscription_id || ':streak');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'female_id', v_female_id,
    'amount_cents', v_amount_cents,
    'streak_count', v_streak_count
  );
END;
$$;

-- 5. Bounty summary (called from earnings screen)
CREATE OR REPLACE FUNCTION public.get_bounty_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_pending INTEGER;
  v_lifetime INTEGER;
  v_streak INTEGER;
  v_recent JSONB;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('pending_cents',0,'lifetime_cents',0,'streak_count',0,'recent_converts','[]'::jsonb);
  END IF;

  SELECT COALESCE(SUM(amount_cents),0) INTO v_pending
  FROM bounty_earnings
  WHERE female_id = v_user AND paid_out = false AND clawed_back = false;

  SELECT COALESCE(SUM(amount_cents),0) INTO v_lifetime
  FROM bounty_earnings
  WHERE female_id = v_user AND clawed_back = false;

  SELECT COUNT(*) INTO v_streak
  FROM bounty_earnings
  WHERE female_id = v_user AND source IN ('basic','premium')
    AND created_at > now() - interval '7 days' AND clawed_back = false;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent FROM (
    SELECT be.amount_cents, be.source, be.created_at,
           m.name AS male_name, m.profile_picture_url AS male_avatar
    FROM bounty_earnings be
    LEFT JOIN members m ON m.id = be.male_id
    WHERE be.female_id = v_user AND be.clawed_back = false
    ORDER BY be.created_at DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'pending_cents', v_pending,
    'lifetime_cents', v_lifetime,
    'streak_count', v_streak,
    'streak_needed', GREATEST(0, 3 - v_streak),
    'recent_converts', v_recent
  );
END;
$$;

-- 6. Cashout for bounty earnings
CREATE OR REPLACE FUNCTION public.request_bounty_cashout(
  p_cents INTEGER,
  p_paypal_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_available INTEGER;
  v_weekly_paid INTEGER;
  v_req_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;
  IF p_cents < 500 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Minimum cashout is $5.00');
  END IF;
  IF p_paypal_email IS NULL OR length(trim(p_paypal_email)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PayPal email required');
  END IF;

  SELECT COALESCE(SUM(amount_cents),0) INTO v_available
  FROM bounty_earnings
  WHERE female_id = v_user AND paid_out = false AND clawed_back = false;

  IF v_available < p_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient bounty balance');
  END IF;

  SELECT COALESCE(SUM(cash_amount * 100)::INTEGER,0) INTO v_weekly_paid
  FROM cashout_requests
  WHERE user_id = v_user AND source = 'bounty'
    AND created_at > now() - interval '7 days';

  IF v_weekly_paid + p_cents > 50000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Weekly cashout limit ($500) reached');
  END IF;

  INSERT INTO cashout_requests (user_id, minutes_amount, paypal_email, cash_amount, status, source)
  VALUES (v_user, 0, trim(p_paypal_email), p_cents::NUMERIC / 100, 'pending', 'bounty')
  RETURNING id INTO v_req_id;

  UPDATE bounty_earnings
  SET paid_out = true, cashout_request_id = v_req_id
  WHERE female_id = v_user AND paid_out = false AND clawed_back = false;

  RETURN jsonb_build_object('success', true, 'cash_amount', p_cents::NUMERIC / 100);
END;
$$;
