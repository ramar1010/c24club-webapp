CREATE OR REPLACE FUNCTION public.get_active_connected_profiles()
RETURNS TABLE (
  profile_id uuid,
  name text,
  image_url text,
  image_thumb_url text,
  gender text,
  last_active_at timestamptz,
  connection_expires_at timestamptz,
  connection_status text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_active_connected_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_connected_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_connected_profiles() TO service_role;