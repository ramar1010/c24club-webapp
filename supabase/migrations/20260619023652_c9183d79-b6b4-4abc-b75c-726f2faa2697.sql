CREATE OR REPLACE FUNCTION public.atomic_increment_member_balances(
  p_user_id uuid,
  p_total_amount integer DEFAULT 0,
  p_gifted_amount integer DEFAULT 0
)
RETURNS TABLE(total_minutes integer, gifted_minutes integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.member_minutes (user_id, total_minutes, gifted_minutes, updated_at)
  VALUES (p_user_id, GREATEST(0, p_total_amount), GREATEST(0, p_gifted_amount), now())
  ON CONFLICT (user_id) DO UPDATE
  SET total_minutes = GREATEST(0, public.member_minutes.total_minutes + p_total_amount),
      gifted_minutes = GREATEST(0, public.member_minutes.gifted_minutes + p_gifted_amount),
      updated_at = now()
  RETURNING public.member_minutes.total_minutes, public.member_minutes.gifted_minutes
  INTO total_minutes, gifted_minutes;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_increment_member_balances(uuid, integer, integer) TO service_role;