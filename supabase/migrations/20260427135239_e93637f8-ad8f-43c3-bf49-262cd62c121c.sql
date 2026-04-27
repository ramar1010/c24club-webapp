
-- 1. Add source column to cashout_requests so we can distinguish retention payouts
ALTER TABLE public.cashout_requests
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'gifted_minutes';

-- 2. Female retention progress tracker
CREATE TABLE IF NOT EXISTS public.female_retention_progress (
  user_id UUID PRIMARY KEY,
  current_cents INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  day_qualifying_seconds INTEGER NOT NULL DEFAULT 0,
  day_completed BOOLEAN NOT NULL DEFAULT false,
  total_lifetime_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.female_retention_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own retention progress"
  ON public.female_retention_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own retention progress"
  ON public.female_retention_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own retention progress"
  ON public.female_retention_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage retention progress"
  ON public.female_retention_progress FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_female_retention_progress_updated_at
  BEFORE UPDATE ON public.female_retention_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. RPC to add seconds + cents with rolling 24h reset logic
-- p_state: 'waiting' (5¢/min = ~0.0833¢/sec) or 'connected_male' (15¢/min = 0.25¢/sec)
-- We accumulate as fractional via integer math: store cents as integer.
-- Caller passes seconds elapsed and state; we compute cents added.
CREATE OR REPLACE FUNCTION public.add_female_retention_seconds(
  p_seconds INTEGER,
  p_state TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.female_retention_progress%ROWTYPE;
  v_now TIMESTAMPTZ := now();
  v_cents_per_sec_x1000 INTEGER; -- cents * 1000 per second to avoid float
  v_cents_added INTEGER;
  v_should_reset BOOLEAN := false;
  v_min_daily_seconds INTEGER := 600; -- 10 minutes
BEGIN
  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 120 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid seconds');
  END IF;

  -- Rate: waiting = 5¢/60s ≈ 0.0833¢/s → store ×1000 = 83
  --       connected_male = 15¢/60s = 0.25¢/s → store ×1000 = 250
  IF p_state = 'connected_male' THEN
    v_cents_per_sec_x1000 := 250;
  ELSIF p_state = 'waiting' THEN
    v_cents_per_sec_x1000 := 83;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'invalid state');
  END IF;

  -- Get or create row
  SELECT * INTO v_row FROM public.female_retention_progress WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.female_retention_progress (user_id, last_activity_at, day_started_at)
    VALUES (auth.uid(), v_now, v_now)
    RETURNING * INTO v_row;
  END IF;

  -- Reset check: if >24h since last_activity AND user did NOT complete previous day (≥10 min), reset bar.
  -- If they DID complete the previous day, we extend the streak (bar stays).
  IF v_now - v_row.last_activity_at > INTERVAL '24 hours' THEN
    IF NOT v_row.day_completed THEN
      v_should_reset := true;
    END IF;
    -- Start a fresh day window either way
    v_row.day_started_at := v_now;
    v_row.day_qualifying_seconds := 0;
    v_row.day_completed := false;
  END IF;

  IF v_should_reset THEN
    v_row.current_cents := 0;
  END IF;

  -- Compute cents added (integer math)
  v_cents_added := (p_seconds * v_cents_per_sec_x1000) / 1000;

  v_row.current_cents := LEAST(v_row.current_cents + v_cents_added, 10000); -- cap at $100
  v_row.day_qualifying_seconds := v_row.day_qualifying_seconds + p_seconds;
  v_row.last_activity_at := v_now;

  IF v_row.day_qualifying_seconds >= v_min_daily_seconds THEN
    v_row.day_completed := true;
  END IF;

  v_row.total_lifetime_cents := v_row.total_lifetime_cents + v_cents_added;

  UPDATE public.female_retention_progress
  SET current_cents = v_row.current_cents,
      last_activity_at = v_row.last_activity_at,
      day_started_at = v_row.day_started_at,
      day_qualifying_seconds = v_row.day_qualifying_seconds,
      day_completed = v_row.day_completed,
      total_lifetime_cents = v_row.total_lifetime_cents
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object(
    'success', true,
    'current_cents', v_row.current_cents,
    'day_qualifying_seconds', v_row.day_qualifying_seconds,
    'day_completed', v_row.day_completed,
    'was_reset', v_should_reset
  );
END;
$$;

-- 4. RPC to cash out a milestone amount
CREATE OR REPLACE FUNCTION public.request_female_retention_cashout(
  p_cents INTEGER,
  p_paypal_email TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.female_retention_progress%ROWTYPE;
  v_has_pending BOOLEAN;
  v_cash_amount NUMERIC;
  v_valid_milestones INTEGER[] := ARRAY[500, 1000, 2000, 3000, 4000, 5000, 10000];
BEGIN
  IF p_paypal_email IS NULL OR length(trim(p_paypal_email)) < 5 THEN
    RETURN jsonb_build_object('success', false, 'error', 'PayPal email required');
  END IF;

  IF NOT (p_cents = ANY(v_valid_milestones)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid milestone amount');
  END IF;

  -- Pending check (only retention pending — gifted_minutes pending is independent)
  SELECT EXISTS (
    SELECT 1 FROM public.cashout_requests
    WHERE user_id = auth.uid()
      AND status = 'pending'
      AND source = 'female_retention'
  ) INTO v_has_pending;

  IF v_has_pending THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending payout. Wait until it''s processed.');
  END IF;

  SELECT * INTO v_row FROM public.female_retention_progress WHERE user_id = auth.uid();
  IF NOT FOUND OR v_row.current_cents < p_cents THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not enough progress to cash out this amount');
  END IF;

  v_cash_amount := p_cents::NUMERIC / 100;

  -- Reset the bar to 0 (full reset, regardless of milestone)
  UPDATE public.female_retention_progress
  SET current_cents = 0,
      updated_at = now()
  WHERE user_id = auth.uid();

  -- Insert cashout request. minutes_amount is required NOT NULL, so we store 0.
  INSERT INTO public.cashout_requests (user_id, minutes_amount, paypal_email, cash_amount, status, source)
  VALUES (auth.uid(), 0, trim(p_paypal_email), v_cash_amount, 'pending', 'female_retention');

  RETURN jsonb_build_object(
    'success', true,
    'cash_amount', v_cash_amount,
    'paypal_email', trim(p_paypal_email)
  );
END;
$$;
