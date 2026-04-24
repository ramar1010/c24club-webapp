ALTER TABLE public.member_minutes ADD COLUMN IF NOT EXISTS welcome_bonus_calls_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.claim_welcome_bonus(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_bonus integer;
  v_new_total integer;
BEGIN
  -- Atomically read & increment only if count < 3
  UPDATE public.member_minutes
  SET welcome_bonus_calls_count = welcome_bonus_calls_count + 1,
      updated_at = now()
  WHERE user_id = p_user_id
    AND welcome_bonus_calls_count < 3
  RETURNING welcome_bonus_calls_count INTO v_count;

  IF v_count IS NULL THEN
    -- Either no row or already used all 3
    INSERT INTO public.member_minutes (user_id, welcome_bonus_calls_count, total_minutes)
    VALUES (p_user_id, 1, 0)
    ON CONFLICT (user_id) DO NOTHING
    RETURNING welcome_bonus_calls_count INTO v_count;
    IF v_count IS NULL THEN
      RETURN jsonb_build_object('success', false, 'reason', 'exhausted');
    END IF;
  END IF;

  -- Map count → bonus: 1st call=50, 2nd=25, 3rd=10
  v_bonus := CASE v_count
    WHEN 1 THEN 50
    WHEN 2 THEN 25
    WHEN 3 THEN 10
    ELSE 0
  END;

  IF v_bonus = 0 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'exhausted');
  END IF;

  -- Credit bonus minutes
  v_new_total := public.atomic_increment_minutes(p_user_id, v_bonus);

  RETURN jsonb_build_object(
    'success', true,
    'bonus', v_bonus,
    'callNumber', v_count,
    'totalMinutes', v_new_total
  );
END;
$$;