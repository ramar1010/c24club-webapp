
CREATE OR REPLACE FUNCTION public.atomic_increment_minutes(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_total integer;
BEGIN
  UPDATE member_minutes
  SET total_minutes = total_minutes + p_amount,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING total_minutes INTO new_total;

  -- If no row existed, insert one
  IF new_total IS NULL THEN
    INSERT INTO member_minutes (user_id, total_minutes, updated_at)
    VALUES (p_user_id, GREATEST(0, p_amount), now())
    ON CONFLICT (user_id) DO UPDATE SET
      total_minutes = member_minutes.total_minutes + p_amount,
      updated_at = now()
    RETURNING total_minutes INTO new_total;
  END IF;

  -- Never go below 0
  IF new_total < 0 THEN
    UPDATE member_minutes SET total_minutes = 0 WHERE user_id = p_user_id;
    new_total := 0;
  END IF;

  RETURN new_total;
END;
$$;
