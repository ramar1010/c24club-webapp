CREATE OR REPLACE FUNCTION public.get_bounty_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_lifetime_minutes INTEGER;
  v_streak INTEGER;
  v_recent JSONB;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('lifetime_minutes',0,'streak_count',0,'streak_needed',3,'recent_converts','[]'::jsonb);
  END IF;

  SELECT COALESCE(SUM(amount_minutes),0) INTO v_lifetime_minutes
  FROM bounty_earnings
  WHERE female_id = v_user AND clawed_back = false;

  SELECT COUNT(*) INTO v_streak
  FROM bounty_earnings
  WHERE female_id = v_user AND source IN ('basic','premium')
    AND created_at > now() - interval '7 days' AND clawed_back = false;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent FROM (
    SELECT be.amount_minutes, be.source, be.created_at,
           m.name AS male_name, COALESCE(m.image_thumb_url, m.image_url) AS male_avatar
    FROM bounty_earnings be
    LEFT JOIN members m ON m.id = be.male_id
    WHERE be.female_id = v_user AND be.clawed_back = false
    ORDER BY be.created_at DESC LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'lifetime_minutes', v_lifetime_minutes,
    'streak_count', v_streak,
    'streak_needed', GREATEST(0, 3 - v_streak),
    'recent_converts', v_recent
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_bounty_summary() TO authenticated;