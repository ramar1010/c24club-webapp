CREATE INDEX IF NOT EXISTS idx_dm_messages_sender_id ON public.dm_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations(last_message_at DESC);

CREATE OR REPLACE FUNCTION public.get_female_earnings_digest()
RETURNS TABLE(
  female_id uuid,
  female_name text,
  yesterday_minutes integer,
  cashable_minutes integer,
  near_limit_count integer,
  near_limit_names text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH recent_pairs AS (
    SELECT f.id AS female_id,
           COALESCE(f.name, 'there') AS female_name,
           mm.id AS male_id,
           COALESCE(mm.name, 'A guy') AS male_name
    FROM public.conversations c
    JOIN public.members f ON f.id IN (c.participant_1, c.participant_2)
      AND lower(f.gender) = 'female'
      AND COALESCE(f.last_active_at, f.created_at) > now() - interval '14 days'
    JOIN public.members mm ON mm.id = (CASE WHEN c.participant_1 = f.id THEN c.participant_2 ELSE c.participant_1 END)
      AND lower(mm.gender) = 'male'
    LEFT JOIN public.member_minutes vip ON vip.user_id = mm.id
    WHERE c.last_message_at > now() - interval '7 days'
      AND COALESCE(vip.is_vip, false) = false
      AND COALESCE(vip.admin_granted_vip, false) = false
  ),
  scored AS (
    SELECT rp.*,
           (SELECT COUNT(*) FROM public.dm_messages m WHERE m.sender_id = rp.male_id) AS sent_total
    FROM recent_pairs rp
  ),
  near_limit AS (
    SELECT s.female_id,
           max(s.female_name) AS female_name,
           COUNT(DISTINCT s.male_id)::int AS cnt,
           (array_agg(DISTINCT s.male_name))[1:3] AS names
    FROM scored s
    WHERE s.sent_total BETWEEN 2 AND 3
    GROUP BY s.female_id
  ),
  yesterday AS (
    SELECT be.female_id, SUM(be.amount_minutes)::int AS mins
    FROM public.bounty_earnings be
    WHERE be.created_at >= (now() - interval '1 day')
      AND COALESCE(be.clawed_back, false) = false
    GROUP BY be.female_id
  ),
  targets AS (
    SELECT female_id FROM near_limit
    UNION
    SELECT female_id FROM yesterday WHERE female_id IS NOT NULL
  )
  SELECT t.female_id,
         COALESCE(nl.female_name, COALESCE(m.name, 'there')),
         COALESCE(y.mins, 0),
         COALESCE(bal.gifted_minutes, 0),
         COALESCE(nl.cnt, 0),
         COALESCE(nl.names, ARRAY[]::text[])
  FROM targets t
  JOIN public.members m ON m.id = t.female_id
  LEFT JOIN near_limit nl ON nl.female_id = t.female_id
  LEFT JOIN yesterday y ON y.female_id = t.female_id
  LEFT JOIN public.member_minutes bal ON bal.user_id = t.female_id;
$$;

REVOKE ALL ON FUNCTION public.get_female_earnings_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_female_earnings_digest() TO service_role;