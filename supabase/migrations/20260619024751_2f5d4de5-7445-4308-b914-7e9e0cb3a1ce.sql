CREATE OR REPLACE FUNCTION public.get_my_gift_history(p_direction text DEFAULT 'received')
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  sender_name text,
  sender_image_url text,
  recipient_name text,
  recipient_image_url text,
  minutes_amount integer,
  price_cents integer,
  status text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF lower(coalesce(p_direction, 'received')) NOT IN ('received', 'sent', 'all') THEN
    RAISE EXCEPTION 'Invalid gift history direction';
  END IF;

  RETURN QUERY
  SELECT
    gt.id,
    gt.sender_id,
    gt.recipient_id,
    sender.name AS sender_name,
    sender.image_url AS sender_image_url,
    recipient.name AS recipient_name,
    recipient.image_url AS recipient_image_url,
    gt.minutes_amount,
    gt.price_cents,
    gt.status,
    gt.created_at
  FROM public.gift_transactions gt
  LEFT JOIN public.members sender ON sender.id = gt.sender_id
  LEFT JOIN public.members recipient ON recipient.id = gt.recipient_id
  WHERE gt.status = 'completed'
    AND (
      (lower(coalesce(p_direction, 'received')) = 'received' AND gt.recipient_id = auth.uid())
      OR (lower(coalesce(p_direction, 'received')) = 'sent' AND gt.sender_id = auth.uid())
      OR (lower(coalesce(p_direction, 'received')) = 'all' AND (gt.recipient_id = auth.uid() OR gt.sender_id = auth.uid()))
    )
  ORDER BY gt.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_gift_history(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_gift_history(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_gift_history(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_gift_history(text) TO service_role;