CREATE INDEX IF NOT EXISTS idx_rtc_deliveries_recipient_created_counted
  ON public.ready_to_chat_deliveries (recipient_id, created_at DESC)
  WHERE status IN ('pending', 'sent', 'opened');

CREATE OR REPLACE FUNCTION public.get_ready_to_chat_limits()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_outgoing_used integer := 0;
  v_incoming_hour_used integer := 0;
  v_incoming_day_used integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;

  SELECT count(*)::integer
    INTO v_outgoing_used
    FROM public.ready_to_chat_sessions
   WHERE sender_id = v_uid
     AND created_at > now() - interval '24 hours';

  SELECT
    count(*) FILTER (WHERE d.created_at > now() - interval '1 hour')::integer,
    count(*) FILTER (WHERE d.created_at > now() - interval '24 hours')::integer
    INTO v_incoming_hour_used, v_incoming_day_used
    FROM public.ready_to_chat_deliveries d
   WHERE d.recipient_id = v_uid
     AND d.status IN ('pending', 'sent', 'opened')
     AND d.created_at > now() - interval '24 hours';

  RETURN jsonb_build_object(
    'success', true,
    'outgoing_daily_limit', 3,
    'outgoing_daily_remaining', greatest(0, 3 - COALESCE(v_outgoing_used, 0)),
    'incoming_hourly_limit', 3,
    'incoming_hourly_remaining', greatest(0, 3 - COALESCE(v_incoming_hour_used, 0)),
    'incoming_daily_limit', 10,
    'incoming_daily_remaining', greatest(0, 10 - COALESCE(v_incoming_day_used, 0))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_ready_to_chat_limits() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_ready_to_chat_limits() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.start_ready_to_chat(p_mode text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sender uuid := auth.uid();
  v_me public.members%ROWTYPE;
  v_session_id uuid;
  v_expires timestamptz;
  v_last_start timestamptz;
  v_starts integer;
  v_count integer := 0;
  v_text integer := 0;
  v_video integer := 0;
  v_both integer := 0;
  v_hour_count integer;
  v_day_count integer;
  v_candidate record;
  v_limits jsonb;
BEGIN
  IF v_sender IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'unauthenticated');
  END IF;
  IF p_mode IS NULL OR p_mode NOT IN ('text','video','both') THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_mode');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('ready_to_chat:' || v_sender::text));

  SELECT * INTO v_me FROM public.members WHERE id = v_sender;
  IF v_me.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_profile');
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_bans b WHERE b.user_id = v_sender AND b.is_active = true
      AND (b.expires_at IS NULL OR b.expires_at > now())
  ) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'banned');
  END IF;
  IF COALESCE(v_me.is_discoverable, false) = false
     OR COALESCE(v_me.image_status, '') <> 'approved'
     OR v_me.image_url IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_discoverable');
  END IF;

  UPDATE public.ready_to_chat_sessions
     SET status = 'expired'
   WHERE sender_id = v_sender AND status = 'active' AND expires_at <= now();

  IF EXISTS (SELECT 1 FROM public.ready_to_chat_sessions
             WHERE sender_id = v_sender AND status = 'active' AND expires_at > now()) THEN
    RETURN jsonb_build_object('success', false, 'reason', 'session_already_active');
  END IF;

  SELECT max(created_at), count(*) FILTER (WHERE created_at > now() - interval '24 hours')
    INTO v_last_start, v_starts
    FROM public.ready_to_chat_sessions WHERE sender_id = v_sender;

  IF v_last_start IS NOT NULL AND v_last_start > now() - interval '5 minutes' THEN
    RETURN jsonb_build_object('success', false, 'reason', 'restart_cooldown',
      'retry_after_seconds', ceil(extract(epoch from (v_last_start + interval '5 minutes' - now()))));
  END IF;
  IF COALESCE(v_starts, 0) >= 3 THEN
    RETURN jsonb_build_object('success', false, 'reason', 'daily_limit_reached');
  END IF;

  v_expires := now() + interval '15 minutes';
  INSERT INTO public.ready_to_chat_sessions (sender_id, mode, status, expires_at)
  VALUES (v_sender, p_mode, 'active', v_expires)
  RETURNING id INTO v_session_id;

  FOR v_candidate IN
    SELECT m.id AS recipient_id,
           public.rtc_effective_mode(v_sender, m.id, p_mode) AS eff,
           m.last_active_at,
           CASE
             WHEN EXISTS (
               SELECT 1 FROM public.conversations c
                WHERE (c.participant_1 = v_sender AND c.participant_2 = m.id)
                   OR (c.participant_1 = m.id AND c.participant_2 = v_sender)
             ) THEN 2
             WHEN EXISTS (
               SELECT 1 FROM public.member_interests i1
                WHERE i1.user_id = v_sender AND i1.interested_in_user_id = m.id
                  AND EXISTS (
                    SELECT 1 FROM public.member_interests i2
                     WHERE i2.user_id = m.id AND i2.interested_in_user_id = v_sender
                  )
             ) THEN 1
             ELSE 0
           END AS relevance
      FROM public.members m
     WHERE m.id <> v_sender
       AND m.is_discoverable = true
       AND m.image_status = 'approved'
       AND m.image_url IS NOT NULL
       AND m.last_active_at >= now() - interval '24 hours'
       AND COALESCE(m.notify_enabled, false) = true
       AND m.push_token IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.ready_to_chat_recipient_cooldowns c
          WHERE c.sender_id = v_sender AND c.recipient_id = m.id
            AND c.cooldown_expires_at > now()
       )
     ORDER BY relevance DESC, m.last_active_at DESC
  LOOP
    EXIT WHEN v_count >= 50;
    IF v_candidate.eff IS NULL THEN CONTINUE; END IF;

    PERFORM pg_advisory_xact_lock(hashtext('ready_to_chat_recipient:' || v_candidate.recipient_id::text));

    SELECT
      count(*) FILTER (WHERE d.created_at > now() - interval '1 hour')::integer,
      count(*) FILTER (WHERE d.created_at > now() - interval '24 hours')::integer
      INTO v_hour_count, v_day_count
      FROM public.ready_to_chat_deliveries d
     WHERE d.recipient_id = v_candidate.recipient_id
       AND d.status IN ('pending', 'sent', 'opened')
       AND d.created_at > now() - interval '24 hours';

    IF COALESCE(v_hour_count, 0) >= 3 OR COALESCE(v_day_count, 0) >= 10 THEN
      CONTINUE;
    END IF;

    INSERT INTO public.ready_to_chat_deliveries (session_id, recipient_id, effective_mode, status)
    VALUES (v_session_id, v_candidate.recipient_id, v_candidate.eff, 'pending')
    ON CONFLICT (session_id, recipient_id) DO NOTHING;

    IF NOT FOUND THEN CONTINUE; END IF;

    INSERT INTO public.ready_to_chat_recipient_cooldowns
      (sender_id, recipient_id, cooldown_expires_at, last_session_id, updated_at)
    VALUES
      (v_sender, v_candidate.recipient_id, now() + interval '24 hours', v_session_id, now())
    ON CONFLICT (sender_id, recipient_id)
      DO UPDATE SET cooldown_expires_at = EXCLUDED.cooldown_expires_at,
                    last_session_id = EXCLUDED.last_session_id,
                    updated_at = now();

    v_count := v_count + 1;
    IF v_candidate.eff = 'text' THEN v_text := v_text + 1;
    ELSIF v_candidate.eff = 'video' THEN v_video := v_video + 1;
    ELSE v_both := v_both + 1;
    END IF;
  END LOOP;

  UPDATE public.ready_to_chat_sessions SET recipient_count = v_count WHERE id = v_session_id;
  v_limits := public.get_ready_to_chat_limits();

  RETURN jsonb_build_object(
    'success', true,
    'session_id', v_session_id,
    'mode', p_mode,
    'expires_at', v_expires,
    'ttl_seconds', 900,
    'recipient_count', v_count,
    'counts', jsonb_build_object('text', v_text, 'video', v_video, 'both', v_both),
    'limits', v_limits
  );
END;
$$;

REVOKE ALL ON FUNCTION public.start_ready_to_chat(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_ready_to_chat(text) TO authenticated, service_role;