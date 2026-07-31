-- 1. Digest data helper
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
  WITH females AS (
    SELECT m.id, COALESCE(m.name, 'there') AS name
    FROM public.members m
    WHERE lower(m.gender) = 'female'
      AND COALESCE(m.last_active_at, m.created_at) > now() - interval '14 days'
  ),
  male_usage AS (
    SELECT msg.sender_id AS male_id, COUNT(*)::int AS sent_count
    FROM public.dm_messages msg
    JOIN public.conversations c ON c.id = msg.conversation_id
    JOIN public.members partner
      ON partner.id = (CASE WHEN c.participant_1 = msg.sender_id THEN c.participant_2 ELSE c.participant_1 END)
    WHERE lower(partner.gender) = 'female'
    GROUP BY msg.sender_id
  ),
  near_limit AS (
    SELECT f.id AS female_id,
           COUNT(DISTINCT mm.id)::int AS cnt,
           (array_agg(DISTINCT COALESCE(mm.name, 'A guy')))[1:3] AS names
    FROM females f
    JOIN public.conversations c
      ON (c.participant_1 = f.id OR c.participant_2 = f.id)
    JOIN public.members mm
      ON mm.id = (CASE WHEN c.participant_1 = f.id THEN c.participant_2 ELSE c.participant_1 END)
    JOIN male_usage mu ON mu.male_id = mm.id
    LEFT JOIN public.member_minutes vip ON vip.user_id = mm.id
    WHERE lower(mm.gender) = 'male'
      AND mu.sent_count BETWEEN 2 AND 3
      AND COALESCE(vip.is_vip, false) = false
      AND COALESCE(vip.admin_granted_vip, false) = false
      AND c.last_message_at > now() - interval '7 days'
    GROUP BY f.id
  ),
  yesterday AS (
    SELECT be.female_id, SUM(be.amount_minutes)::int AS mins
    FROM public.bounty_earnings be
    WHERE be.created_at >= (now() - interval '1 day')
      AND COALESCE(be.clawed_back, false) = false
    GROUP BY be.female_id
  )
  SELECT f.id,
         f.name,
         COALESCE(y.mins, 0),
         COALESCE(bal.gifted_minutes, 0),
         COALESCE(nl.cnt, 0),
         COALESCE(nl.names, ARRAY[]::text[])
  FROM females f
  LEFT JOIN near_limit nl ON nl.female_id = f.id
  LEFT JOIN yesterday y ON y.female_id = f.id
  LEFT JOIN public.member_minutes bal ON bal.user_id = f.id
  WHERE COALESCE(nl.cnt, 0) > 0 OR COALESCE(y.mins, 0) > 0;
$$;

REVOKE ALL ON FUNCTION public.get_female_earnings_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_female_earnings_digest() TO service_role;

-- 2. Real-time "about to convert" alert
CREATE OR REPLACE FUNCTION public.notify_male_near_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id uuid := '6f8bb0e2-a36a-4bc0-920f-312c340f7921';
  v_p1 uuid; v_p2 uuid; v_female_id uuid;
  v_sender_gender text; v_recipient_gender text;
  v_is_vip boolean; v_sent_count int;
  v_sender_name text; v_push_token text; v_notify_enabled boolean;
  v_conv_id uuid;
BEGIN
  IF NEW.sender_id = owner_id THEN RETURN NEW; END IF;

  SELECT participant_1, participant_2 INTO v_p1, v_p2
  FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_female_id := CASE WHEN v_p1 = NEW.sender_id THEN v_p2 ELSE v_p1 END;

  SELECT lower(gender), COALESCE(name, 'A guy') INTO v_sender_gender, v_sender_name
  FROM members WHERE id = NEW.sender_id;
  SELECT lower(gender), push_token, notify_enabled
  INTO v_recipient_gender, v_push_token, v_notify_enabled
  FROM members WHERE id = v_female_id;

  IF v_sender_gender IS DISTINCT FROM 'male' OR v_recipient_gender IS DISTINCT FROM 'female' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(is_vip, false) OR COALESCE(admin_granted_vip, false) INTO v_is_vip
  FROM member_minutes WHERE user_id = NEW.sender_id;
  IF COALESCE(v_is_vip, false) THEN RETURN NEW; END IF;

  SELECT COUNT(*)::int INTO v_sent_count
  FROM dm_messages m
  JOIN conversations c ON c.id = m.conversation_id
  JOIN members partner ON partner.id = (CASE WHEN c.participant_1 = m.sender_id THEN c.participant_2 ELSE c.participant_1 END)
  WHERE m.sender_id = NEW.sender_id AND lower(partner.gender) = 'female';

  -- only fire once, when he has exactly 1 free message left
  IF v_sent_count <> 2 THEN RETURN NEW; END IF;

  -- system DM from owner
  SELECT id INTO v_conv_id FROM conversations
  WHERE (participant_1 = owner_id AND participant_2 = v_female_id)
     OR (participant_1 = v_female_id AND participant_2 = owner_id)
  LIMIT 1;

  IF v_conv_id IS NULL THEN
    INSERT INTO conversations (participant_1, participant_2)
    VALUES (owner_id, v_female_id) RETURNING id INTO v_conv_id;
  END IF;

  INSERT INTO dm_messages (conversation_id, sender_id, content)
  VALUES (
    v_conv_id, owner_id,
    '🔥 ' || v_sender_name || ' has only 1 free message left with you! If he wants to keep chatting he has to buy VIP — and you get paid when he does. Reply to him now to keep him hooked.'
  );

  UPDATE conversations SET last_message_at = now() WHERE id = v_conv_id;

  IF v_push_token IS NOT NULL AND COALESCE(v_notify_enabled, true) THEN
    PERFORM net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := jsonb_build_object(
        'to', v_push_token,
        'title', '💸 ' || v_sender_name || ' is about to convert',
        'body', 'He has 1 free message left. Reply now — you earn when he goes VIP.',
        'sound', 'default',
        'channelId', 'default',
        'priority', 'high',
        'data', jsonb_build_object('screen', '/messages/' || NEW.conversation_id::text, 'type', 'near_limit')
      ),
      headers := '{"Content-Type": "application/json", "Accept": "application/json"}'::jsonb,
      timeout_milliseconds := 30000
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_male_near_limit ON public.dm_messages;
CREATE TRIGGER trg_notify_male_near_limit
AFTER INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_male_near_limit();